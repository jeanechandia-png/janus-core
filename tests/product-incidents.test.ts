import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProductIncidentSync,ingestProductIncidents,parseProductIncidentFeed} from '../packages/core/src/product-incidents.js';
import {SqliteStore} from '../packages/core/src/sqlite-store.js';
import {productIncidentReader} from '../packages/adapters/src/product-incident-reader.js';
const source={productId:'infinity-chatbox',name:'Infinity ChatBox',repository:'jeanechandia-png/infinity-chatbox-platform',ref:'fix/chatbox-visual-parity-20260927',path:'config/product-incidents.json'};
const fixture=()=>JSON.parse(readFileSync('config/product-incident-bootstrap.json','utf8')) as {sourceRef:string;feed:any};
const at='2026-11-12T00:00:00.000Z';
test('incident import survives restart and neither replay nor revision counts as recurrence',()=>{
 const dir=mkdtempSync(join(tmpdir(),'janus-incidents-'));
 try {
  let db=new SqliteStore(join(dir,'memory.db'));
  const input={store:db,feed:fixture().feed,productId:source.productId,sourceRef:fixture().sourceRef,at,sourceMode:'snapshot' as const};
  assert.equal(ingestProductIncidents(input).imported,3);
  assert.equal(ingestProductIncidents(input).imported,0);
  const first=db.listErrorLessons().find(l=>l.fingerprint.endsWith('operator-auth-transient-preview-callback'))!;
  assert.equal(first.recurrenceCount,1);
  const changed=fixture().feed;changed.revision=2;changed.incidents[0].revision=2;changed.incidents[0].change+=' Seguimiento técnico.';
  ingestProductIncidents({...input,feed:changed});
  assert.equal(db.listErrorLessons().find(l=>l.fingerprint===first.fingerprint)?.recurrenceCount,1);
  db.close();db=new SqliteStore(join(dir,'memory.db'));
  const sync=new ProductIncidentSync({store:db,sources:[source],read:async()=>{throw new Error('needs_auth');},now:()=>new Date(at)});
  assert.equal(sync.seed(source.productId,fixture().feed,fixture().sourceRef).imported,0,'old bundled knowledge must not roll back or crash a newer memory');
  assert.equal(sync.snapshot().products[0]?.incidents.length,3);
  const repeat=structuredClone(changed);repeat.revision=3;const item=structuredClone(repeat.incidents[0]);item.id='ICB-NEW-OCCURRENCE';item.revision=1;repeat.incidents.push(item);
  ingestProductIncidents({...input,store:db,feed:repeat});
  const escalated=db.listErrorLessons().find(l=>l.fingerprint===first.fingerprint)!;
  assert.equal(escalated.recurrenceCount,2);assert.equal(escalated.requiresProtectionReview,true);
  assert.equal(escalated.verified,false,'a source report never certifies runtime independently');
  db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('invalid, disappearing or rewritten incident reports preserve prior memory atomically',()=>{
 const db=new SqliteStore(':memory:');const f=fixture();
 const input={store:db,productId:source.productId,sourceRef:f.sourceRef,at,sourceMode:'snapshot' as const,feed:f.feed};
 ingestProductIncidents(input);const before=db.listProductIncidentRecords().length;
 for(const mutate of [
  (v:any)=>{v.productId='other-product';},
  (v:any)=>{v.incidents.pop();v.revision=2;},
  (v:any)=>{v.incidents[0].cause='rewritten without revision';},
  (v:any)=>{v.incidents[1].status='resolved';v.incidents[1].causeStatus='confirmed';},
  (v:any)=>{v.incidents[0].privateEmail='person@example.com';},
  (v:any)=>{v.revision=2;v.incidents[0].revision=2;v.incidents[0].requiredEvidence=['regression'];},
 ]) {const v=fixture().feed;mutate(v);assert.throws(()=>ingestProductIncidents({...input,feed:v}));assert.equal(db.listProductIncidentRecords().length,before);}
 assert.throws(()=>db.productIncidentTransaction(()=>{db.appendChronologyRecord({id:'should-rollback',sessionId:'product-incidents',at,kind:'lesson',subject:'rollback-test',content:'test',status:'current'});throw new Error('disk failure');}));
 assert.equal(db.listChronologyRecords().some(r=>r.id==='should-rollback'),false);
 db.close();
});
test('refresh is single-flight, reports stale/needs_auth, and preserves cached lessons',async()=>{
 const db=new SqliteStore(':memory:');let clock=Date.parse(at),calls=0,fail=false;
 const sync=new ProductIncidentSync({store:db,sources:[source,{productId:'other-product',name:'Other product'}],now:()=>new Date(clock),intervalMs:100,maxStaleMs:200,
 read:async()=>{calls++;if(fail)throw new Error('needs_auth');return {content:JSON.stringify(fixture().feed),sourceRef:fixture().sourceRef};}});
 sync.seed(source.productId,fixture().feed,fixture().sourceRef);
 assert.equal(sync.snapshot().products[0]?.syncState,'snapshot_only');
 await Promise.all([sync.refreshIfDue(),sync.refreshIfDue()]);assert.equal(calls,1);
 assert.equal(sync.snapshot().products[0]?.fresh,true);assert.equal(sync.snapshot().products[1]?.syncState,'not_connected');
 clock+=300;assert.equal(sync.snapshot().products[0]?.syncState,'stale');
 fail=true;await sync.refreshIfDue();
 assert.equal(sync.snapshot().products[0]?.syncState,'needs_auth');
 assert.equal(sync.snapshot().products[0]?.fresh,false);
 assert.equal(sync.snapshot().products[0]?.incidents.length,3);
 assert.equal(db.listErrorLessons().length,3);
 db.close();
});
test('reader uses the existing credential only for bounded GitHub GETs and does not fetch without it',async()=>{
 let calls=0;
 const noAuth=productIncidentReader({tokenProvider:async()=>undefined,fetchImpl:async()=>{calls++;throw new Error('must not fetch');}});
 await assert.rejects(()=>noAuth(source),/needs_auth/);assert.equal(calls,0);
 const read=productIncidentReader({tokenProvider:async()=>'fixture-only',fetchImpl:async(input,init)=>{
  calls++;const url=String(input);assert.match(url,/^https:\/\/api\.github\.com\/repos\/jeanechandia-png\/infinity-chatbox-platform\/contents\//);
  assert.match(url,/ref=fix%2Fchatbox-visual-parity-20260927/);
  assert.equal(init?.method,'GET');assert.equal(init?.redirect,'error');assert.ok(init?.signal);
  return Response.json({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(fixture().feed)).toString('base64'),sha:'a'.repeat(40)});
 }});
 const result=await read(source);
 assert.equal(parseProductIncidentFeed(JSON.parse(result.content),source.productId).incidents.length,3);
 assert.equal(calls,1);
});
