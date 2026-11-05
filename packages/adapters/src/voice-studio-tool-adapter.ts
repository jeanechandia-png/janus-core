import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { assessLocalCloneReadiness, type VoiceCorpusManifest } from '../../voice/src/voice-independence.js';

/**
 * Estudio de voz 100 % local y auditado por JANUS CORE.
 * Qwen3-TTS (VoiceDesign/Base) ya opera en el sidecar existente. Este adaptador
 * solo instala VOZES LOCALES que han superado los controles; no entrenamos
 * modelos ni exportamos audio. La síntesis efectiva sigue dependiendo de un
 * modelo Qwen disponible y hardware verificado.
 *
 * Orden hablada -> planificación -> permiso Founder + prueba biométrica ->
 * instalación atómica -> el sidecar recarga su config local al recibir TTS.
 * Nunca escribe voz en la nube ni coloca audio en Git o SQLite.
 */
export interface VoiceStudioOptions {
  configPath: string;
  privateRoot: string;
  designModelPath?: string;
  cloneModelPath?: string;
  now?: () => Date;
}

type VoiceSpec = Record<string, unknown>;
type VoiceConfig = { voices: Record<string, VoiceSpec> };
type Ledger = Record<string, { requestHash: string; voiceId: string; recordedAt: string }>;

export class VoiceStudioToolAdapter implements ToolAdapter {
  readonly name = 'voice-studio';
  readonly capabilities = [
    'voices.list', 'design.preview', 'clone.readiness',
    'design.apply', 'clone.apply', 'voice.revoke',
  ];
  private readonly configPath: string;
  private readonly privateRoot: string;
  private readonly designModelPath?: string;
  private readonly cloneModelPath?: string;
  private readonly now: () => Date;

