import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { VoiceStudioToolAdapter } from '../packages/adapters/src/voice-studio-tool-adapter.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { actionRequiresFounderBiometric } from '../packages/core/src/authority.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'janus-studio-'));
  const privateRoot = join(root, 'voices', 'private');
  const model = join(root, 'models', 'Qwen3-TTS-Base');
  const config = join(root, 'config', 'voices.local.json');
  mkdirSync(model, { recursive: true });
  mkdirSync(join(privateRoot, 'jean'), { recursive: true });
  const audioPath = join(privateRoot, 'jean', 'original.wav');
  const audio = Buffer.from('RIFF-original-audio-sample-owned-by-jean');
  writeFileSync(audioPath, audio);
  const sample = {
    id: 'original-jean-001', provenance: 'original-recording',
    durationSeconds: 45, sha256: createHash('sha256').update(audio).digest('hex'),
    storedLocally: true, hasTranscript: true, cleanAudioConfirmed: true,
    audioPath, transcript: 'Esta es mi grabación original de voz para Janus.',
  };
  const manifest = {
    subject: 'jean', consent: {
      grantedAt: '2026-11-05T12:00:00Z', grantedBy: 'subject',
      scope: 'Uso de mi voz en Janus de forma privada',
    }, samples: [sample],
  };
  const manifestPath = join(privateRoot, 'jean', 'corpus.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  const tool = new VoiceStudioToolAdapter({
    configPath: config, privateRoot, designModelPath: model, cloneModelPath: model,
    now: () => new Date('2026-11-05T15:00:00Z'),
  });
  const gateway = new DefaultToolGateway(); gateway.register(tool);
  const execute = (action: string, input: Record<string, unknown> = {}, authorized = false, key: string = randomUUID()) =>
    gateway.execute({
      tool: 'voice-studio', action, input,
      ...(authorized ? { idempotencyKey: key, authorization: {
        privileged: true, authorityDecisionHash: 'audited-founder-signature',
        principalId: 'founder',
      } } : {}),
    }, () => {});
  return { root, privateRoot, model, config, manifestPath, manifest, audioPath, tool, execute,
    dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('Voz por voz: diseño, clon local con consentimiento, y lectura segura del registro', async () => {
  const f=fixture();
  try {
    const preview=await f.execute('design.preview', {voiceId:'janus-nimbo', instruct:'Voz de nube amable con un tono de dibujo animado'});
    assert.equal(preview.ok,true);assert.equal(preview.output?.modelReady,true);
    assert.equal(existsSync(f.config),false,'previsualizar no debe escribir');
    const bad=await f.execute('design.apply',{voiceId:'janus-nimbo',instruct:'Voz de nube amable con un tono de dibujo animado'});
    assert.equal(bad.ok,false,'sin autoridad el Core bloquea');
    const key='voice-design:'+randomUUID();
    const good=await f.execute('design.apply',{voiceId:'janus-nimbo',instruct:'Voz de nube amable con un tono de dibujo animado'},true,key);
    assert.equal(good.ok,true);
    assert.equal(good.output?.configuredLocally,true);
    assert.equal(good.output?.audibleVerified,false,'ninguna prueba real acústica se inventa');
    const replay=await f.execute('design.apply',{voiceId:'janus-nimbo',instruct:'Voz de nube amable con un tono de dibujo animado'},true,key);
    assert.equal(replay.ok,true);assert.equal(replay.output?.unchanged,true);
    const current=JSON.parse(readFileSync(f.config,'utf8')) as { voices: Record<string,{mode:string,instruct?:string,ref_audio?:string}> };
    assert.equal(current.voices['janus-nimbo']?.mode,'voice_design');
    assert.equal(current.voices['janus-nimbo']?.instruct,'Voz de nube amable con un tono de dibujo animado');
    assert.equal(current.voices['janus-nimbo']?.ref_audio,undefined);
    const ready=await f.execute('clone.readiness',{subjectId:'jean'});
    assert.equal(ready.ok,true,ready.error);
    assert.equal(ready.output?.ready,true);
    const clone=await f.execute('clone.apply',{subjectId:'jean',voiceId:'janus-founder-local'},true,'clone:'+randomUUID());
    assert.equal(clone.ok,true,clone.error);
    const installed=JSON.parse(readFileSync(f.config,'utf8')) as {voices:Record<string,{mode:string,ref_audio?:string,ref_text?:string}>};
    assert.equal(installed.voices['janus-founder-local']?.mode,'voice_clone');
    assert.equal(installed.voices['janus-founder-local']?.ref_audio,f.audioPath);
    assert.equal(installed.voices['janus-founder-local']?.ref_text,f.manifest.samples[0]!.transcript);
    const catalog=await f.execute('voices.list');
    assert.equal(catalog.ok,true);
    const voices=catalog.output?.voices as Array<{id:string}>;
    assert.equal(voices.length,2);
    assert.ok(!JSON.stringify(voices).includes('original.wav'),'nunca exponer la ruta del audio');
    const revoked=await f.execute('voice.revoke',{voiceId:'janus-founder-local'},true,'revoke:'+randomUUID());
    assert.equal(revoked.ok,true);
    assert.equal(revoked.output?.revoked,true);
    assert.equal((await f.execute('voices.list')).output?.voices instanceof Array,true);
  } finally {f.dispose();}
});
test('consentimiento revocado, audio de proveedor y menor impiden clonar',async()=>{
  const f=fixture();
  try {
    const revoked=structuredClone(f.manifest);
    revoked.consent = { ...revoked.consent, revokedAt:'2026-11-05T14:00:00Z' } as typeof revoked.consent;
    writeFileSync(f.manifestPath,JSON.stringify(revoked));
    assert.equal((await f.execute('clone.readiness',{subjectId:'jean'})).output?.ready,false);
    assert.equal((await f.execute('clone.apply',{subjectId:'jean'},true,'a:'+randomUUID())).ok,false);
    const provider=structuredClone(f.manifest);
    provider.samples[0]!.provenance='provider-output';
    writeFileSync(f.manifestPath,JSON.stringify(provider));
    assert.equal((await f.execute('clone.readiness',{subjectId:'jean'})).output?.ready,false);
    const minor=structuredClone(f.manifest) as typeof f.manifest & {subjectIsMinor?:boolean};
    minor.subject='kendra';minor.subjectIsMinor=true;
    mkdirSync(join(f.privateRoot,'kendra'),{recursive:true});
    writeFileSync(join(f.privateRoot,'kendra','corpus.json'),JSON.stringify(minor));
    assert.equal((await f.execute('clone.readiness',{subjectId:'kendra'})).output?.ready,false);
    assert.equal((await f.execute('clone.apply',{subjectId:'kendra',voiceId:'kendra-local'},true,'minor:'+randomUUID())).ok,false);
  } finally {f.dispose();}
});
test('audio manipulado, clave repetida para contenido distinto, y falta de motor no clonan',async()=>{
 const f=fixture();
 try {
   writeFileSync(f.audioPath,Buffer.from('audio altered'));
   assert.equal((await f.execute('clone.readiness',{subjectId:'jean'})).output?.ready,false);
   const key='idempotency:'+randomUUID();
   assert.equal((await f.execute('design.apply',{voiceId:'janus-one',instruct:'Voz clara y de carácter divertido'},true,key)).ok,true);
   const mismatch=await f.execute('design.apply',{voiceId:'janus-other',instruct:'Voz profunda con cadencia solemne'},true,key);
   assert.equal(mismatch.ok,false,'reuso de clave con distinta voz bloquea');
   const noModel = new VoiceStudioToolAdapter({configPath:join(f.root,'other','voices.local.json'),privateRoot:f.privateRoot});
   const result=await noModel.execute({
     tool:'voice-studio',action:'design.apply',input:{voiceId:'janus-new',instruct:'Voz tranquila y melodiosa para ayudar'},
     idempotencyKey:'new:'+randomUUID(),authorization:{privileged:true,authorityDecisionHash:'approval',principalId:'founder'},
   },()=>{});
   assert.equal(result.ok,false);assert.match(result.error||'',/modelo Qwen3/i);
 } finally {f.dispose();}
});
test('órdenes habladas generan revisión y aplicación protegida; consultas no crean voces',()=>{
 for(const command of ['Janus, clona mi voz','Crea una voz caricaturesca suave y alegre para Janus']) {
   const plan=deterministicPlan(command);
   assert.ok(plan,command);
   const steps=plan.steps;
   assert.equal(steps.length,2);
   assert.equal(steps[0]!.tool,'voice-studio');
   assert.equal(steps[1]!.tool,'voice-studio');
   assert.match(steps[1]!.action,/apply/);
   assert.equal(steps[1]!.requiresApproval,true);
   assert.equal(steps[1]!.risk,'high');
   assert.ok(steps[1]!.idempotencyKey);
   assert.equal(actionRequiresFounderBiometric('voice-studio.'+steps[1]!.action),true);
   assert.equal(enforceSensitiveActionPolicy(plan).enforced.length,1);
 }
 assert.equal(deterministicPlan('¿Cómo funciona la clonación de voz de ElevenLabs?'),null);
});
