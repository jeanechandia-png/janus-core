'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const code = read('lego/janus-local-camera/janus-local-camera.js');

function createHarness(media) {
  const listeners = {document:{},window:{}};
  function element(tag) {
    const children=[];
    const node = {
      tagName:tag.toUpperCase(), className:'', textContent:'', isConnected:true,
      children, attributes:{},
      append(...elements){children.push(...elements);},
      setAttribute(name,value){this.attributes[name]=value;},
      addEventListener(name,handler){(this.events ||= {})[name]=handler;},
      remove(){this.isConnected=false;},
      focus(){this.focused=true;},
      pause(){this.paused=true;},
      play(){return Promise.resolve();},
      querySelector(selector){
        const stack=[this];
        while(stack.length){
          const current=stack.pop();
          if(selector==='video' && current.tagName==='VIDEO')return current;
          stack.push(...current.children);
        }
        return null;
      }
    };
    return node;
  }
  const document = {
    hidden:false, activeElement:null, body:element('body'),
    createElement:element,
    addEventListener(name,cb){listeners.document[name]=cb;}
  };
  const window={isSecureContext:true,addEventListener(name,cb){listeners.window[name]=cb;}};
  const ctx=vm.createContext({document,window,navigator:{mediaDevices:media}});
  vm.runInContext(code,ctx,{filename:'janus-local-camera.js'});
  return {c:window.JanusLocalCamera,document,window,listeners};
}
function stream() {
  const track={stopped:false,stop(){this.stopped=true;}};
  return {track, getTracks(){return [track];}};
}

test('camera never activates until user chooses Open, then explicitly stops tracks', async()=>{
  let calls=0;const mediaStream=stream();
  const h=createHarness({async getUserMedia(options){
    calls++;
    assert.equal(options.audio,false);
    assert.equal(options.video.facingMode,'user');
    return mediaStream;
  }});
  assert.equal(calls,0);
  assert.equal(h.c.state().active,false);
  const result=await h.c.open('kendra');
  assert.equal(result.ok,true);
  assert.equal(calls,1);
  assert.equal(h.c.state().active,true);
  assert.equal(h.document.body.children.length,1);
  const video=h.document.body.children[0].querySelector('video');
  assert.equal(video.srcObject,mediaStream);
  assert.equal(video.attributes.playsinline,'');
  h.c.close();
  assert.equal(mediaStream.track.stopped,true);
  assert.equal(h.c.state().active,false);
  assert.equal(h.c.state().visible,false);
});
test('screen hidden / pagehide always stop recording-capable camera tracks', async()=>{
  const s=stream(),h=createHarness({getUserMedia:async()=>s});
  await h.c.open('janus');
  h.document.hidden=true;
  h.listeners.document.visibilitychange();
  assert.equal(s.track.stopped,true);
  assert.equal(h.c.state().active,false);
  const s2=stream();
  const h2=createHarness({getUserMedia:async()=>s2});
  await h2.c.open('kendra');
  h2.listeners.window.pagehide();
  assert.equal(s2.track.stopped,true);
});
test('closing while Safari is requesting permission invalidates late media',async()=>{
  let complete;
  const p=new Promise(resolve=>{complete=resolve;});
  const h=createHarness({getUserMedia:()=>p});
  const pending=h.c.open('kendra');
  h.c.close();
  const s=stream();
  complete(s);
  const outcome=await pending;
  assert.equal(outcome.reason,'cancelled');
  assert.equal(s.track.stopped,true);
  assert.equal(h.c.state().active,false);
});
test('no camera access in insecure/unavailable context and no upload or storage',async()=>{
  const h=createHarness(null);
  h.window.isSecureContext=false;
  const status=await h.c.open('kendra');
  assert.equal(status.ok,false);
  assert.equal(status.reason,'unavailable');
  assert.match(h.document.body.children[0].children[0].children[3].textContent,/HTTPS/);
  h.c.close();
  assert.doesNotMatch(code,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bMediaRecorder\b|toDataURL|\.toBlob\(|localStorage|indexedDB/);
});
test('camera is a reusable component in both dashboards without false biometric claims',()=>{
  const build=read('build.cjs');
  const view=read('src/views.js');
  const child=read('src/companero.js');
  const app=read('src/app.js');
  assert.match(build,/lego\/janus-local-camera\/janus-local-camera\.js/);
  assert.match(build,/lego\/janus-local-camera\/janus-local-camera\.css/);
  assert.match(view,/localCameraOpen/);
  assert.match(app,/localCameraOpen:.*JanusLocalCamera\.open\('janus'\)/);
  assert.match(child,/cpCameraOpen:.*JanusLocalCamera\.open\('kendra'\)/);
  assert.match(view,/no realiza reconocimiento facial/);
  assert.match(child,/No graba, no identifica a nadie/);
  assert.ok(build.indexOf("'lego/janus-local-camera/janus-local-camera.js'")<build.indexOf("'src/companero.js'"));
});
