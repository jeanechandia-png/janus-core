'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'lego/janus-pilot-camera/janus-pilot-camera.js'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function fixture() {
  const listeners = Object.create(null);
  let calls = 0, stops = 0, revoked = 0;
  const focus = { isConnected: true, focus() {} };
  const elements = [];
  function element(tag) {
    const els = new Map(), handlers = {};
    const el = {
      tagName: tag, hidden: false, isConnected: false,
      attributes: {}, handlers,
      setAttribute(k,v) { this.attributes[k]=v; },
      removeAttribute(k) { delete this.attributes[k]; },
      addEventListener(k, fn) { handlers[k]=fn; },
      remove() { this.isConnected = false; },
      focus() {},
      querySelector(selector) {
        if (!els.has(selector)) {
          const c = element(selector);
          if (selector === 'video') {
            c.videoWidth = 640; c.videoHeight = 480;
            c.play = async () => {}; c.pause = () => {}; c.srcObject = null;
          }
          els.set(selector,c);
        }
        return els.get(selector);
      }
    };
    elements.push(el);
    return el;
  }
  const document = {
    hidden:false,
    activeElement:focus,
    createElement:element,
    body:{appendChild(el){el.isConnected=true;}},
    addEventListener(k,fn){listeners['document:'+k]=fn;}
  };
  const mediaDevices = {
    async getUserMedia(req) {
      calls += 1;
      assert.equal(req.audio,false);
      const t={stop(){stops+=1;},readyState:'live'};
      return {getTracks:()=>[t]};
    }
  };
  const ctx = vm.createContext({
    document,
    navigator:{mediaDevices},
    window:{addEventListener(k,fn){listeners[k]=fn;}},
    URL:{revokeObjectURL(){revoked++;},createObjectURL(){return 'blob:mock';}},
    Image:function(){},Promise,Date,console
  });
  vm.runInContext(code,ctx,{filename:'janus-pilot-camera.js'});
  return {
    api:ctx.window.JanusPilotCamera,listeners,
    get calls(){return calls;},
    get stops(){return stops;},
    get revoked(){return revoked;},
    elements
  };
}

test('JANUS camera never starts on module load and rejects unknown scopes', async () => {
  const f=fixture();
  assert.equal(f.calls,0);
  assert.equal(f.api.open('other'),false);
  assert.equal(f.calls,0);
  assert.equal(f.api.state().active,false);
  assert.equal(f.api.state().localOnly,true);
});

test('Founder and Kendra require explicit open and keep isolated ephemeral sessions', async () => {
  const f=fixture();
  assert.equal(f.api.open('founder'),true);
  await new Promise(setImmediate);
  assert.equal(f.api.state().active,true);
  assert.equal(f.api.state().scope,'founder');
  assert.equal(f.api.state().live,true);
  assert.equal(f.calls,1);
  f.api.open('kendra');
  await new Promise(setImmediate);
  assert.equal(f.api.state().scope,'kendra');
  assert.equal(f.calls,2);
  assert.ok(f.stops>=1,'the Founder stream must stop before Kendra starts');
  assert.equal(f.api.state().photoReady,false);
  f.listeners.hashchange();
  assert.equal(f.api.state().active,false);
  assert.ok(f.stops>=2,'Kendra camera tracks must stop on route change');
});

test('camera remains in-memory and is never sent to chat attachments or API', () => {
  assert.doesNotMatch(code, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b/);
  assert.doesNotMatch(code, /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/);
  assert.doesNotMatch(code, /\bJanusAttach\s*\./);
  assert.match(code, /getUserMedia/);
  assert.match(code, /track\.stop\(\)/);
  assert.match(code, /URL\.revokeObjectURL/);
  assert.match(code, /image\/jpeg/);
  assert.match(code, /capture="environment"/);
  assert.match(code, /'kendra'/);
});

test('Both approved dashboards and Kendra use the SAME reusable camera, never a rebuilt UI', () => {
  const build=read('build.cjs'),app=read('src/app.js'),comp=read('src/companero.js');
  assert.match(build, /lego\/janus-pilot-camera\/janus-pilot-camera\.js/);
  assert.match(build, /lego\/janus-pilot-camera\/janus-pilot-camera\.css/);
  assert.match(app, /pilotCamera:\s*\(who\)/);
  assert.match(app, /ROUTE\.v !== 'companero'/);
  assert.match(app, /'founder'/);
  assert.match(comp, /act\('pilotCamera', 'kendra'/);
  assert.match(comp, /JanusChildSafety\.assess\(msg\)/);
  assert.ok(comp.indexOf('JanusChildSafety.assess(msg)') < comp.indexOf("Companion.companionTurn(p, msg, reply"),
    'the evidence safety gate must run before the normal chat response');
  assert.doesNotMatch(comp, /y avisa a papá/);
});

test('Sensitive child disclosures use adult-oriented guidance without saving raw text', () => {
  const safety=read('lego/janus-family-guide/janus-child-safety.js');
  const context=vm.createContext({window:{}});
  vm.runInContext(safety,context);
  const flagged=context.window.JanusChildSafety.assess('Quiero hacerme daño');
  assert.equal(flagged.notifyAdult,true);
  assert.equal(flagged.storeRawDisclosure,false);
  assert.equal(flagged.level,'urgent');
});
