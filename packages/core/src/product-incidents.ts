import {createHash} from 'node:crypto';
import {ErrorLedger, type ChronologyRecord, type ErrorLesson} from './continuity.js';

export interface IncidentEvidence {kind:string;ref:string;verified:boolean}
export interface ProductIncident {
  id:string;revision:number;productId:string;fingerprint:string;occurredAt:string;updatedAt:string;
  severity:'low'|'medium'|'high'|'critical';status:'open'|'mitigated'|'resolved';
  summary:string;causeStatus:'confirmed'|'investigating';cause:string;impact:string;
  lesson:string;preventiveRule:string;change:string;requiredEvidence:string[];evidence:IncidentEvidence[];
}
export interface ProductIncidentFeed {
  schemaVersion:1;productId:string;revision:number;updatedAt:string;incidents:ProductIncident[];
}
export interface IncidentSource {
  productId:string;name:string;
  repository?:string;ref?:string;path?:string;
}
export interface IncidentMemoryStore {
  listProductIncidentRecords():ChronologyRecord[];
  appendChronologyRecord(record:ChronologyRecord):void;
  listErrorLessons():ErrorLesson[];
  upsertErrorLesson(lesson:ErrorLesson):void;
  productIncidentTransaction(work:()=>void):void;
}
const idPattern=/^[a-zA-Z0-9:_-]{3,120}$/;
const evidenceKinds=new Set(['regression','runtime','e2e','inbound','response','delivery','dedup','off','observation']);
const textKeys=['summary','cause','impact','lesson','preventiveRule','change'] as const;
function object(v:unknown):Record<string,unknown> {
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('incident_object_invalid');
  return v as Record<string,unknown>;
}
function only(v:Record<string,unknown>,keys:readonly string[]) {
  if(Object.keys(v).some(k=>!keys.includes(k)))throw new Error('incident_fields_unexpected');
}
function iso(v:unknown) {return typeof v==='string'&&Number.isFinite(Date.parse(v));}
function safeText(v:unknown):v is string {
  return typeof v==='string'&&v.trim().length>0&&v.length<=1800
    &&!/Bearer\s+[a-z0-9._-]+|(?:sk-|sb_secret_|ghp_|github_pat_)[a-z0-9_-]{8,}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?[0-9][0-9 ()-]{9,}[0-9]/i.test(v);
}
function hash(value:unknown):string {
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical)
    :v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function parseProductIncidentFeed(value:unknown,productId:string):ProductIncidentFeed {
  const f=object(value);
  only(f,['schemaVersion','productId','revision','updatedAt','incidents']);
  if(f.schemaVersion!==1||f.productId!==productId||!idPattern.test(productId)
    ||!Number.isSafeInteger(f.revision)||Number(f.revision)<1||!iso(f.updatedAt)
    ||!Array.isArray(f.incidents)||f.incidents.length>500)throw new Error('incident_feed_invalid');
  const seen=new Set<string>();
  for(const raw of f.incidents) {
    const i=object(raw);
    only(i,['id','revision','productId','fingerprint','occurredAt','updatedAt','severity','status','summary','causeStatus','cause','impact','lesson','preventiveRule','change','requiredEvidence','evidence']);
    if(typeof i.id!=='string'||!idPattern.test(i.id)||seen.has(i.id)||i.productId!==productId
      ||typeof i.fingerprint!=='string'||!idPattern.test(i.fingerprint)
      ||!Number.isSafeInteger(i.revision)||Number(i.revision)<1||!iso(i.occurredAt)||!iso(i.updatedAt)
      ||Date.parse(String(i.occurredAt))>Date.parse(String(i.updatedAt))
      ||Date.parse(String(i.updatedAt))>Date.parse(String(f.updatedAt))
      ||!['low','medium','high','critical'].includes(String(i.severity))
      ||!['open','mitigated','resolved'].includes(String(i.status))
      ||!['confirmed','investigating'].includes(String(i.causeStatus))
      ||textKeys.some(k=>!safeText(i[k])))throw new Error('incident_invalid');
    seen.add(i.id);
    if(!Array.isArray(i.requiredEvidence)||!i.requiredEvidence.length||!i.requiredEvidence.every(k=>evidenceKinds.has(String(k)))
      ||!Array.isArray(i.evidence)||i.evidence.length>20)throw new Error('incident_evidence_invalid');
    for(const rawProof of i.evidence) {
      const proof=object(rawProof);
      only(proof,['kind','ref','verified']);
      if(!evidenceKinds.has(String(proof.kind))||typeof proof.ref!=='string'||typeof proof.verified!=='boolean')throw new Error('incident_evidence_invalid');
      const u=new URL(proof.ref);
      if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.search||u.hash)throw new Error('incident_evidence_url_invalid');
    }
    const proofs=i.evidence as unknown as IncidentEvidence[];
    if(i.status==='resolved'&&(i.causeStatus!=='confirmed'||i.requiredEvidence.some(k=>!proofs.some(p=>p.kind===k&&p.verified))))throw new Error('incident_closure_evidence_missing');
  }
  return f as unknown as ProductIncidentFeed;
}
function latestIncidents(records:ChronologyRecord[],productId?:string):Map<string,ProductIncident> {
  const items=new Map<string,ProductIncident>();
  for(const record of records) {
    const item=record.metadata?.incident as ProductIncident|undefined;
    if(!item||(productId&&item.productId!==productId))continue;
    const key=item.productId+':'+item.id;
    if((items.get(key)?.revision??0)<item.revision)items.set(key,item);
  }
  return items;
}
export function ingestProductIncidents(input:{
  store:IncidentMemoryStore;feed:unknown;productId:string;sourceRef:string;at:string;sourceMode:'snapshot'|'repository';
}):{imported:number;unchanged:boolean} {
  if(!iso(input.at)||!input.sourceRef.startsWith('https://github.com/'))throw new Error('incident_source_invalid');
  const feed=parseProductIncidentFeed(input.feed,input.productId);
  if(Date.parse(feed.updatedAt)>Date.parse(input.at)+60_000)throw new Error('incident_source_from_future');
  const records=input.store.listProductIncidentRecords();
  const checkpoint=records.filter(r=>r.subject==='product-incident-source:'+feed.productId)
    .sort((a,b)=>Number(b.metadata?.feedRevision??0)-Number(a.metadata?.feedRevision??0))[0];
  const feedHash=hash(feed);
  if(checkpoint) {
    const previousRevision=Number(checkpoint.metadata?.feedRevision??0);
    if(feed.revision<previousRevision)throw new Error('incident_feed_rollback');
    if(feed.revision===previousRevision&&checkpoint.metadata?.feedChecksum!==feedHash)throw new Error('incident_feed_revision_conflict');
  }
  const current=latestIncidents(records,feed.productId);
  for(const existing of current.values()) {
    if(!feed.incidents.some(i=>i.id===existing.id))throw new Error('incident_history_cannot_disappear');
  }
  const changes:ProductIncident[]=[];
  for(const incident of feed.incidents) {
    const previous=current.get(incident.productId+':'+incident.id);
    if(previous&&incident.revision<previous.revision)throw new Error('incident_revision_rollback');
    if(previous&&incident.fingerprint!==previous.fingerprint)throw new Error('incident_fingerprint_changed');
    if(previous&&incident.revision===previous.revision) {
      if(hash(incident)!==hash(previous))throw new Error('incident_revision_conflict');
      continue;
    }
    changes.push(incident);
  }
  if(!changes.length&&checkpoint&&Number(checkpoint.metadata?.feedRevision)===feed.revision)return {imported:0,unchanged:true};
  input.store.productIncidentTransaction(()=>{
    const ledger=new ErrorLedger(input.store.listErrorLessons());
    for(const incident of changes) {
      const previous=current.get(incident.productId+':'+incident.id);
      const fingerprint=incident.productId+':'+incident.fingerprint;
      const lessonInput={
        id:incident.productId+':'+incident.id,fingerprint,at:input.at,
        error:incident.summary,cause:incident.causeStatus==='confirmed'?incident.cause:'Causa por confirmar: '+incident.cause,
        impact:incident.impact,lesson:incident.lesson,preventiveRule:incident.preventiveRule,solutions:[incident.change],
        change:incident.change,verification:'Estado reportado por la fuente: '+incident.status+'. Evidencias: '+incident.evidence.map(e=>e.ref).join(' '),
        // Repository input is operational DATA. It never independently verifies a runtime or grants authority.
        verified:false,
      };
      const existingLesson=ledger.list().find(l=>l.fingerprint===fingerprint);
      if(previous&&existingLesson)ledger.merge({...existingLesson,...lessonInput});
      else ledger.record(lessonInput);
      const lesson=ledger.list().find(l=>l.fingerprint===fingerprint)!;
      input.store.upsertErrorLesson(lesson);
      input.store.appendChronologyRecord({
        id:'product-incident:'+incident.productId+':'+incident.id+':r'+incident.revision,
        sessionId:'product-incidents',at:input.at,kind:'lesson',
        subject:'product-incident:'+incident.productId+':'+incident.id,status:'current',
        content:incident.summary+' [fuente: '+incident.status+'; causa: '+incident.causeStatus+']',
        metadata:{incident,sourceRef:input.sourceRef,authority:'data-only',feedRevision:feed.revision,recurrenceCount:lesson.recurrenceCount},
      });
      current.set(incident.productId+':'+incident.id,incident);
    }
    if(!checkpoint||Number(checkpoint.metadata?.feedRevision)!==feed.revision) {
      input.store.appendChronologyRecord({
        id:'product-incident-feed:'+feed.productId+':r'+feed.revision,sessionId:'product-incidents',
        at:input.at,kind:'lesson',subject:'product-incident-source:'+feed.productId,status:'current',
        content:'Registro de incidencias recibido; no certifica operación del producto.',
        metadata:{productId:feed.productId,feedRevision:feed.revision,feedChecksum:feedHash,sourceRef:input.sourceRef,sourceMode:input.sourceMode,authority:'data-only'},
      });
    }
  });
  return {imported:changes.length,unchanged:changes.length===0};
}
export interface IncidentReadResult {content:string;sourceRef:string}
export type IncidentReader=(source:IncidentSource)=>Promise<IncidentReadResult>;
type SyncState={lastSuccess?:string;lastAttempt?:string;error?:'needs_auth'|'source_unavailable'|'invalid_source'};
export class ProductIncidentSync {
  private readonly states=new Map<string,SyncState>();
  private inFlight:Promise<void>|undefined;
  private lastAttemptMs:number|undefined;
  constructor(private readonly options:{
    store:IncidentMemoryStore;sources:IncidentSource[];read:IncidentReader;
    now?:()=>Date;intervalMs?:number;maxStaleMs?:number;
  }) {
    if((options.intervalMs!==undefined&&(!Number.isSafeInteger(options.intervalMs)||options.intervalMs<=0))
      ||(options.maxStaleMs!==undefined&&(!Number.isSafeInteger(options.maxStaleMs)||options.maxStaleMs<=0)))throw new Error('incident_sync_window_invalid');
    const seen=new Set<string>();
    for(const source of options.sources) {
      if(!idPattern.test(source.productId)||seen.has(source.productId)||!source.name.trim())throw new Error('incident_source_registry_invalid');
      seen.add(source.productId);
      if(source.repository&&(!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(source.repository)||!source.ref||!source.path
        ||source.path.startsWith('/')||source.path.split('/').includes('..')))throw new Error('incident_source_registry_invalid');
    }
  }
  seed(productId:string,feed:unknown,sourceRef:string) {
    if(!this.options.sources.some(s=>s.productId===productId&&s.repository))throw new Error('incident_source_not_registered');
    const parsed=parseProductIncidentFeed(feed,productId);
    const knownRevision=Math.max(0,...this.options.store.listProductIncidentRecords()
      .filter(r=>r.subject==='product-incident-source:'+productId).map(r=>Number(r.metadata?.feedRevision??0)));
    if(knownRevision>=parsed.revision)return {imported:0,unchanged:true};
    return ingestProductIncidents({store:this.options.store,feed:parsed,productId,sourceRef,at:this.now().toISOString(),sourceMode:'snapshot'});
  }
  async refreshIfDue(force=false):Promise<void> {
    if(this.inFlight)return this.inFlight;
    const now=this.now();
    if(!force&&this.lastAttemptMs!==undefined&&now.getTime()-this.lastAttemptMs<(this.options.intervalMs??300_000))return;
    this.lastAttemptMs=now.getTime();
    this.inFlight=(async()=>{
      for(const source of this.options.sources.filter(s=>s.repository)) {
        const previous=this.states.get(source.productId)??{};
        const at=this.now().toISOString();
        try {
          const result=await this.options.read(source);
          if(Buffer.byteLength(result.content,'utf8')>512*1024)throw new Error('invalid_source');
          ingestProductIncidents({store:this.options.store,feed:JSON.parse(result.content) as unknown,productId:source.productId,sourceRef:result.sourceRef,at,sourceMode:'repository'});
          this.states.set(source.productId,{lastSuccess:at,lastAttempt:at});
        }catch(error) {
          const message=error instanceof Error?error.message:'';
          this.states.set(source.productId,{...previous,lastAttempt:at,error:message==='needs_auth'?'needs_auth':message==='source_unavailable'?'source_unavailable':'invalid_source'});
        }
      }
    })();
    try {await this.inFlight;}finally{this.inFlight=undefined;}
  }
  snapshot() {
    const now=this.now();
    const incidents=[...latestIncidents(this.options.store.listProductIncidentRecords()).values()]
      .sort((a,b)=>a.productId.localeCompare(b.productId)||a.id.localeCompare(b.id));
    return {
      observedAt:now.toISOString(),authority:'data-only',runtimeVerified:false,
      products:this.options.sources.map(source=>{
        const state=this.states.get(source.productId);
        const fresh=!!state?.lastSuccess&&now.getTime()-Date.parse(state.lastSuccess)<=(this.options.maxStaleMs??900_000);
        return {productId:source.productId,name:source.name,
          syncState:!source.repository?'not_connected':state?.error??(fresh?'current':state?.lastSuccess?'stale':'snapshot_only'),
          fresh:fresh&&!state?.error,lastSuccessfulSync:state?.lastSuccess??null,lastAttempt:state?.lastAttempt??null,
          source:source.repository?{repository:source.repository,ref:source.ref,path:source.path}:null,
          incidents:incidents.filter(i=>i.productId===source.productId),
        };
      }),
    };
  }
  planningContext() {
    const snapshot=this.snapshot();
    const priority={critical:0,high:1,medium:2,low:3};
    const all=snapshot.products.flatMap(p=>p.incidents);
    return {
      authority:'data-only',runtimeVerified:false,totalKnownIncidents:all.length,
      products:snapshot.products.map(({incidents,...product})=>({...product,knownIncidents:incidents.length,
        unresolved:incidents.filter(i=>i.status!=='resolved').length})),
      priorityIncidents:all.sort((a,b)=>Number(a.status==='resolved')-Number(b.status==='resolved')
        ||priority[a.severity]-priority[b.severity]||b.updatedAt.localeCompare(a.updatedAt)).slice(0,20),
    };
  }
  private now():Date {return this.options.now?.()??new Date();}
}
