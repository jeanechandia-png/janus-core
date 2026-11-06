'use strict';
/* Regression: official Kendra art wins over procedural stand-ins.
 * The approved binary pack is optional in CI and required for full concept-sheet
 * fidelity. The repo's existing approved portraits remain an honest fallback.
 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),
  vm=require('node:vm'),path=require('node:path');
const read=(p)=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const presence=read('lego/janus-presence/janus-presence.js');
const companion=read('src/companero.js');
const build=read('build.cjs');
const css=read('src/companero.css');
const ids=['lumi','bombo','musgo','nimbo'];
function boot(hasPack) {
 const IMG={cLumi:'jpeg-lumi',cBombo:'jpeg-bombo',cMusgo:'jpeg-musgo',cNimbo:'jpeg-nimbo'};
 const APPROVED_ART={creatures:{},accessories:{}};
 if(hasPack) for(const id of ids) APPROVED_ART.creatures[id]='webp-'+id;
 const window={JanusCreatureSlot:{has:()=>false},matchMedia:()=>({matches:false})};
 const st={settings:{},comp:{creatureId:'lumi'}};
 vm.runInNewContext(presence,{window,ST:st,IMG,APPROVED_ART,compState:()=>st.comp});
 return window.JanusPresence;
}
test('creatures are exact approved original images when pack installed',()=>{
 const P=boot(true);
 for(const id of ids) assert.ok(P.render('kendra',false,id).includes('webp-'+id),id);
 assert.equal(P.current('founder'),'robot','founder Nexo not replaced by child art');
});
test('without art pack, existing approved portraits are still visible, no synthetic default',()=>{
 const P=boot(false);
 for(const id of ids)assert.ok(P.render('kendra',false,id).includes('jpeg-'+id),id);
 assert.ok(build.includes('const APPROVED_ART='));
 assert.ok(build.includes("crypto.createHash('sha256')"),'the exact founder-approved SHA is checked before embedding');
 assert.ok(build.includes("'data:image/webp;base64,' + bytes.toString('base64')"));;
});
test('official art is the only visible creature until validated photorealistic 3D exists',()=>{
 assert.ok(companion.includes("C.visualPolicyVersion !== '2026-11-06-approved-art-gate'"));
 assert.ok(companion.includes("if (C.userSelectedVisualMode !== true) C.visualMode = 'cinematic'"));
 assert.ok(companion.includes("C.visualMode = 'cinematic'"));
 assert.ok(companion.includes("const edge = false, cinematic = true, scene3d = false"));
 assert.ok(companion.includes("JanusPresence.render('kendra', false, C.creatureId)"));
 assert.ok(companion.includes("Arte original · modelo 3D hiperrealista pendiente de aprobación"));
 assert.ok(companion.includes("JanusEdgeCompanion.sync"),'existing renderer preserved as technical history');
 assert.ok(!companion.includes("if (C.tab === 'mundo') C.visualMode = '3d'"),
  'the learning/world tab cannot silently switch to unapproved procedural models');
});
test('official fashion art keeps real store identifiers, prices and purchase gating',()=>{
 assert.ok(companion.includes('cpArtIcon(it.key,it.icon)'));
 assert.ok(companion.includes('cpArtIcon(k,a.icon)'));
 assert.ok(companion.includes('cpArtIcon(k,o.icon)'));
 assert.ok(companion.includes("act(have ? 'cpNoop' : 'cpBuy'"));
 assert.ok(companion.includes('cp-approved-grid'));
 assert.ok(css.includes('.cp-approved-item'));
 assert.ok(css.includes('.cp-approved-grid'));
 assert.ok(css.includes('prefers-reduced-motion'));
 const engine=read('vendor/companion.js');
 const env=vm.createContext({});vm.runInContext(engine,env);
 const C=env.Companion;
 for(const key of ['out:capa-galaxia','out:sudadera-estrella','out:chaqueta-lujo','acc:cabeza:corona',
  'acc:cara:gafas-redondas','acc:espalda:mochila','acc:espalda:alas-hada','acc:cuello:bufanda'])
  assert.ok(C.kitShop.item(key),'exists as a real purchase: '+key);
});

test('original facial expressions are image-backed and trigger existing mood actions',()=>{
  assert.ok(build.includes('approvedExpressions'),'twelve samples packaged from the approved reference sheet');
  assert.ok(companion.includes('CP_APPROVED.expressions?.[C.creatureId]'));
  assert.ok(companion.includes("act('cpMood',mood"));
  assert.ok(companion.includes('cp-approved-faces'));
  assert.ok(css.includes('.cp-approved-expression'));
  const hashes=JSON.parse(read('assets/approved/INDEX.json')).required_assets;
  for(const id of ids) for(let i=1;i<=3;i++){
    const name='expression-'+id+'-'+i+'.webp';
    assert.match(hashes[name],/^[a-f0-9]{64}$/,'sha256 '+name);
  }
});
