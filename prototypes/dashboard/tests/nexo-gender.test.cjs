'use strict';
/* Nexo 02: identidad masculina/femenina verificable sin GPU ni red.
 * El test sí CONSTRUYE las dos mallas procedurales y ejercita el rig facial.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=(x)=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
function mockThree() {
 class V {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}setScalar(n){return this.set(n,n,n);}copy(p){return this.set(p.x,p.y,p.z);}}
 class Object3D {
  constructor(){this.children=[];this.position=new V();this.rotation=new V();this.scale=new V(1,1,1);this.userData={};this.visible=true;this.name='';}
  add(o){if(o.parent)o.parent.remove(o);this.children.push(o);o.parent=this;}
  remove(o){this.children=this.children.filter(v=>v!==o);o.parent=null;}
  traverse(fn){fn(this);this.children.forEach(c=>c.traverse(fn));}
 }
 class Group extends Object3D {}
 class Geometry {constructor(...args){this.args=args;this.disposed=false;}dispose(){this.disposed=true;}}
 class Color {constructor(value){this.value=value;}set(v){this.value=v;return this;}}
 class Material {constructor(opts){Object.assign(this,opts);this.color=new Color(opts.color);}dispose(){this.disposed=true;}}
 class Mesh extends Object3D{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true;}}
 return {
  Group, Mesh, MeshPhysicalMaterial:Material,MeshBasicMaterial:Material,
  SphereGeometry:Geometry,CylinderGeometry:Geometry,TorusGeometry:Geometry
 };
}
function boot3D() {
 const context=vm.createContext({window:{THREE:mockThree()}});
 vm.runInContext(read('lego/janus-nexo-3d/janus-nexo-3d.js'),context);
 return context.window.JanusNexo3D;
}
test('dos rigs Nexo plateados reales con ojos azules, articulaciones y proporciones separadas',()=>{
 const N=boot3D();
 assert.deepEqual(Array.from(N.VARIANTS),['masculino','femenino']);
 const m=N.build('masculino'),f=N.build('femenino');
 assert.equal(m.variant,'masculino');assert.equal(f.variant,'femenino');
 assert.notEqual(m.root,f.root);
 for(const r of [m,f]){
  const objs=[];r.root.traverse(o=>objs.push(o));
  assert.ok(objs.filter(o=>o.isMesh).length>100,'malla detallada');
  assert.ok(objs.some(o=>o.name==='Face silver'));
  assert.ok(objs.some(o=>o.name==='Iris sapphire'));
  assert.equal(objs.filter(o=>o.name.startsWith('Finger segment')).length,20,'dos manos articuladas');
  assert.ok(objs.some(o=>o.name.startsWith('Upper eyelid')));
  assert.ok(objs.some(o=>o.name==='Smiling lips'));
  assert.ok(r.sockets.Hand_L&&r.sockets.Hand_R,'sockets manos');
  assert.ok(r.sockets.Foot_L&&r.sockets.Foot_R,'sockets pies');
 }
 assert.notEqual(m.root.children[0].children[2]?.scale?.x,undefined);
 const fFace=f.root.children[0].children.find(o=>o.name==='Chest');
 const mFace=m.root.children[0].children.find(o=>o.name==='Chest');
 assert.ok(fFace&&mFace);
 const fShell=fFace.children.find(x=>x.name==='Chest shell');
 const mShell=mFace.children.find(x=>x.name==='Chest shell');
 assert.ok(fShell.scale.x<mShell.scale.x,'diferencias anatómicas definidas');
 const iris=m.eyeMaterials.iris;
 m.setLook({eyes:'#8EC8FF'});assert.equal(iris.color.value,'#8EC8FF');
 m.setLook({eyes:'invalid'});assert.equal(iris.color.value,'#8EC8FF','no permite color arbitrario');
 m.update(0,0.016,{pose:'saluda',mood:'alegre'});
 m.update(1,0.016,{pose:'habla',talk:true,mood:'sorprendido'});
 m.update(2,0.016,{pose:'piensa',mood:'pensativo'});
 assert.ok(Number.isFinite(m.head.rotation.y));
 m.dispose();f.dispose();
 const geometries=[];
 m.root.traverse(o=>{if(o.geometry)geometries.push(o.geometry);});
 assert.ok(geometries.every(x=>x.disposed),'sin fugas geometría');
});
test('el usuario selecciona y conserva variante en ST.settings; no altera Kendra ni voz',()=>{
 const settings={form:'robot',eyes:'#347DB8'},comp={creatureId:'lumi',names:{lumi:'Estrellita'}};
 const calls=[],J={
  FORMS:['robot','cabeza','cara'],variant:()=>calls.at(-1)?.v||'masculino',
  setVariant(v){calls.push({v});},setForm(f){this.form=f;},setEyes(e){this.eyes=e;},
  setLook(l){this.look=l;},react(){},setMood(){},mood:()=> 'contento'
 };
 let saved=0;
 const ST={settings,comp};
 const ctx=vm.createContext({window:{Janus3D:J,innerWidth:400,JanusCreatureSlot:{supported:()=>false}},
  ST,Janus3D:J,saveState:()=>saved++,act:(n,a,l)=>' data-act="'+n+'" data-arg="'+a+'"',
  esc:x=>String(x),gIco:()=>'',isPhone:()=>true,rerender:()=>{}});
 vm.runInContext(read('src/avatar.js'),ctx);
 assert.equal(vm.runInContext('avVariant()',ctx),'masculino');
 vm.runInContext('AV_ACTS.avVariant("femenino")',ctx);
 assert.equal(settings.nexoVariant,'femenino');
 assert.equal(J.form,'robot');assert.equal(calls.at(-1).v,'femenino');assert.equal(saved,1);
 assert.equal(comp.creatureId,'lumi');assert.equal(comp.names.lumi,'Estrellita');
 const html=vm.runInContext('avatarPanel()',ctx);
 assert.match(html,/Femenino/);
 assert.match(html,/robot-femenino|alta fidelidad/);
 vm.runInContext('AV_ACTS.avVariantNext()',ctx);
 assert.equal(settings.nexoVariant,'masculino');assert.equal(saved,2);
 vm.runInContext('AV_ACTS.avVariant("otro")',ctx);assert.equal(settings.nexoVariant,'masculino');
 assert.equal(vm.runInContext('AV_FORMS.some(x=>x[0]==="lumi")',ctx),false,'criaturas fuera del Founder');
});
test('render A/B mantiene la variante seleccionada de Nexo sin invadir el protagonista con el selector',()=>{
 const settings={nexoVariant:'femenino'},ST={settings,comp:{creatureId:'bombo'}};
 const ctx=vm.createContext({window:{},ST,IMG:{cLumi:'l',cBombo:'b',cMusgo:'m',cNimbo:'n'},compState:()=>ST.comp});
 vm.runInContext(read('lego/janus-presence/janus-presence.js'),ctx);
 for(const size of [false,true]){
  const html=vm.runInContext('JanusPresence.render("founder",'+size+')',ctx);
  assert.match(html,/data-nexo-variant="femenino"/);
  assert.match(html,/data-3d="bot"/);
  assert.doesNotMatch(html,/data-act="avVariant"/,'selector solo en configuración, no sobre la figura');
  assert.doesNotMatch(html,/>Masculino<|>Femenino</,'sin etiquetas gigantes sobre el robot');
  assert.doesNotMatch(html,/data-jpresence="bombo"/);
 }
 const glb=read('lego/janus-creature-slot/janus-creature-slot.js');
 assert.match(glb,/robot-femenino/);
 assert.match(glb,/sort\(\(a,b\)=>b\.length-a\.length\)/);
 const engine=read('lego/janus-3d/janus-3d.js');
 assert.match(engine,/JanusNexo3D/);
 assert.match(engine,/formKey: 'robot', formGen: -1/,'Nexo inicial sin seleccionar manualmente');
 assert.match(engine,/setVariant\(v\)/);
 assert.match(engine,/robot-femenino/);
 const build=read('build.cjs');
 assert.match(build,/janus-nexo-3d\/janus-nexo-3d.js/);
 const app=read('src/app.js');
 assert.doesNotMatch(app,/ROUTE\.v !== 'companero' && window\.Janus3D/);
});
