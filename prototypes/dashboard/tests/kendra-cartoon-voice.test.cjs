'use strict';
/* Voces caricaturescas por criatura sin red ni GPU. Verifica navegador y adaptador. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'lego/janus-cartoon-voice/janus-cartoon-voice.js'),'utf8');
function fixture(withTTS=true) {
  let queue=[], cancelCount=0;
  const voices=[
    { name:'Helena ES',lang:'es-ES',localService:true },
    { name:'Mateo MX',lang:'es-MX',localService:true },
    { name:'Nube CO',lang:'es-CO',localService:true },
    { name:'Cloud Online',lang:'es-ES',localService:false },
    { name:'Olivia EN',lang:'en-US',localService:true }
  ];
  const speech = {
    getVoices(){return voices;},
    speak(u){queue.push(u);},
    cancel(){cancelCount++;queue=[];}
  };
  class Utterance {constructor(text){this.text=text;}}
  const window = withTTS ? {speechSynthesis:speech,SpeechSynthesisUtterance:Utterance} : {};
  const ctx=vm.createContext({window});
  vm.runInContext(source,ctx,{filename:'janus-cartoon-voice.js'});
  return {V:window.JanusCartoonVoice,voices,speech,get queued(){return queue;},get cancellations(){return cancelCount;}};
}
test('cada criatura tiene una voz de caricatura con prosodia y timbre lógico propios',()=>{
  const {V}=fixture();
  const ids=Object.keys(V.profiles);
  assert.deepEqual(ids,['lumi','bombo','musgo','nimbo']);
  const profiles=ids.map(id=>V.profile(id,'caricatura'));
  assert.deepEqual([...new Set(profiles.map(p=>p.pitch))].length,4);
  assert.deepEqual([...new Set(profiles.map(p=>p.rate))].length,4);
  assert.ok(profiles.every(p=>p.sample.includes('Kendra') && p.lang==='es-ES'));
  assert.ok(profiles.find(p=>p.id==='musgo').pitch<1,'Musgo más grave');
  assert.ok(profiles.find(p=>p.id==='lumi').pitch>1.5,'Lumi más aguda');
  assert.ok(profiles.find(p=>p.id==='bombo').rate>1.15,'Bombo salta al hablar');
  assert.ok(profiles.find(p=>p.id==='nimbo').rate<1,'Nimbo habla suave');
  assert.ok(V.styles.length>=3);
});
test('la voz selecciona español local si existe y permite estilos y emociones seguras',()=>{
  const f=fixture(), {V,voices}=f;
  const r=V.speak('¡Hola, Kendra!', 'lumi',{style:'traviesa',mood:'alegre'});
  assert.equal(r.ok,true);
  assert.equal(r.engine,'web-speech');
  assert.equal(f.queued.length,1);
  assert.equal(f.queued[0].lang.startsWith('es'),true);
  assert.equal(f.queued[0].voice.localService,true,'prefiere OS local');
  assert.ok(f.queued[0].pitch>V.profile('lumi','caricatura').pitch);
  assert.ok(f.queued[0].rate<=1.45);
  assert.equal(voices.includes(f.queued[0].voice),true);
  V.speak('<script>Hola</script>\u0000 Kendra','bombo');
  assert.equal(f.queued.length,1,'se cancela audio anterior antes de comenzar');
  assert.doesNotMatch(f.queued[0].text,/[<>\x00]/);
  V.speak('Triste, Kendra','nimbo',{mood:'triste'});
  assert.ok(f.queued[0].rate<V.profile('nimbo','caricatura').rate);
});
test('modo silencio bloquea autocomentarios, pero la prueba explícita permite escuchar',()=>{
  const f=fixture(), {V}=f;
  const muted=V.speak('Buenos días', 'musgo',{enabled:false});
  assert.equal(muted.ok,false);assert.equal(muted.reason,'muted');
  assert.equal(f.f.queued.length,0);
  const preview=V.preview('musgo',{enabled:false});
  assert.equal(preview.ok,true);
  assert.equal(f.f.queued.length,1);
  assert.match(f.f.queued[0].text,/Kendra/);
  V.stop();assert.equal(f.f.queued.length,0);
  assert.ok(f.cancellations>=2);
});
test('callbacks de sincronización facial y motor de voz reemplazable',()=>{
  const f=fixture(), {V}=f;
  let start=0,end=0,ids=[];
  V.speak('Hola', 'bombo',{onStart:(p)=>{start++;ids.push(p.id);},onEnd:()=>end++});
  f.f.queued[0].onstart();f.f.queued[0].onend();
  assert.equal(start,1);assert.equal(end,1);assert.deepEqual(ids,['bombo']);
  let adapterInput=null,calls=0;
  const adapter={speak(input){adapterInput=input;return 'played';},stop(){calls++;}};
  assert.equal(V.setAdapter({speak(){}}),false,'faltan acciones de cancelación');
  assert.equal(V.setAdapter(adapter),true);
  const r=V.speak('Hola Kendra','nimbo',{style:'dulce'});
  assert.equal(r.engine,'adapter');
  assert.equal(adapterInput.profile.id,'nimbo');
  assert.equal(adapterInput.profile.style,'dulce');
  assert.equal(adapterInput.text,'Hola Kendra');
  V.stop();assert.ok(calls>=1);
  V.setAdapter(null);
});
test('degradación sin TTS deja texto y controles intactos',()=>{
  const {V}=fixture(false);
  assert.equal(V.supported(),false);
  const r=V.speak('Hola','lumi');
  assert.equal(r.ok,false);
  assert.equal(r.reason,'unavailable');
  assert.ok(V.profile('lumi').label);
});
test('Kendra activa y guarda las voces por criatura; no cambia la voz de Janus Nexo',()=>{
  const src=fs.readFileSync(path.join(root,'src/companero.js'),'utf8');
  const founder=fs.readFileSync(path.join(root,'src/avatar.js'),'utf8');
  const build=fs.readFileSync(path.join(root,'build.cjs'),'utf8');
  assert.match(src,/JanusCartoonVoice/);
  assert.match(src,/C\.voiceStyles\[C\.creatureId\]/);
  assert.match(src,/cpVoiceStyle:/);
  assert.match(src,/cpVoicePreview:/);
  assert.match(src,/cpVoiceToggle:/);
  assert.match(src,/voiceEnabled/);
  assert.match(src,/Voz caricaturesca/);
  assert.match(src,/if \(st\) st\.setMood\(m, 7\)/);
  assert.doesNotMatch(founder,/JanusCartoonVoice/);
  assert.match(build,/lego\/janus-cartoon-voice\/janus-cartoon-voice.js/);
});
