'use strict';
/* Oraciones (orden del Founder, 24-nov-2026): textos íntegros, fuentes declaradas, espejo PWA idéntico y reglas de Kendra. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'lego', 'janus-oraciones', 'janus-oraciones.js');
const MIRROR = path.join(__dirname, '..', '..', '..', 'apps', 'pwa', 'approved-3d', 'janus-oraciones.js');
const load = (extra) => { const ctx = Object.assign({}, extra); ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx); return ctx.JanusOraciones; };

test('el espejo de la PWA es idéntico a la fuente única (sin copias divergentes)', () => {
  assert.strictEqual(fs.readFileSync(MIRROR, 'utf8'), fs.readFileSync(SRC, 'utf8'));
});

test('Padre Nuestro: arameo primero, luego hebreo, latín y español; sin griego; con fuente', () => {
  const o = load(), p = o.byId('pater');
  assert.deepStrictEqual([...o.langsOf('pater')], ['arc', 'he', 'la', 'es'], 'el Founder pidió arameo, hebreo y latín; el griego sobra');
  assert.deepStrictEqual([...o.langsFor('pater', 'founder')], ['arc', 'he', 'la', 'es']);
  assert.ok(!o.LANGS.el && !p.texts.el, 'sin griego');
  assert.match(p.texts.la.lines.join(' '), /^Pater noster, qui es in caelis,.*sed libera nos a malo\. Amen\.$/);
  assert.match(p.texts.he.lines[0], /^אָבִינוּ שֶׁבַּשָׁמַיִם/);
  for (const l of ['arc', 'la', 'he', 'es']) assert.ok(p.texts[l].source, 'falta fuente en ' + l);
  assert.match(o.LANGS.he.note, /arameo/, 'la nota no debe presentar el hebreo como la lengua que hablaba Jesús');
});

test('arameo (Peshitta): original, transliteración, pronunciación y subtítulo alineados línea a línea', () => {
  const o = load(), a = o.byId('pater').texts.arc;
  assert.strictEqual(a.lines.length, 8);
  for (const k of ['translit', 'say', 'sub']) assert.strictEqual(a[k].length, a.lines.length, k + ' alineado');
  assert.match(a.lines[0], /^ܐܒ݂ܘܢ/); assert.match(a.translit[0], /^ʾăḇūn d-ḇa-šmayyā$/); assert.match(a.say[0], /^Abún dbashmayá/);
  assert.match(a.sub[0], /^Padre nuestro/); assert.strictEqual(a.sub.at(-1), 'Amén.');
  assert.match(a.source, /Peshitta/); assert.match(o.LANGS.arc.note, /más cercano/, 'no se presenta como las palabras exactas de Jesús');
  assert.deepStrictEqual([...o.langsFor('pater', 'kendra', true)], ['la', 'es'], 'Kendra no recibe arameo por defecto');
});

test('recitar con subtítulos: voz premium por línea, si falla la del aparato; marca cada línea y se puede parar', async () => {
  const spoken = [], played = [], lines = [];
  function Utt(text) { this.text = text; }
  function Audio(url) { this.url = url; played.push(url); this.play = () => { setTimeout(() => this.onended && this.onended(), 1); return Promise.resolve(); }; this.pause = () => {}; }
  const root = { speechSynthesis: { getVoices: () => [{ lang: 'es-ES' }], speak: (u) => { spoken.push(u); setTimeout(() => u.onend && u.onend(), 1); }, cancel() {} }, SpeechSynthesisUtterance: Utt, Audio, setTimeout: (f) => setTimeout(f, 0), clearTimeout };
  const o = load(root);
  let n = 0;
  const done = new Promise((resolve) => o.recite('pater', 'arc', { fetchAudio: async () => (++n <= 2 ? 'blob:' + n : null), onLine: (i) => lines.push(i), onEnd: resolve }));
  await done;
  assert.deepStrictEqual(lines, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepStrictEqual(played, ['blob:1', 'blob:2'], 'las dos primeras con voz premium');
  assert.strictEqual(spoken.length, 6, 'el resto con la voz del aparato');
  assert.strictEqual(spoken[0].lang, 'es-ES', 'el arameo se lee con pronunciación aproximada en voz española');
  assert.strictEqual(spoken[0].text, o.byId('pater').texts.arc.say[2]);
  assert.strictEqual(o.recite('angele', 'la', {}), null, 'sin subtítulos alineados no hay recitado línea a línea');
});

test('voz hebrea: acepta he-IL e iw-IL; sin voz hebrea no lee mal', () => {
  const mk = (voices) => { const spoken = []; const root = { speechSynthesis: { getVoices: () => voices, speak: (u) => spoken.push(u), cancel() {} }, SpeechSynthesisUtterance: function (t) { this.text = t; } }; return { o: load(root), spoken }; };
  let r = mk([{ lang: 'es-ES' }]);
  assert.strictEqual(r.o.hasVoice('he'), false);
  assert.strictEqual(r.o.speak('pater', 'he'), false);
  assert.strictEqual(r.spoken.length, 0);
  r = mk([{ lang: 'iw_IL' }]);
  assert.strictEqual(r.o.hasVoice('he'), true);
  assert.strictEqual(r.o.speak('pater', 'he'), true);
  assert.strictEqual(r.spoken[0].lang, 'he-IL');
});

test('Ángel de la Guarda y San Miguel en latín (su lengua original), con pronunciación y traducción', () => {
  const o = load();
  for (const id of ['angele', 'miguel']) {
    const p = o.byId(id);
    assert.strictEqual(p.original, 'la');
    assert.ok(p.texts.la.say && p.texts.la.say.length === p.texts.la.lines.length, id + ': una línea de pronunciación por verso');
    assert.ok(p.texts.es, id + ': falta la traducción');
  }
});

test('sin caracteres invisibles ni letras de otro alfabeto colados', () => {
  const s = fs.readFileSync(SRC, 'utf8');
  assert.ok(!/[​‌‍﻿]/.test(s), 'caracteres de anchura cero');
  assert.ok(!/[Ѐ-ӿ]/.test(s), 'letras cirílicas');
});

test('Kendra: español por defecto; latín solo si ella lo pide; griego y hebreo nunca por defecto', () => {
  const o = load();
  assert.deepStrictEqual([...o.langsFor('pater', 'kendra', false)], ['es']);
  assert.deepStrictEqual([...o.langsFor('pater', 'kendra', true)], ['la', 'es']);
  assert.ok(!o.forAudience('kendra').some((p) => p.id === 'miguel'), 'San Miguel es para el Founder (orden de Jean)');
  assert.ok(o.forAudience('kendra').some((p) => p.kids), 'hay oraciones para niños');
  assert.deepStrictEqual([...o.langsFor('angel-nino', 'kendra', true)], ['es', 'la'], 'Ángel de mi guarda: latín opcional');
});

test('el dashboard del Founder la monta en el build y en las acciones', () => {
  const build = fs.readFileSync(path.join(__dirname, '..', 'build.cjs'), 'utf8');
  assert.ok(build.indexOf('lego/janus-oraciones/janus-oraciones.js') < build.indexOf('src/oraciones.js'));
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8'), /ORA_ACTS/);
});
