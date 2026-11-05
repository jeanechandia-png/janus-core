'use strict';
/* Verificacion determinista de ciclo de vida del avatar 3D del margen.
 * WebGL falso: prueba orquestacion, no calidad de rendering en GPU real. */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../lego/janus-edge-companion/janus-edge-companion.js'), 'utf8');
function fixture(failWebGL) {
  class Node {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.style = {}; this.attributes = {}; this.isConnected = true; this.hidden = false; }
    setAttribute(k,v) { this.attributes[k] = v; }
    addEventListener(k,fn) { this.listeners[k] = fn; }
    appendChild(x) { this.children.push(x); x.parentNode = this; x.isConnected = true; return x; }
    removeChild(x) { this.children = this.children.filter(c => c!==x); }
    setPointerCapture() {}
    getBoundingClientRect() { return {left:0,top:0,width:300,height:400}; }
    fire(k,v) { assert.ok(this.listeners[k], 'listener '+k); this.listeners[k](Object.assign({pointerId:1,clientX:110,clientY:150},v||{})); }
  }
  const document = { body: new Node('body'), hidden: false, createElement: (tag) => new Node(tag) };
  let rendererCount=0, now=0, renderCount=0, built=[], current=null, queued=new Map(), nextId=0, downs=0;
  const canvas = new Node('canvas');
  class Renderer {
    constructor() { if (failWebGL) throw Error('WebGL no disponible'); rendererCount++; this.domElement=canvas; }
    setClearColor(){} setPixelRatio(){} setSize(){} render(){renderCount++} dispose(){}
  }
  class Scene { add(){} remove(){} }
  class HemisphereLight { constructor(){} }
  class DirectionalLight { constructor(){this.position={set(){}};} }
  class Camera { constructor(){this.position={set(){}};}lookAt(){}updateProjectionMatrix(){} }
  const rigFor = id => {
    const r = {id, root:{position:{y:0},rotation:{y:0}}, updateCalls:[], style:null, detail:null,
      update(t,dt,ctl){this.updateCalls.push(ctl);},setLook(l){this.look=l;},
      setFurStyle(v){this.style=v;},setDetail(v){this.detail=v;},dispose(){this.disposed=true;}};
    built.push(r);current=r;return r;
  };
  const window = {
    THREE:{ WebGLRenderer:Renderer, Scene, HemisphereLight, DirectionalLight, PerspectiveCamera:Camera,ACESFilmicToneMapping:1,SRGBColorSpace:'srgb' },
    innerWidth:1200,innerHeight:850,devicePixelRatio:2,
    matchMedia:()=>({matches:false}),addEventListener(){},
    JanusCreatures3D:{build:rigFor},JanusCreatureSlot:{has:()=>false,rigFor:()=>null}
  };
  const ctx = vm.createContext({window,document,performance:{now:()=>now},
    requestAnimationFrame:fn=>{const id=++nextId;queued.set(id,fn);return id;},
    cancelAnimationFrame:id=>queued.delete(id)});
  vm.runInContext(src,ctx,{filename:'janus-edge-companion.js'});
  return {
    edge: window.JanusEdgeCompanion, document, canvas,
    get current(){return current;},get built(){return built;},
    count:()=>rendererCount, draws:()=>renderCount,
    advance(ms){now=ms;const a=queued.entries().next();assert.equal(a.done,false,'frame scheduled');queued.delete(a.value[0]);a.value[1](ms);},
    remaining:()=>queued.size
  };
}
test('el borde monta un único renderer transparente y conserva personalidad/ropa/peinado',()=>{
  const f=fixture(false), opts={active:true,id:'lumi',name:'Estrellita',look:{fur:'#ffffff',outfit:'capa'},
    style:'esponjoso',roam:true,side:'left',wind:0.4};
  assert.equal(f.edge.supported(),true);
  assert.equal(f.edge.sync(opts),true);
  assert.equal(f.count(),1);
  assert.equal(f.current.id,'lumi');
  assert.equal(f.current.style,'esponjoso');
  assert.equal(f.current.look.outfit,'capa');
  assert.equal(f.document.body.children.length,1);
  assert.equal(f.document.body.children[0].children[1].textContent,'Estrellita');
  f.advance(1000);f.advance(1100);
  assert.ok(f.draws()>=2);
  assert.match(f.document.body.children[0].style.transform,/translate3d/);
  f.edge.react('saluda',2,'alegre'); f.advance(1200);
  assert.equal(f.current.updateCalls.at(-1).pose,'saluda');
  assert.equal(f.current.updateCalls.at(-1).mood,'alegre');
  assert.equal(f.edge.sync({...opts,id:'bombo',name:'Burbuja',style:'corto'}),true);
  assert.equal(f.count(),1,'no se crea un segundo contexto WebGL');
  assert.equal(f.built[0].disposed,true);
  assert.equal(f.current.id,'bombo');
  assert.equal(f.current.style,'corto');
  f.edge.hide();assert.equal(f.edge.state().active,false);assert.equal(f.remaining(),0);
});
test('tocar y arrastrar por la pantalla genera callbacks sólo por gestos reales',()=>{
  const f=fixture(false);let taps=0,dock='';
  f.edge.sync({active:true,id:'musgo',name:'Roca',onTap:()=>taps++,onDock:s=>dock=s});
  f.canvas.fire('pointerdown',{clientX:80,clientY:120});
  f.canvas.fire('pointerup',{clientX:80,clientY:120});
  assert.equal(taps,1);
  f.canvas.fire('pointerdown',{clientX:80,clientY:120});
  f.canvas.fire('pointermove',{clientX:1080,clientY:230});
  f.canvas.fire('pointerup',{clientX:1080,clientY:230});
  assert.equal(taps,1,'arrastre no es saludo');
  assert.equal(dock,'right');
  assert.equal(f.edge.state().side,'right');
});
test('sin WebGL recupera la alternativa estática y no deja un bucle activo',()=>{
  const f=fixture(true);let fails=0;
  assert.equal(f.edge.sync({active:true,id:'lumi',onError:()=>fails++}),false);
  assert.equal(fails,1);
  assert.equal(f.edge.state().unavailable,true);
  assert.equal(f.remaining(),0);
});
test('Kendra predeterminada vive en el margen y Founder permanece robot Nexo',()=>{
  const companion=fs.readFileSync(path.join(__dirname,'../src/companero.js'),'utf8');
  const presence=fs.readFileSync(path.join(__dirname,'../lego/janus-presence/janus-presence.js'),'utf8');
  const build=fs.readFileSync(path.join(__dirname,'../build.cjs'),'utf8');
  assert.match(companion,/edgeSupported/);assert.match(companion,/JanusEdgeCompanion\.sync/);
  assert.match(companion,/cpEdgeRoam/);assert.match(companion,/cpEdgeSide/);
  assert.match(companion,/C\.visualMode = 'edge'/);
  assert.match(presence,/data-janus-founder="nexo"/);
  assert.match(build,/lego\/janus-edge-companion\/janus-edge-companion.js/);
  assert.match(build,/lego\/janus-edge-companion\/janus-edge-companion.css/);
});
