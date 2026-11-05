'use strict';
/* Test unitario de fibras 3D sin depender de GPU ni de una red. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.resolve(__dirname, '../lego/janus-fur-wind/janus-fur-wind.js'), 'utf8');
class V3 {
  constructor(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; }
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(o){return this.set(o.x,o.y,o.z);}
  clone(){return new V3(this.x,this.y,this.z);}
  fromBufferAttribute(a,i){return this.set(a.getX(i),a.getY(i),a.getZ(i));}
  addScaledVector(o,k){this.x+=o.x*k;this.y+=o.y*k;this.z+=o.z*k;return this;}
  multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this;}
  subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z);}
  crossVectors(a,b){return this.set(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z;}
  length(){return Math.sqrt(this.lengthSq());}
  normalize(){const l=this.length()||1;return this.multiplyScalar(1/l);}
}
class Q { setFromUnitVectors(){return this;} copy(){return this;} }
class O {
  constructor(){this.position=new V3();this.quaternion=new Q();this.scale=new V3(1,1,1);this.matrix={};}
  updateMatrix(){this.matrix={pos:this.position.clone(),scale:this.scale.clone()};}
}
class Color { constructor(c){this.v=c;} set(c){this.v=c;} }
class PhysicalMaterial{
  constructor(opts){Object.assign(this,opts);this.color=new Color(opts.color);this.sheenColor=new Color(opts.sheenColor);}
  dispose(){this.disposed=true;}
}
class ConeGeometry{constructor(r,h){this.radius=r;this.height=h;}translate(){return this;}dispose(){this.disposed=true;}}
class InstancedMesh {
  constructor(geo,mat,count){this.geometry=geo;this.material=mat;this.count=count;this.matrix=[];this.instanceMatrix={needsUpdate:false};this.isMesh=true;}
  setMatrixAt(i,m){this.matrix[i]=m;}
}
const THREE = {Vector3:V3,Quaternion:Q,Object3D:O,ConeGeometry,MeshPhysicalMaterial:PhysicalMaterial,DoubleSide:2,InstancedMesh};
const ctx={window:{THREE,matchMedia:()=>({matches:false})},navigator:{deviceMemory:4}};
vm.runInNewContext(src,ctx,{filename:'janus-fur-wind.js'});
const Fur=ctx.window.JanusFurWind;

test('tier mobile y degradacion sin THREE',()=>{
  assert.equal(Fur.supported(),true);
  ctx.window.matchMedia=()=>({matches:true});
  assert.equal(Fur.tier(),'mobile');
  ctx.window.matchMedia=()=>({matches:false});
});
test('triangulos muestreados, hebras fisicas, shader de viento y liberacion',()=>{
  const vecAttr=(v)=>({count:v.length/3,getX:i=>v[i*3],getY:i=>v[i*3+1],getZ:i=>v[i*3+2]});
  const p=vecAttr([0,0,0, 1,0,0, 0,0,1, 1,0,0, 1,0,1, 0,0,1]);
  const n=vecAttr([0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0]);
  const parent={isMesh:true,uuid:'sample',geometry:{attributes:{position:p,normal:n},index:null},items:[],add(x){this.items.push(x);},remove(x){this.items=this.items.filter(v=>v!==x);}};
  const coat=Fur.attach(parent,{count:25,quality:'balanced',seed:'musgo-test',length:.12,color:'#55aa33'});
  assert.equal(coat.count,25);assert.equal(parent.items.length,1);
  assert.equal(parent.items[0].matrix.length,25);
  for(const m of parent.items[0].matrix){assert.ok(m.pos.x>=0&&m.pos.x<=1); assert.ok(m.pos.z>=0&&m.pos.z<=1);}
  let sh={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'};
  coat.material.onBeforeCompile(sh);
  assert.match(sh.vertexShader,/uJanusFurWind/);
  assert.match(sh.vertexShader,/jTip \* jTip/);
  assert.match(sh.vertexShader,/uJanusFurLengthFactor/);
  assert.match(sh.vertexShader,/uJanusFurCurl/);
  coat.setStyle('esponjoso');
  assert.equal(sh.uniforms.uJanusFurLengthFactor.value,1.36,'pelo largo');
  assert.equal(sh.uniforms.uJanusFurCurl.value,0.2,'rizo suave');
  coat.setStyle('corto');
  assert.equal(sh.uniforms.uJanusFurLengthFactor.value,0.64,'pelo corto');
  coat.setStyle('otro');
  assert.equal(sh.uniforms.uJanusFurLengthFactor.value,1,'preset desconocido = natural');
  assert.match(sh.vertexShader,/instanceMatrix/);
  coat.update(7,0.6,0.3);
  assert.equal(sh.uniforms.uJanusFurWind.value,0.6);
  coat.update(8,8,0.8);
  assert.equal(sh.uniforms.uJanusFurWind.value,1,'wind clamped');
  coat.setColor('#aabbcc');assert.equal(coat.material.color.v,'#aabbcc');
  ctx.window.matchMedia=()=>({matches:true});
  coat.update(9,.8);
  assert.equal(sh.uniforms.uJanusFurWind.value,0,'reduced motion');
  coat.dispose();
  assert.equal(parent.items.length,0);assert.equal(coat.material.disposed,true);
  assert.equal(coat.mesh.geometry.disposed,true);
});
test('budgets no superan mobile y BOMBO no genera hebras',()=>{
  const c=fs.readFileSync(path.resolve(__dirname,'../lego/janus-creatures-3d/janus-creatures-3d.js'),'utf8');
  assert.match(c,/id !== 'bombo'/);
  assert.match(c,/R\.furCoats/);
  assert.match(c,/coat\(torso/);
  assert.match(c,/R\.parts\.moss\.children/);
  assert.match(c,/R\.parts\.puffs\.forEach/);
  const stage=fs.readFileSync(path.resolve(__dirname,'../lego/janus-stage-3d/janus-stage-3d.js'),'utf8');
  assert.match(stage,/setWind\(value\)/);
  assert.match(stage,/setFurStyle\(style\)/);
  assert.match(c,/R\.setFurStyle =/);
  assert.match(c,/R\.parts\.gills\.forEach/);
  assert.match(stage,/windYaw: cre\.yaw/);
  const companion=fs.readFileSync(path.resolve(__dirname,'../src/companero.js'),'utf8');
  assert.match(companion,/cpWind: \(v\)/);
  assert.match(companion,/st\.setWind/);
});
