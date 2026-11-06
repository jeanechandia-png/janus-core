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
 assert.ok(build.includes("has(rel) ? 'data:image/webp;base64,' + b64(rel) : null"));
});
test('migrate old procedural default to official art, but keep 3D as explicit optional mode',()=>{
 assert.ok(companion.includes('C.visualPolicyVersion !== 20261106'));
 assert.ok(companion.includes("if (!verifiedGLB) C.visualMode = 'cinematic'"));
 assert.ok(companion.includes('C.visualMode = \'cinematic\'')); 
 assert.ok(companion.includes('3D prueba'));
 assert.ok(companion.includes('Arte aprobado'));
 assert.ok(companion.includes('C.visualMode = \'3d\''),'interactive learning stage preserved');
 assert.ok(companion.includes("JanusEdgeCompanion.sync"));
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
