import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { ProfessionalSpecializationToolAdapter } from '../packages/adapters/src/professional-specialization-tool-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';
import { actionRequiresFounderBiometric } from '../packages/core/src/authority.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';
import type { ChronologyRecord } from '../packages/core/src/continuity.js';

function fixture(withResearch = true) {
  const records:ChronologyRecord[] = [];
  let calls=0;
  const adapter=new ProfessionalSpecializationToolAdapter({
    store:{listChronologyRecords:()=>records,appendChronologyRecord:r=>{records.push(r);}},
    ...(withResearch?{research:async (q:string)=>{
      calls++;assert.match(q,/fuentes primarias|académicas/i);
      return {answer:'Introducción basada en fuentes. Limitaciones y contraevidencia pendientes de auditar.',
        sources:[
          {url:'https://www.stanford.edu/research/',title:'Stanford Research'},
          {url:'https://www.harvard.edu/research/',title:'Harvard Research'},
          {url:'https://example.com/blog',title:'Nota informal'},
        ],costUsd:0.02};
    }}:{}),
    now:()=>new Date('2026-11-05T21:00:00.000Z'),
  });
  const run=(action:string,domain='marketing digital',authorized=false,key='key-'+createHash('sha256').update(domain).digest('hex'))=>
    adapter.execute({tool:'specialization',action,input:{domain},
      ...(authorized?{idempotencyKey:key,authorization:{privileged:true,principalId:'founder',
        authorityDecisionHash:createHash('sha256').update('approved').digest('hex')}}:{})},()=>{});
  return {records,adapter,run,get calls(){return calls;}};
}
test('órdenes por voz planifican investigación profesional sin escribir código',()=>{
  for (const phrase of [
    'Janus, actúa como especialista en marketing digital',
    'Necesito que actúes como especialista en arquitectura sostenible',
    'Conviértete en experto en automatización empresarial',
  ]) {
    const plan=deterministicPlan(phrase);
    assert.ok(plan,phrase);
    assert.equal(plan.steps.length,2);
    assert.equal(plan.steps[0]!.tool,'specialization');
    assert.equal(plan.steps[1]!.action,'research.apply');
    assert.equal(plan.steps[1]!.requiresApproval,true);
    assert.equal(actionRequiresFounderBiometric('specialization.research.apply'),true);
    assert.equal(enforceSensitiveActionPolicy(plan).enforced.length,1);
  }
  assert.equal(deterministicPlan('¿Cómo trabaja un especialista en marketing?'),null);
});
test('plan offline de profesión reutilizable, sin investigación ficticia',async()=>{
  const f=fixture(false);
  const plan=await f.run('research.plan');
  assert.equal(plan.ok,true);
  assert.ok(Array.isArray(plan.output?.stages));
  assert.equal(f.records.length,0);
  assert.equal(plan.output?.localSnapshot,null);
  const attempt=await f.run('research.apply','marketing digital',true);
  assert.equal(attempt.ok,false);
  assert.equal(f.records.length,0);
});
test('no se activan especializaciones mediante transcripciones sin permiso Founder y biometría',async()=>{
 const f=fixture();
 const untrusted=await f.run('research.apply');
 assert.equal(untrusted.ok,false);
 assert.equal(f.calls,0);
 assert.equal(f.records.length,0);
 const plan=await f.run('research.plan');
 assert.equal(plan.ok,true);
 assert.equal(f.calls,0);
});
test('investigación con fuentes independientes crea dossier provisional en SQLite y conserva cronología',async()=>{
 const f=fixture();
 const first=await f.run('research.apply','marketing digital',true,'study-v1-12345678');
 assert.equal(first.ok,true,first.error);
 assert.equal(first.output?.archived,true);
 assert.equal(first.output?.verified,false);
 assert.equal(first.output?.status,'POR CONFIRMAR');
 assert.ok((first.output?.primarySources as number)>=1);
 assert.equal(f.calls,1);
 assert.equal(f.records.length,1);
 assert.equal(f.records[0]!.kind,'state','web research never becomes privileged instruction');
 assert.equal(f.records[0]!.status,'current');
 assert.equal(f.records[0]!.metadata?.reviewStatus,'POR CONFIRMAR');
 const note=JSON.parse(f.records[0]!.content) as {domain:string;sources:Array<{url:string}>; evidence:{linksVerified:boolean}};
 assert.equal(note.domain,'marketing digital');
 assert.ok(note.sources.some(x=>x.url.includes('stanford.edu')));
 assert.equal(note.evidence.linksVerified,false,'provider links not audited directly');
 const again=await f.run('research.apply','marketing digital',true,'study-v1-12345678');
 assert.equal(again.ok,true);
 assert.equal(again.output?.unchanged,true);
 assert.equal(f.calls,1,'idempotencia sin otra búsqueda pagada');
 const retrieved=await f.run('profile.get','marketing digital');
 assert.equal(retrieved.ok,true);
 assert.equal(retrieved.output?.found,true);
 assert.equal(retrieved.output?.status,'POR CONFIRMAR');
 const revised=await f.run('research.apply','marketing digital',true,'study-v2-12345678');
 assert.equal(revised.ok,true);
 assert.equal(f.records.length,2);
 assert.equal(f.records[1]!.supersedesId,f.records[0]!.id);
 const different=await f.run('research.apply','ingeniería de datos',true,'study-v2-12345678');
 assert.equal(different.ok,false,'una clave no cambia de profesión');
});
test('sin dos fuentes independientes y fuente primaria no se finge aprendizaje',async()=>{
 const records:ChronologyRecord[]=[];
 const adapter=new ProfessionalSpecializationToolAdapter({
  store:{listChronologyRecords:()=>records,appendChronologyRecord:r=>records.push(r)},
  research:async()=>({answer:'Una opinión no es evidencia',
    sources:[{url:'http://localhost/admin'},{url:'https://forum.example.com/post'}]}),
 });
 const x=await adapter.execute({tool:'specialization',action:'research.apply',input:{domain:'arquitectura sostenible'},
 idempotencyKey:'safe-study-123456',
 authorization:{privileged:true,principalId:'founder',authorityDecisionHash:'a'.repeat(64)}},()=>{});
 assert.equal(x.ok,false);
 assert.equal(records.length,0);
});
