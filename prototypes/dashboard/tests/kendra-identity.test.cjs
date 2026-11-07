'use strict';
/* Identidad independiente: Kendra es la usuaria, no la hija del personaje o del Founder.
 * Las criaturas guardan alias y estilo por especie, sin tocar estrellas ni el dashboard adulto. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function setup() {
  let saved = 0, input = '', styles = [];
  const stage = { setFurStyle(v) { styles.push(v); }, react(){}, select(){}, apply(){}, sparkle(){}, setLook(){}, setCreature(){}, setWorld(){}, setMode(){}, setView(){} };
  const ST = { settings: { robot: true, presenceCreature: 'lumi' }, comp: { creatureId: 'lumi', level: 1, seed: 7, enc: { said: [], recent: [] }, alerts: [] } };
  const stageApi = { get: () => stage, supported: () => true };
  const context = vm.createContext({
    window: { JanusStage3D: stageApi, JanusCreatureSlot: null },
    JanusStage3D: stageApi,
    ST, IMG: { cLumi:'lumi.jpg',cBombo:'bombo.jpg',cMusgo:'musgo.jpg',cNimbo:'nimbo.jpg' },
    VIEWS: {}, TABS: [], UI: {}, document: { addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];} },
    esc(s) { return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]); },
    act: (action,arg) => ' data-act="'+action+'" data-arg="'+(arg || '')+'"',
    saveState: () => saved++,
    pad2: n => String(n).padStart(2,'0'),
    field: () => input,
    frame: () => '', rerender: () => {}, clearTimeout: () => {}, setTimeout: () => 1
  });
  vm.runInContext(read('vendor/companion.js'),context,{filename:'vendor/companion.js'});
  vm.runInContext(read('src/companero.js'),context,{filename:'src/companero.js'});
  return {
    eval: code => vm.runInContext(code,context),
    ST, getSaved:()=>saved,
    setInput: v => input=v,
    styles,
    render: () => vm.runInContext("tabVestidor(compProfile(), Companion.displayName(compProfile()))",context)
  };
}
test('perfil de Kendra: identidad propia, sin sustituir al adulto', () => {
  const o=setup();
  assert.equal(o.eval('compProfile().childName'),'Kendra');
  assert.equal(o.eval('compProfile().childId'),'kendra');
  assert.equal(o.eval('Companion.displayName(compProfile())'),'Lumi');
  assert.ok(!o.eval('COMP_UI.say').includes('__HIJA__'));
});
test('renombrar libremente cada criatura; persistencia separada y validación', () => {
  const o=setup();
  o.setInput('Estrellita');
  o.eval('COMP_ACTS.cpRenameWardrobe()');
  assert.equal(o.ST.comp.names.lumi,'Estrellita');
  assert.equal(o.eval('Companion.displayName(compProfile())'),'Estrellita');
  assert.match(o.eval('COMP_UI.say'),/Kendra/);
  assert.match(o.render(),/Estrellita/);
  o.eval("COMP_ACTS.cpPick('bombo')");
  assert.equal(o.eval('Companion.displayName(compProfile())'),'Bombo');
  o.setInput('Burbuja');
  o.eval('COMP_ACTS.cpRenameWardrobe()');
  assert.equal(o.ST.comp.names.bombo,'Burbuja');
  assert.equal(o.ST.comp.names.lumi,'Estrellita');
  o.setInput('');
  o.eval('COMP_ACTS.cpRenameWardrobe()');
  assert.equal(o.ST.comp.names.bombo,'Burbuja','entrada vacía no destruye identidad');
  assert.ok(o.getSaved()>=3);
});
test('personalización 3D por criatura, sin afectar su identidad ni estrellas', () => {
  const o=setup();
  o.eval('COMP_ACTS.cpStyle("esponjoso")');
  assert.equal(o.ST.comp.furStyles.lumi,'esponjoso');
  assert.equal(o.ST.comp.visualMode,'cinematic','cambiar pelo no sustituye las criaturas aprobadas por la malla procedural');
  o.eval("COMP_ACTS.cpVisual('edge')");
  assert.equal(o.ST.comp.visualMode,'edge','el modo de prueba 3D se mantiene disponible si se selecciona expresamente');
  assert.ok(o.styles.includes('esponjoso'));
  o.eval("COMP_ACTS.cpPick('bombo')");
  o.eval('COMP_ACTS.cpStyle("corto")');
  assert.equal(o.ST.comp.furStyles.lumi,'esponjoso');
  assert.equal(o.ST.comp.furStyles.bombo,'corto');
  assert.match(o.render(),/Forma de las branquias/);
  assert.match(o.render(),/Branquias naturales/);
  assert.equal(o.ST.comp.world,undefined,'no compra ni modifica estrellas');
  o.eval('COMP_ACTS.cpStyle("inexistente")');
  assert.equal(o.ST.comp.furStyles.bombo,'corto');
});
test('imagen aprobada en Kendra: usa nombre personalizado escapado', () => {
  const o=setup();
  o.setInput('Luna & Sol');
  o.eval('COMP_ACTS.cpRenameWardrobe()');
  const src=read('lego/janus-presence/janus-presence.js');
  assert.match(src,/Companion\.displayName\(compProfile\(\), id\)/);
  assert.match(src,/safeName/);
  assert.match(o.render(),/Luna &amp; Sol/);
  o.eval(src);
  const html = o.eval("window.JanusPresence.render('kendra', false, 'lumi')");
  assert.match(html,/Luna &amp; Sol/,'nombre personalizado en arte aprobado');
  assert.match(o.eval('COMP_UI.say'),/Kendra/);
});
test('el saludo de la criatura usa Kendra, no una relación parental', () => {
  const o=setup();
  o.eval('cpOnTapCreature()');
  assert.match(o.eval('COMP_UI.say'),/^¡Hola, Kendra!/);
  assert.doesNotMatch(o.eval('COMP_UI.say'),/hija|__HIJA__/i);
  o.eval("COMP_ACTS.cpGesture('saludo')");
  assert.match(o.eval('COMP_UI.say'),/Kendra/);
});

test('la cabecera muestra el alias elegido y la criatura usa iconografía 3D existente', () => {
  const o=setup();
  o.setInput('Estrellita');
  o.eval('COMP_ACTS.cpRenameWardrobe()');
  const source=read('src/views.js');
  const fn=source.match(/function janusTabName\(tab\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn,'helper de nombre dentro del encabezado existente');
  const name=vm.runInNewContext(fn + '\njanusTabName(["companero","\u{1F98A}","Lumi"])', {
    Companion:{displayName:()=>o.eval('Companion.displayName(compProfile())')},
    compProfile:()=>({})
  });
  assert.equal(name,'Estrellita','la cabecera no dice Compañero ni una especie fija');
  const cp=read('src/companero.js');
  assert.match(cp,/cpTabArt\(t\[1\]\)/,'iconos 3D en las pestañas actuales');
  assert.doesNotMatch(cp,/\['aprender', '\u{1F9EE}'/,'no emoji plano como icono principal');
  const mobile=read('src/phonev.js');
  assert.doesNotMatch(mobile,/JanusPresence\.render\('founder', false\)/,'no duplicar portada del robot');
});
test('Kendra usa la escena WebGL nativa cuando está disponible, conservando la elección manual',()=>{
  const o=setup();
  o.eval('window.JanusEdgeCompanion={supported:()=>true,react:()=>{}}; var JanusEdgeCompanion=window.JanusEdgeCompanion;');
  o.eval('compState().visualPolicyVersion=20261106');
  assert.equal(o.eval('compState().visualMode'),'edge');
  o.eval('COMP_ACTS.cpVisual("cinematic")');
  o.eval('COMP_ACTS.cpPick("bombo")');
  assert.equal(o.eval('compState().visualMode'),'cinematic','la elección explícita no es destruida');
});
