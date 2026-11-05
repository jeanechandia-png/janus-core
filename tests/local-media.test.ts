import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalMediaToolAdapter } from '../packages/adapters/src/local-media-tool-adapter.js';
import { deterministicPlan } from '../packages/orchestrator/src/deterministic-planner.js';
import { actionRequiresFounderBiometric } from '../packages/core/src/authority.js';
import type { ProjectResourceRef, ProjectWorkspace } from '../packages/core/src/project-context.js';

function fixture() {
  const root=mkdtempSync(join(tmpdir(),'janus-media-'));
  const inbox=join(root,'inbox'), library=join(root,'library');
  mkdirSync(inbox,{recursive:true});
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(16,0)]);
  const project:ProjectWorkspace={
    id:'infinity',name:'Infinity Group',status:'active',
    createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z',createdBy:'founder',
  };
  const resources:ProjectResourceRef[]=[];
  const adapter=new LocalMediaToolAdapter({
    inboxRoot:inbox,libraryRoot:library,
    store:{
      getProjectWorkspace:id=>id===project.id?project:null,
      listProjectResources:()=>resources,
      upsertProjectResource:resource=>{resources.push(resource);},
    },
    now:()=>new Date('2026-11-05T21:00:00Z'),
  });
  const request=(action:string,fileName='banner.png',authorized=false,projectId='infinity')=>
    adapter.execute({tool:'media',action,input:{fileName,projectId},
      ...(authorized?{idempotencyKey:'media-test-key-123456',
        authorization:{privileged:true,principalId:'founder',
        authorityDecisionHash:createHash('sha256').update('test-permit').digest('hex')}}:{})},()=>{});
  return {root,inbox,library,png,adapter,resources,request,dispose:()=>rmSync(root,{recursive:true,force:true})};
}
test('orden de voz con nombre exacto prepara imagen y la etapa con Face ID',()=>{
 const plan=deterministicPlan('Janus, agrega la imagen banner.png al proyecto infinity');
 assert.ok(plan);
 assert.equal(plan.steps.length,2);
 assert.equal(plan.steps[0]!.tool,'media');
 assert.equal(plan.steps[0]!.action,'image.inspect');
 assert.equal(plan.steps[1]!.action,'image.stage.apply');
 assert.equal(plan.steps[1]!.requiresApproval,true);
 assert.equal(actionRequiresFounderBiometric('media.image.stage.apply'),true);
 const unknown=deterministicPlan('Janus, agrega una imagen al sitio');
 assert.ok(unknown);
 assert.equal(unknown.steps.length,1);
 assert.equal(unknown.steps[0]!.action,'images.list');
});
test('imagen local se verifica, registra en SQLite y nunca se publica sola',async()=>{
 const f=fixture();
 try {
  writeFileSync(join(f.inbox,'banner.png'),f.png);
  const available=await f.request('images.list');
  assert.equal(available.ok,true);
  assert.equal(available.output?.count,1);
  const inspect=await f.request('image.inspect');
  assert.equal(inspect.ok,true);
  assert.equal(inspect.output?.mimeType,'image/png');
  assert.equal(f.resources.length,0);
  const blocked=await f.request('image.stage.apply');
  assert.equal(blocked.ok,false);
  assert.equal(f.resources.length,0);
  const done=await f.request('image.stage.apply','banner.png',true);
  assert.equal(done.ok,true,done.error);
  assert.equal(done.output?.published,false);
  assert.equal(f.resources.length,1);
  assert.equal(f.resources[0]!.projectId,'infinity');
  assert.equal(f.resources[0]!.source,'local');
  assert.equal(f.resources[0]!.metadata?.stage,'local_review');
  assert.equal(f.resources[0]!.checksum,createHash('sha256').update(f.png).digest('hex'));
  assert.deepEqual(readFileSync(f.resources[0]!.sourceRef),f.png);
  const retry=await f.request('image.stage.apply','banner.png',true);
  assert.equal(retry.ok,true);
  assert.equal(retry.output?.unchanged,true);
  assert.equal(f.resources.length,1);
 } finally {f.dispose();}
});
test('sin imagen real, proyecto aprobado o firma biométrica no se registra ningún activo',async()=>{
 const f=fixture();
 try {
  assert.equal((await f.request('image.stage.apply','missing.png',true)).ok,false);
  writeFileSync(join(f.inbox,'banner.png'),Buffer.from('fake binary renamed to png'));
  assert.equal((await f.request('image.stage.apply','banner.png',true)).ok,false);
  writeFileSync(join(f.inbox,'banner.png'),f.png);
  assert.equal((await f.request('image.stage.apply','banner.png',true,'wrong-project')).ok,false);
  assert.equal((await f.request('image.stage.apply','../secret.png',true)).ok,false);
  const outside=join(f.root,'private.png');
  writeFileSync(outside,f.png);
  symlinkSync(outside,join(f.inbox,'outsider.png'));
  assert.equal((await f.request('image.stage.apply','outsider.png',true)).ok,false);
  assert.equal(f.resources.length,0);
 } finally {f.dispose();}
});
