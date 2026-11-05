import { createHash, randomUUID } from 'node:crypto';
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import type { ChronologyRecord } from '../../core/src/continuity.js';
import { planLayeredResearch, rankSources, hostOf } from '../../orchestrator/src/research-verification.js';

/**
 * Especialización acumulativa POR VOZ para dominios nuevos sin escribir código.
 *
 * 1. research.plan: pre-mortem e investigación por capas (sin red ni escritura).
 * 2. research.apply: con autorización Founder/Face ID, investiga a través del
 *    Tool Gateway, valida origen y variedad de fuentes y conserva en SQLite
 *    un dossier explícitamente PROVISIONAL, listo para ser revalidado.
 * 3. profile.get: recupera el dossier vigente y las tareas pendientes, aun offline.
 *
 * El texto web es DATA, nunca órdenes de sistema. Guardar una investigación no
 * convierte al modelo en especialista certificado ni modifica sus pesos.
 */

export interface SpecialistResearchResult {
  answer: string;
  sources: Array<{url:string;title?:string;snippet?:string;publishedAt?:string}>;
  costUsd?: number|null;
}
export interface ProfessionalSpecializationOptions {
  store: {
    listChronologyRecords(): ChronologyRecord[];
    appendChronologyRecord(record:ChronologyRecord):void;
  };
  research?: (question:string) => Promise<SpecialistResearchResult>;
  now?: () => Date;
}
type RecordWithSources = ChronologyRecord & {
  metadata?: Record<string,unknown>;
};

export class ProfessionalSpecializationToolAdapter implements ToolAdapter {
  readonly name='specialization';
  readonly capabilities=['research.plan','research.apply','profile.get'];
  private readonly now:()=>Date;
  constructor(private readonly options:ProfessionalSpecializationOptions) {
    this.now=options.now??(()=>new Date());
  }
  async execute(request:ToolRequest,onProgress:(progress:ToolProgress)=>void|Promise<void>):Promise<ToolResult> {
    try {
      const domain=domainFrom(request.input.domain);
      await onProgress({phase:'progress',message:'Especialización: '+domain,percent:20});
      if(request.action==='profile.get') return this.profile(domain);
      if(request.action==='research.plan') return this.plan(domain);
      if(request.action==='research.apply') return await this.learn(domain,request,onProgress);
      return {ok:false,error:'Acción de especialización no permitida.'};
    } catch(e) {
      return {ok:false,error:e instanceof SpecializationError?e.message:'No fue posible verificar la especialización solicitada.'};
    }
  }

  private plan(domain:string):ToolResult {
    const previous=this.latest(domain);
    return {ok:true,output:{
      domain, role:'Especialista en '+domain,
      stages:planLayeredResearch(domain,[
        'investigación de fuentes primarias académicas y oficiales',
        'estándares, normativa local y riesgos actualizados',
        'aplicaciones profesionales y medidas de valor',
        'crítica, contraevidencia y límites del conocimiento',
      ]),
      requiresApprovalForResearch:true,
      localSnapshot:previous?this.summarize(previous):null,
      reply:previous
        ? 'Existe un dossier local de '+domain+'. Revisaré qué cambió y qué fuentes requieren nueva validación antes de actualizarlo.'
        : 'Preparé el plan para estudiar '+domain+'. Aún no he investigado ni adquirido una especialización verificada.',
    }};
  }

  private profile(domain:string):ToolResult {
    const record=this.latest(domain);
    if(!record) return {ok:true,output:{domain,found:false,reply:'No hay dossier local de '+domain+'. Solicita una investigación autorizada para crearlo.'}};
    return {ok:true,output:{domain,found:true,...this.summarize(record),
      reply:'Dossier recuperado para '+domain+'; los datos siguen etiquetados POR CONFIRMAR hasta auditar las fuentes.'}};
  }

