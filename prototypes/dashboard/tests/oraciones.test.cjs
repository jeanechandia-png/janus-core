'use strict';
/* Oraciones (orden del Founder, 24-nov-2026): textos íntegros, fuentes declaradas, espejo PWA idéntico y reglas de Kendra. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'lego', 'janus-oraciones', 'janus-oraciones.js');
const MIRROR = path.join(__dirname, '..', '..', '..', 'apps', 'pwa', 'approved-3d', 'janus-oraciones.js');
const load = () => { const ctx = {}; ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx); return ctx.JanusOraciones; };

test('el espejo de la PWA es idéntico a la fuente única (sin copias divergentes)', () => {
  assert.strictEqual(fs.readFileSync(MIRROR, 'utf8'), fs.readFileSync(SRC, 'utf8'));
});

test('Padre Nuestro en latín, griego, hebreo y español, con fuente', () => {
  const o = load(), p = o.byId('pater');
  assert.deepStrictEqual([...o.langsOf('pater')].sort(), ['el', 'es', 'he', 'la']);
  assert.match(p.texts.la.lines.join(' '), /^Pater noster, qui es in caelis,.*sed libera nos a malo\. Amen\.$/);
  assert.match(p.texts.el.lines[0], /^Πάτερ ἡμῶν/);
  assert.match(p.texts.he.lines[0], /^אָבִינוּ שֶׁבַּשָׁמַיִם/);
  for (const l of ['la', 'el', 'he', 'es']) assert.ok(p.texts[l].source, 'falta fuente en ' + l);
  assert.strictEqual(p.original, 'el', 'el original escrito del Padre Nuestro es el griego');
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
