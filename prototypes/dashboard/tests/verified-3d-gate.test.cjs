'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const BASE=path.resolve(__dirname,'..');
const G=require('../tools/verified-creature-glb.cjs');
const get=(p)=>fs.readFileSync(path.join(BASE,p),'utf8');
test('model registry cannot claim hyperrealism before ORIGINAL GLBs and human signoff',()=>{
  const r=G.collect({strict:false});
  assert.deepEqual(Object.keys(r.models),[],'fixture models and procedural shapes never become approved');
  assert.equal(r.complete,false);
  assert.ok(!r.errors.length);
  assert.throws(()=>G.collect({strict:true}),/No se publican criaturas 3D finales/);
  assert.deepEqual(G.IDS,['lumi','bombo','musgo','nimbo']);
  assert.deepEqual(JSON.parse(get('assets/approved/models/REGISTRY.json')).characters,{});
});
test('GLB binary schema is parsed and rejects non-GLB/source-less evidence',()=>{
  const complete=fs.readFileSync(path.join(BASE,'tests/fixtures/contrato-completo.glb'));
  const parsed=G.parseGLB(complete);
  assert.equal(parsed.asset.version,'2.0');
  const report=G.inspectGLB(complete);
  assert.ok(report.triangles>0);
  assert.ok(report.clips>=6,'fixture animates, but it is not an approved creature');
  assert.ok(report.morphTargets>=8,'fixture expressions, not visual fidelity');
  assert.throws(()=>G.parseGLB(Buffer.from('bad file')),/GLB no aprobado/);
  assert.throws(()=>G.checkApproved('lumi',null,{}),/aprobación vigente ausente/);
  assert.throws(()=>G.checkApproved('unknown',null,{}),/identificador/);
});
test('bundler and runtime load only hash-verified real models in independent A/B',()=>{
  const build=get('build.cjs'), boot=get('lego/janus-creature-slot/janus-approved-glb-bootstrap.js');
  const companion=get('src/companero.js'),gate=get('tools/verified-creature-glb.cjs');
  assert.ok(build.includes("approvedModels.errors.length"));
  assert.ok(build.includes("const APPROVED_GLBS="));
  assert.ok(build.includes("janus-approved-glb-bootstrap.js"));
  assert.ok(boot.includes('JanusCreatureSlot') && boot.includes("checked.level!=='ok'"));
  assert.ok(boot.includes('slot.has(id)'),'do not overwrite personal GLBs');
  assert.ok(boot.includes("item.quality!=='visual-approved-3d'"));
  assert.ok(boot.includes("window.crypto.subtle.digest('SHA-256',buf)"));
  assert.ok(companion.includes('JanusApproved3D.install()'));
  assert.ok(companion.includes('C.userSelectedVisualMode = true'));
  for(const name of ['root','jaw','eye_L','eye_R','sock_head','sock_face','mouth_open','blink_L','blink_R','saluda','camina'])
    assert.ok(gate.includes(name),'mandatory rig contract '+name);
  assert.ok(gate.includes("entry.visualReview.iphoneSafari==='passed'"));
  assert.ok(gate.includes("entry.approvedBy==='Jean'"));
});
