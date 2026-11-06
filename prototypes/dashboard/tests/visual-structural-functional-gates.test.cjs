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
  assert.match(kid, /const scene3d = Boolean\(ok3d && window\.JanusCreatureSlot\?\.has\?\.\(C\.creatureId\)\)/);
  assert.match(kid, /const cinematic = !scene3d, edge = false/);
  assert.match(kid, /JanusPresence\.render\('kendra', false, C\.creatureId\)/);
  assert.match(kid, /\[data-stage3d\]/);
  assert.match(kid, /JanusStage3D\.supported/);
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

test('visual: portada y pestañas comparten exactamente el atlas Gold 3D, sin iconos SVG planos', () => {
  const app=read('src/app.js');
  const phone=read('src/phonea2.js');
  const css=read('src/base.css');
  const build=read('build.cjs');
  assert.match(phone,/GOLD\.o\[n\]/);
  assert.match(views,/function detailIcon\(glyph, route\)/);
  assert.match(views,/gIco\(id,'janus-icon-3d'\)/);
  assert.match(views,/detailIcon\(x\[1\],x\[0\]\)/);
  assert.match(views,/detailIcon\(t\[1\],id\)/);
  assert.match(views,/detailIcon\(e\)/);
  assert.match(app,/hydrateDetailIcons\(document\)/);
  assert.match(css,/#view \.janus-icon-art/);
  assert.match(build,/const GOLD = \{ wm: gw\('janus.webp'\)/);
  const panelIcons=[...views.matchAll(/panel\(\s*'[^']*'\s*,\s*'([^']+)'/g)].map(x=>x[1]);
  const mapMatch=views.match(/const DETAIL_ICONS = Object\.freeze\((\{[^\n]*\})\)/);
  assert.ok(mapMatch,'mapa de iconos compartidos declarado');
  const map=JSON.parse(mapMatch[1]);
  for (const icon of panelIcons) assert.ok(map[icon],'icono sin versión Gold: '+icon);
  const tabs=[...views.matchAll(/\['(clima|dia|familia|prioridades|janus|plataformas|ingresos|alcance|chatbots|contenido|clientes|datos)',\s*'[^']+'/g)];
  for(const t of tabs)assert.ok(map[t[1]],'tab sin versión Gold: '+t[1]);
});

test('estructural: Nexo sin selectores Masculino/Femenino superpuestos a su retrato', () => {
  const presence=read('lego/janus-presence/janus-presence.js');
  const avatar=read('src/avatar.js');
  assert.match(presence,/const approved3d = !!\(window\.JanusCreatureSlot\?\.has\?\.\(slotId\)\)/);
  assert.match(presence,/jnexo-voice-standby/);
  assert.match(presence,/data-3d="bot"/, 'solo rama de GLB validado');
  assert.doesNotMatch(presence, /class="jnexo-variants" role="group"/);
  assert.doesNotMatch(presence, /<span>' \+ vName/);
  assert.match(avatar,/AV_VARIANTS\.map/,'selector preservado en ajustes');
  assert.doesNotMatch(avatar,/act\('avVariantNext', '', 'Cambiar entre versión masculina/);
});


test('iPhone: escena de Kendra nunca supera los 390px por min-content heredado', () => {
  const css = read('src/companero.css');
  assert.ok(css.includes('grid-template-columns:minmax(0,1fr)!important'),
    'la escena debe encajar sin scroll horizontal del documento');
  assert.ok(css.includes('.vb-companero>.cpst3'));
  assert.ok(css.includes('.vb-companero>.cptabs'));
});

test('coherencia visual: seis pestañas de Kendra y tabs de Jean comparten objetos 3D', () => {
  const css = read('src/companero.css');
  const detail = read('src/views.css');
  assert.match(kid, /KENDRA_ICON_OBJECTS/);
  for (const key of ['school','sparkles','shopping-cart','sun','mic','lock'])
    assert.ok(kid.includes("'"+key+"'"), 'falta objeto Gold '+key);
  assert.ok(kid.includes('kendraTabIcon(t[0])'));
  assert.ok(kid.includes("gIco('smartphone'"));
  assert.ok(css.includes('cp-3d-icon'));
  assert.ok(css.includes('font:700 13px/1.25'), 'etiquetas infantiles legibles');
  assert.ok(detail.includes('#view .tb2 em') && detail.includes('font:700 12px/1.2'),
    'etiquetas interiores del Founder legibles');
});