  constructor(options: VoiceStudioOptions) {
    this.configPath = resolve(options.configPath);
    this.privateRoot = resolve(options.privateRoot);
    this.designModelPath = options.designModelPath ? resolve(options.designModelPath) : undefined;
    this.cloneModelPath = options.cloneModelPath ? resolve(options.cloneModelPath) : undefined;
    this.now = options.now ?? (() => new Date());
    // Solo rutas locales, los secretos nunca aparecen en respuestas o logs.
    if (!this.configPath.endsWith('voices.local.json')) throw new Error('voice studio config must end with voices.local.json');
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: 'voice-studio action not supported' };
    try {
      await onProgress({ phase: 'progress', message: 'Estudio de voces local: ' + request.action, percent: 20 });
      switch (request.action) {
        case 'voices.list': return this.list();
        case 'design.preview': return this.designPreview(request.input);
        case 'clone.readiness': return this.cloneReadiness(request.input);
        case 'design.apply': return this.install(request, 'voice_design');
        case 'clone.apply': return this.install(request, 'voice_clone');
        case 'voice.revoke': return this.revoke(request);
        default: return { ok: false, error: 'unsupported action' };
      }
    } catch (e) {
      // No volcar paths con información personal o transcripciones en errores.
      return { ok: false, error: e instanceof StudioError ? e.message : 'Error en el estudio local de voz; consulta el registro protegido del Core.' };
    }
  }

  private list(): ToolResult {
    const cfg = this.readConfig();
    return {
      ok: true,
      output: { voices: Object.entries(cfg.voices).map(([id, spec]) => ({
        id, mode: spec.mode, language: spec.language ?? 'Spanish',
        local: true,
      })), reply: 'Catálogo local leído; ninguna voz fue clonada ni activada por esta consulta.' },
    };
  }

  private designPreview(input: Record<string, unknown>): ToolResult {
    const id = voiceId(input.voiceId, 'janus-designed');
    const description = direction(input.instruct);
    const available = !!this.designModelPath && existsSync(this.designModelPath);
    return { ok: true, output: {
      voiceId: id, mode: 'voice_design', description,
      modelReady: available, requiresApproval: true,
      reply: available
        ? 'Diseño de voz preparado para ' + id + '. Falta confirmar su instalación con autorización biométrica; todavía no se ha generado audio.'
        : 'Diseño guardable, pero el modelo Qwen3 VoiceDesign no está disponible localmente. No hay voz creada ni se compra ningún servicio.',
    } };
  }

  private cloneReadiness(input: Record<string, unknown>): ToolResult {
    const subjectId = voiceId(input.subjectId, 'founder');
    const manifest = this.readManifest(subjectId);
    const readiness = assessLocalCloneReadiness(manifest);
    // Para menores se bloquea la activación hasta contar con una verificación
    // biométrica real del tutor; un JSON que diga "guardian" no demuestra tal identidad.
    const minorBlocked = manifest.subjectIsMinor === true;
    const matching = manifest.subject.trim().toLowerCase() === subjectId.toLowerCase();
    const usable = readiness.usableSampleIds.filter(id => {
      const sample = manifest.samples.find(x => x.id === id);
      if (!sample) return false;
      return typeof sample.audioPath === 'string' && typeof sample.transcript === 'string' &&
        sample.transcript.trim().length > 0 && this.validLocalAudio(sample.audioPath, sample.sha256);
    });
    return { ok: true, output: {
      subjectId, ready: readiness.ready && !minorBlocked && matching && usable.length > 0 && !!this.cloneModelPath && existsSync(this.cloneModelPath),
      cleanReferenceSeconds: readiness.usableSeconds,
      usableReferences: usable.length,
      modelReady: !!this.cloneModelPath && existsSync(this.cloneModelPath),
      blockers: [
        ...readiness.blockers,
        ...(minorBlocked ? ['Clon de voz de menor suspendido: requiere comprobación externa de tutela/consentimiento.'] : []),
        ...(!matching ? ['El identificador del titular no coincide con el manifiesto local.'] : []),
        ...(!usable.length ? ['No existe grabación original/transcripción íntegra con integridad SHA-256 verificada.'] : []),
      ],
      reply: 'Evaluación local del corpus. Ningún audio salió del dispositivo ni se creó una voz.',
    } };
  }

  private install(request: ToolRequest, mode: 'voice_design' | 'voice_clone'): ToolResult {
    this.requirePrivileged(request);
    const id = voiceId(request.input.voiceId, mode === 'voice_design' ? 'janus-designed' : 'janus-founder-local');
    const model = mode === 'voice_design' ? this.designModelPath : this.cloneModelPath;
    if (!model || !existsSync(model)) return { ok:false, error:'El modelo Qwen3 para esta operación no está instalado localmente.' };
    let spec: VoiceSpec;
    if (mode === 'voice_design') {
      spec = { mode, model_path: model, language: 'Spanish', instruct: direction(request.input.instruct) };
    } else {
      const subjectId = voiceId(request.input.subjectId, 'founder');
      const corpus = this.readManifest(subjectId);
      const check = this.cloneReadiness({subjectId});
      if (check.output?.ready !== true) return {ok:false,error:'No se cumplen las condiciones de consentimiento, corpus original y motor local para clonar.'};
      const sample = corpus.samples.find(x =>
        (check.output?.usableReferences as number) > 0 &&
        x.provenance === 'original-recording' && x.cleanAudioConfirmed === true &&
        typeof x.audioPath === 'string' && typeof x.transcript === 'string' &&
        this.validLocalAudio(x.audioPath, x.sha256));
      if (!sample?.audioPath || !sample.transcript) return {ok:false,error:'Muestra original/transcripción no disponible.'};
      spec = {
        mode, model_path: model, language: 'Spanish',
        ref_audio: realpathSync(sample.audioPath),
        ref_text: sample.transcript,
        x_vector_only_mode: false,
      };
    }
    const digest = createHash('sha256').update(JSON.stringify({id,spec})).digest('hex');
    const operations = this.readLedger();
    const key = request.idempotencyKey!;
    const old = operations[key];
    if (old) {
      return old.requestHash === digest && old.voiceId === id
        ? {ok:true,output:{id,unchanged:true,reply:'Solicitud ya registrada; no se escribió dos veces.'}}
        : {ok:false,error:'La misma clave de operación no puede instalar una voz diferente.'};
    }
    const config = this.readConfig();
    if (config.voices[id]) return {ok:false,error:'Ese identificador de voz ya existe; no se sobrescribe sin una operación de versión explícita.'};
    config.voices[id] = spec;
    this.atomicJson(this.configPath, config);
    operations[key] = {requestHash:digest,voiceId:id,recordedAt:this.now().toISOString()};
    this.atomicJson(this.ledgerPath(),operations);
    return {ok:true,output:{
      id, mode, installed:true, configuredLocally:true, audibleVerified:false,
      reply:'Voz configurada localmente para Qwen3-TTS. El sidecar deberá sintetizar y superar pruebas acústicas antes de declarar clon funcional.',
    }};
  }

  private revoke(request: ToolRequest): ToolResult {
    this.requirePrivileged(request);
    const id=voiceId(request.input.voiceId,'');
    const config=this.readConfig();
    if (!config.voices[id]) return {ok:true,output:{id,unchanged:true,reply:'Voz no presente.'}};
    delete config.voices[id];
    this.atomicJson(this.configPath,config);
    return {ok:true,output:{id,revoked:true,reply:'Voz desactivada en el registro local. El audio original permanece bajo custodia del titular.'}};
  }

  private requirePrivileged(request: ToolRequest): void {
    if (!request.authorization?.privileged || !request.authorization.authorityDecisionHash || !request.authorization.principalId)
      throw new StudioError('La escritura de voces requiere una autorización auditada del Founder.');
    if (!request.idempotencyKey || request.idempotencyKey.length < 8)
      throw new StudioError('Falta una clave de idempotencia válida.');
  }

  private readConfig(): VoiceConfig {
    if (!existsSync(this.configPath)) return {voices:{}};
    const value=JSON.parse(readFileSync(this.configPath,'utf8')) as {voices?:unknown};
    if (!value || typeof value.voices !== 'object' || !value.voices || Array.isArray(value.voices))
      throw new StudioError('La configuración local de voces está dañada.');
    return {voices:value.voices as Record<string,VoiceSpec>};
  }

  private readManifest(subjectId:string): VoiceCorpusManifest & {samples:Array<{audioPath?:string;transcript?:string} & VoiceCorpusManifest['samples'][number]>} {
    const file=join(this.privateRoot,subjectId,'corpus.json');
    if (!existsSync(file)) throw new StudioError('No existe corpus privado de grabaciones originales para ese titular.');
    const parsed=JSON.parse(readFileSync(file,'utf8')) as VoiceCorpusManifest;
    if (!parsed || !Array.isArray(parsed.samples)) throw new StudioError('Manifest de corpus no válido.');
    return parsed as ReturnType<VoiceStudioToolAdapter['readManifest']>;
  }

  private validLocalAudio(file:string,expectedHash:string): boolean {
    try {
      if (!isAbsolute(file)) return false;
      const actual=realpathSync(file), root=realpathSync(this.privateRoot);
      const rel=relative(root,actual);
      if (rel.startsWith('..'+sep) || rel==='..' || isAbsolute(rel)) return false;
      if (!/\.(wav|flac|mp3)$/i.test(basename(actual)) || statSync(actual).size<=0) return false;
      const hash=createHash('sha256').update(readFileSync(actual)).digest('hex');
      return hash===expectedHash.toLowerCase();
    } catch {return false;}
  }

  private ledgerPath():string {return join(this.privateRoot,'.studio-ops.json');}
  private readLedger():Ledger {
    const p=this.ledgerPath();
    return existsSync(p)?JSON.parse(readFileSync(p,'utf8')) as Ledger:{};
  }
  private atomicJson(file:string, data:unknown):void {
    mkdirSync(dirname(file),{recursive:true,mode:0o700});
    const tmp=join(dirname(file),'.janus-voice-'+randomUUID()+'.tmp');
    writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});
    renameSync(tmp,file);
  }
}
class StudioError extends Error {}
function voiceId(value:unknown,fallback:string):string {
  const id=typeof value==='string'&&value.trim()?value.trim():fallback;
  if (!/^[a-z][a-z0-9-]{2,47}$/.test(id)) throw new StudioError('El identificador de la voz debe tener letras minúsculas, números o guiones.');
  return id;
}
function direction(value:unknown):string {
  if (typeof value!=='string') throw new StudioError('Falta describir la voz que se desea crear.');
  const v=value.normalize('NFC').trim();
  if (v.length<12 || v.length>800) throw new StudioError('Describe la voz en 12–800 caracteres.');
  return v;
}
