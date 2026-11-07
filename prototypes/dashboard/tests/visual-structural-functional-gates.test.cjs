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

test('visual: ni robot procedural rechazado, ni ojos/boca flotantes en las dashboards', () => {
  const presence=read('lego/janus-presence/janus-presence.js');
  const phone=read('src/phonea2.js');
  const robot=read('lego/janus-3d/janus-3d.js');
  assert.match(presence,/const approved3d = !!\(window\.JanusCreatureSlot\?\.has\?\.\(slotId\)\)/);
  assert.match(presence,/jnexo-voice-standby/);
  assert.match(phone,/const nexoApproved = !!window\.JanusCreatureSlot\?\.has\?\.\(nexoId\)/);
  assert.match(phone,/a2bot--voice/);
  assert.doesNotMatch(phone,/src="' \+ GOLD\.o\.bot/,'no insertar figura robot de bajo detalle');
  assert.match(robot,/j3d-no-approved-robot/,'no montar caras procedurales sin GLB');
});

test('visual: iconos sólo de objetos 3D e iconografía consistente en todos los módulos', () => {
  const phone=read('src/phonea2.js');
  const app=read('src/app.js');
  assert.match(phone,/const THREE_D_ICON_ALIASES/);
  assert.match(phone,/GOLD\.o\[key\]/);
  assert.match(phone,/const eIco = \(e\) => gIco\(/);
  assert.doesNotMatch(phone,/GOLD\.i\[n\] \? '<img/,'no usar moneda plana como fallback');
  assert.match(views,/function hydrateDetailIcons\(root\)/);
  assert.match(views,/\.cpc i,\.cpgr h4/);
  assert.match(app,/hydrateDetailIcons\(document\)/);
});

test('tipografía accesible en teléfono: títulos y etiquetas >= 13px', () => {
 const child=read('src/companero.css');
 const detail=read('src/views.css');
 const founder=read('src/phonea2.css');
 assert.match(child,/cptab em\{font:750 13px/);
 assert.match(detail,/tabs \.tb2 em\{font:750 13px/);
 assert.match(founder,/a2t span\{font:750 15px/);
});

test('visual: mismo acabado 3D animado en cada botón, tarjeta y pestaña A/B/Kendra',()=>{
 const css=read('src/tactile-premium.css');
 const js=read('src/tactile-premium.js');
 const build=read('build.cjs');
 for(const target of ['.j3d-touch','.j3d-card','.j3d-pressed','.j3d-lit',
   'perspective(', 'rotateY(', 'translateZ(', 'radial-gradient', 'rgb(var(--j3d-tone)'])
   assert.ok(css.includes(target),'falta acabado físico '+target);
 for(const variant of ['cobalt','amethyst','emerald','rose','teal','copper','indigo','gold'])
   assert.ok(css.includes('data-janus-tone="'+variant+'"'),'falta paleta '+variant);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/,'accesibilidad de teclado');
 assert.match(js,/MutationObserver/,'se aplica también tras navegar por pestañas');
 assert.match(js,/pointerdown/);
 assert.match(js,/pointerup/);
 assert.match(js,/keydown/);
 assert.match(js,/BUILD_PROFILE|\.cptab/);
 assert.ok(build.includes("'src/tactile-premium.css'"));
 assert.ok(build.includes("'src/tactile-premium.js'"));
 const vm=require('node:vm');
 assert.doesNotThrow(()=>new vm.Script(js),'sin errores de sintaxis en la interacción');
});
test('estructural: sin rediseñar ni duplicar dashboard; tipografía legible en todos los controles móviles',()=>{
 const css=read('src/tactile-premium.css');
 assert.match(css,/\.stage\.b \.j3d-touch/,'Platino conserva diseño propio');
 assert.match(css,/\.stage \.j3d-card/,'mismas tarjetas en todas las versiones');
 assert.match(css,/\.stage :is\(\.btn,\.btn2,\.tb2,\.cptab/);
 assert.match(css,/font-size:10\.6pt!important/,'botones más grandes en iPhone');
 assert.match(css,/min-height:33pt!important/,'44px físicos de altura táctil');
});

test('iPhone: seis pestañas 3D en cuadrícula legible 3×2, sin texto superpuesto',()=>{
 const css=read('src/tactile-premium.css');
 assert.match(css,/stage\.kendra-only #view \.cptb/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/stage\.kendra-only #view \.cptab\.j3d-touch em/);
 assert.match(css,/white-space:normal!important/);
 assert.match(css,/font-size:10\.7pt!important/);
});