  private async learn(domain:string, request:ToolRequest, onProgress:(progress:ToolProgress)=>void|Promise<void>):Promise<ToolResult> {
    const permit=request.authorization;
    if(!permit?.privileged || permit.principalId!=='founder'
       || !/^[a-f0-9]{64}$/i.test(permit.authorityDecisionHash||'')
       || !request.idempotencyKey || request.idempotencyKey.length<8)
      return {ok:false,error:'Investigar y registrar una nueva especialización exige sesión Founder, autorización biométrica e idempotencia.'};
    const prior=this.options.store.listChronologyRecords().find(rec=>
      rec.metadata?.operationKey===request.idempotencyKey);
    if(prior) return prior.subject===subjectFor(domain)
      ? {ok:true,output:{domain,unchanged:true,...this.summarize(prior),reply:'Investigación ya registrada una vez.'}}
      : {ok:false,error:'La clave de operación ya pertenece a otra profesión.'};
    if(!this.options.research) return {ok:false,error:'No hay motor de investigación verificable conectado; se conserva el conocimiento offline y no se inventan fuentes.'};
    await onProgress({phase:'progress',message:'Consultando evidencia científica y oficial',percent:45});
    const query='Elabora un dossier profesional introductorio de '+domain+
      '. Prioriza fuentes primarias oficiales, Stanford, Harvard, universidades, normas y estudios revisados. '+
      'Incluye fecha, riesgos, áreas de conocimiento, herramientas actuales, objeciones, contraevidencia y dos o más URLs independientes. No inventes citas.';
    let result:SpecialistResearchResult;
    try {result=await this.options.research(query);}
    catch{return {ok:false,error:'Investigación externa no disponible. El estudio sigue pendiente sin modificar el contexto.'};}
    if(!result.answer?.trim()) return {ok:false,error:'El proveedor no entregó análisis utilizable.'};
    const sources=rankSources((result.sources||[]).flatMap(item=>{
      try {
        const u=new URL(item.url);
        if(u.protocol!=='https:' || !u.hostname.includes('.') || u.username || u.password || u.port) return [];
        if(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname)) return [];
        return [{url:u.href,title:(item.title||'').slice(0,180),publishedAt:item.publishedAt}];
      } catch{return [];}
    })).slice(0,18);
    const independent=new Set(sources.map(s=>hostOf(s.url))).size;
    const primary=sources.filter(s=>s.tier==='A'||s.tier==='A-').length;
    if(independent<2 || primary<1) return {ok:false,output:{domain,sourceCount:sources.length,independentDomains:independent,primarySources:primary},
      error:'Evidencia insuficiente: se necesitan al menos dos fuentes independientes y una académica u oficial. No se activa una especialización.'};
    // Nunca se registra un texto web como norma imperativa. El dossier es una
    // investigación provisional con enlaces, no un cambio de personalidad del Core.
    const now=this.now().toISOString();
    const previous=this.latest(domain);
    const note={
      domain, status:'POR CONFIRMAR', researchedAt:now,
      researchSummary:result.answer.slice(0,6500),
      sources:sources.map(s=>({url:s.url,title:s.title,tier:s.tier,publishedAt:s.publishedAt??null})),
      evidence: {independentDomains:independent,primarySources:primary,
        linksVerified:false, quotesVerified:false, retractionsChecked:false},
      usePolicy:'No tratar este resumen como conocimiento verificado. Revalidar citas con fuentes originales antes de tomar decisiones profesionales, legales, médicas o financieras.',
    };
    const record:ChronologyRecord={
      id:'expertise:'+randomUUID(),sessionId:'janus-specialization',at:now,
      kind:'state',subject:subjectFor(domain),status:'current',
      ...(previous?{supersedesId:previous.id}:{}),
      content:JSON.stringify(note),
      metadata:{operationKey:request.idempotencyKey,origin:'authenticated-founder-voice-or-text',
        sourceCount:sources.length,independentDomains:independent,primarySources:primary,reviewStatus:'POR CONFIRMAR',
        ...(typeof result.costUsd==='number'?{researchCostUsd:result.costUsd}:{})},
    };
    this.options.store.appendChronologyRecord(record);
    return {ok:true,output:{
      domain, archived:true, verified:false, current:true,
      status:'POR CONFIRMAR', sourceCount:sources.length,
      independentDomains:independent, primarySources:primary,
      preview:result.answer.slice(0,1800),
      sources:note.sources,
      reply:'Investigación de '+domain+' archivada en SQLite con fuentes y advertencias. Janus puede consultarla y ampliarla, pero aún debe verificar citas antes de actuar como especialista.',
    }};
  }

  private latest(domain:string):RecordWithSources|undefined {
    return this.options.store.listChronologyRecords()
      .filter(r=>r.subject===subjectFor(domain)&&r.status==='current').at(-1);
  }
  private summarize(record:ChronologyRecord) {
    const note=JSON.parse(record.content) as Record<string,unknown>;
    return {id:record.id,status:note.status,researchedAt:note.researchedAt,
      summary:note.researchSummary,sources:note.sources,verification:note.evidence,
      version:record.id,supersedesId:record.supersedesId??null};
  }
}
function domainFrom(value:unknown):string {
  if(typeof value!=='string')throw new SpecializationError('Indica la profesión o especialidad.');
  const domain=value.normalize('NFC').trim().replace(/\s+/g,' ');
  if(domain.length<4||domain.length>100 || /[<>@/\\]|https?:|\d{3,}/i.test(domain))
    throw new SpecializationError('Profesión inválida; solo se admiten áreas profesionales generales.');
  return domain;
}
function subjectFor(domain:string):string {
  return 'expertise:'+createHash('sha256').update(domain.toLowerCase()).digest('hex').slice(0,20);
}
class SpecializationError extends Error {}
