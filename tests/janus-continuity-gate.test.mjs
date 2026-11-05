import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {auditFeatures,CORE_FEATURES,PENDING_SURFACES,gitAncestry} from '../scripts/janus-continuity-gate.mjs';

test('every required surface is declared once and has a real marker',()=>{
  const ids=CORE_FEATURES.map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.includes('main.infinity-connect-interpreter'));
  assert.ok(ids.includes('claude.authenticated-voice'));
  assert.ok(ids.includes('claude.business-knowledge'));
  assert.ok(ids.includes('core.voice-studio'));
  assert.ok(PENDING_SURFACES.some(x=>x.pr===63),'dashboard changes remain separate until approved merge');
  assert.ok(CORE_FEATURES.every(x=>x.paths.every(v=>v.length===2 && v[1].length>3)));
});
test('missing or replaced feature rejects candidate instead of silently claiming continuity',()=>{
  const root=mkdtempSync(join(tmpdir(),'janus-continuity-'));
  const features=[{id:'feature-merged-from-main',paths:[['modules/keeper.ts','runProtected()']]}];
  try{
    assert.equal(auditFeatures(root,features).ok,false);
    mkdirSync(dirname(join(root,'modules/keeper.ts')),{recursive:true});
    writeFileSync(join(root,'modules/keeper.ts'),'function notTheSame() {}');
    assert.equal(auditFeatures(root,features).ok,false);
    writeFileSync(join(root,'modules/keeper.ts'),'function runProtected() {}');
    assert.equal(auditFeatures(root,features).ok,true);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('release ancestry checker fails closed if main checkout is unavailable',()=>{
  const root=mkdtempSync(join(tmpdir(),'janus-nogit-'));
  try {
    const result=gitAncestry(root);
    assert.equal(result.ok,false);
    assert.match(result.reason,/origin\/main/);
  }finally{rmSync(root,{recursive:true,force:true});}
});