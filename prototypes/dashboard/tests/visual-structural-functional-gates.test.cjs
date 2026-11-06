'use strict';
/* JANUS: three independent regression gates for the established Kendra QA page.
 * Static checks cannot certify photorealistic GLB or a physical iPhone session.
 * The visual gate prevents unapproved procedural models replacing original art.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const kid = read('src/companero.js');
const views = read('src/views.js');

test('visual: solo arte ya existente, nunca modelos 3D procedurales como sustitutos aprobados', () => {
  assert.match(kid, /const edge = false, cinematic = true, scene3d = false/);
  assert.match(kid, /JanusPresence\.render\('kendra', false, C\.creatureId\)/);
  assert.match(kid, /Arte original · modelo 3D hiperrealista pendiente de aprobación/);
  assert.match(kid, /C\.visualMode = 'cinematic'/);
  assert.doesNotMatch(kid, /C\.tab === 'mundo'\) C\.visualMode = '3d'/,
    'el mundo/las lecciones no deben activar un muñeco procedural automáticamente');
});

test('estructural: nombre real de la criatura en el encabezado existente, sin otra dashboard', () => {
  assert.match(kid, /name = Companion\.displayName\(p\)/);
  assert.match(kid, /return frame\('companero', sub, M, stage \+ panel3, name\)/);
  assert.match(views, /function frame\(id, sub, M, body, approvedTitle\)/);
  assert.match(views, /esc\(viewTitle\)/);
  assert.match(kid, /TABS\.push\(\['companero', '🦊', 'Mi criatura'\]\)/);
  assert.doesNotMatch(kid, /TABS\.push\(\['companero', '🦊', 'Compañero'\]\)/);
});

test('funcional: renombrar persiste por criatura, con lecciones, vestidor, tienda y cámara intactos', () => {
  assert.match(kid, /Companion\.renameCreature\(p, C\.creatureId/);
  assert.match(kid, /C\.names = p\.names/);
  assert.match(kid, /function compSave\(p\)/);
  assert.match(kid, /cpRenameWardrobe/);
  assert.match(kid, /'aprender'.*'vestidor'.*'tienda'.*'mundo'.*'hablar'.*'papa'/);
  assert.match(kid, /pilotCamera.*'kendra'/);
});
