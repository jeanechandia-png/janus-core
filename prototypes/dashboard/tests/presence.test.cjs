'use strict';
/* Smoke test sin red ni navegador: contrato de presencia, alcance A/B, Kendra y móvil. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(D, p), 'utf8');
const src = read('lego/janus-presence/janus-presence.js');
const imgs = { cLumi: 'data:image/jpeg;base64,lumi', cBombo: 'data:image/jpeg;base64,bombo', cMusgo: 'data:image/jpeg;base64,musgo', cNimbo: 'data:image/jpeg;base64,nimbo' };
const state = { settings: {}, comp: { creatureId: 'bombo' } };
let saves = 0;
const window = { JanusCreatureSlot: { has: (id) => id === 'musgo' }, matchMedia: () => ({ matches: false }) };
const context = {
  window, IMG: imgs, ST: state, compState: () => state.comp,
  saveState: () => saves++
};
vm.runInNewContext(src, context, { filename: 'janus-presence.js' });
const P = window.JanusPresence;
assert.deepEqual(Array.from(P.IDS), ['lumi', 'bombo', 'musgo', 'nimbo']);
for (const id of P.IDS) {
  const html = P.render('kendra', false, id);
  assert.match(html, new RegExp('data-jpresence="' + id + '"'));
  assert.ok(html.includes('data:image/jpeg;base64,' + id), 'el arte aprobado de ' + id + ' debe estar incrustado');
  assert.ok(html.includes('aria-label'), 'accesibilidad');
}
assert.equal(P.current('kendra'), 'bombo', 'Kendra usa estado propio');
assert.equal(P.current('founder'), 'robot', 'El Founder usa a Nexo, no una criatura de Kendra');
for (const mode of [false, true]) {
  const html = P.render('founder', mode, 'musgo');
  assert.match(html, /data-janus-founder="nexo"/);
  assert.match(html, /data-3d="bot"/);
  assert.match(html, /Nexo/);
  assert.doesNotMatch(html, /data-jpresence="musgo"/);
}
P.actions.presenceNext();
assert.equal(P.current('founder'), 'robot', 'la accion heredada no cambia al robot');
assert.equal(P.current('kendra'), 'bombo', 'Kendra sigue aislada');
assert.equal(saves, 0, 'no se modifica ningun ajuste del Founder al cambiar identidad');
const code = [read('src/dash.js'), read('src/dash-b.js'), read('src/sala.js'), read('src/phonev.js')];
for (const [i, file] of code.entries()) assert.ok(file.includes("JanusPresence.render('founder'"), 'punto de montaje ' + i);
assert.ok(read('src/companero.js').includes("JanusPresence.render('kendra'"));
assert.ok(read('src/companero.js').includes("C.visualMode = '3d'"));
assert.ok(read('src/app.js').includes('JanusPresence.hydrate(document)'));
assert.ok(read('src/app.js').includes('JanusPresence.actions'));
assert.ok(read('build.cjs').includes("'lego/janus-presence/janus-presence.js'"));
assert.ok(read('build.cjs').includes("rd('lego/janus-presence/janus-presence.css')"));
assert.ok(read('lego/janus-presence/janus-presence.css').includes('prefers-reduced-motion:reduce'));
assert.ok(read('lego/janus-presence/janus-presence.css').includes('main>.jpresence--hero'));
console.log('PASS: JanusPresence (Nexo exclusivo del Founder, 4 criaturas Kendra, A/B y móvil)');
