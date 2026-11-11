import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = (p: string) => readFileSync(p, 'utf8');

test('PWA Jean y Kendra usan módulo canónico, sin pantallas paralelas', () => {
  const founder = source('apps/pwa/app.js');
  const kid = source('apps/pwa/kendra.js');
  const access = source('apps/pwa/dashboard-access.js');
  for (const script of [founder, kid, access]) {
    assert.match(script, /from '.\/approved-presence\.js'/);
    assert.match(script, /createApprovedStage/);
  }
  assert.match(kid, /createApprovedAssetControls\(\{ family: 'kendra' \}\)/);
  assert.doesNotMatch(kid, /creatureSvg\(/, 'las primitivas SVG no suplantan el diseño original');
  assert.match(kid, /document\.title = activeCreature \? `Kendra · \$\{activeCreature\.name\}` : 'Kendra'/);
  assert.match(kid, /pet \? `¡Hola, \$\{view\.profile\.displayName\}! Soy \$\{pet\.name\}/);
  assert.doesNotMatch(kid, /'Mi compañero'|tu compañero/);
  assert.match(source('apps/pwa/index.html'), /<h2 id="kendraTitle">Kendra<\/h2>/);
  assert.equal(JSON.parse(source('apps/pwa/kendra.webmanifest')).name, 'Kendra');
  assert.match(source('apps/pwa/kendra.html'), /<title>Kendra<\/title>/);
  assert.match(founder, /sessionToken\(\)/, 'importación del Founder protegida');
  assert.match(access, /mountInExistingHeader/, 'conservar interfaz existente');
});

test('bloqueo de identidad en arte exacto y rechazo de modelos falsos', () => {
  const asset = source('apps/pwa/approved-presence.js');
  assert.match(asset, /87d977714b2b2dc03f426151b731e0b3f1936be7e0d81c09108377bf4b1af5e3/);
  assert.match(asset, /fbb0ba9cf9923848600b866a0b31ecc44d17013e627024b7c5b566c09d78aeb1/);
  assert.match(asset, /4d21d78ab32c352a2207aa62043d32b52ef4971eede93051925b8c89b24861b1/);
  assert.match(asset, /sha256\(bytes\)/);
  assert.match(asset, /hash !== ref\.sha256/);
  assert.match(asset, /slot\.inspect\(bytes\)/);
  assert.match(asset, /report\.level !== 'ok'/);
  assert.match(asset, /visualApproval = 'pending'/);
  assert.match(asset, /Fotografía, no modelo 3D/);
  assert.doesNotMatch(asset, /fetch\(/, 'ni subida ni generación externa');
});

test('Three glTF preinstalado offline antes de JavaScript de cada app', () => {
  for (const html of ['apps/pwa/index.html', 'apps/pwa/kendra.html']) {
    const s = source(html);
    assert.ok(s.indexOf('/approved-3d/vendor/three-r160.min.js') < s.indexOf('/approved-3d/vendor/gltf-kit.js'));
    assert.ok(s.indexOf('/approved-3d/vendor/gltf-kit.js') < s.indexOf('/approved-3d/janus-creature-slot.js'));
    assert.ok(s.indexOf('/approved-3d/janus-creature-slot.js') < s.indexOf('type="module"'));
    assert.match(s, /approved-presence\.css/);
  }
  const sw = source('apps/pwa/sw.js');
  for (const path of ['/approved-presence.js', '/approved-presence.css',
    '/approved-3d/vendor/three-r160.min.js', '/approved-3d/vendor/gltf-kit.js',
    '/approved-3d/janus-creature-slot.js']) {
    assert.ok(sw.includes(path), 'no cachea ' + path);
  }
  assert.match(sw, /janus-shell-v15/);
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/, 'API privada no cacheada');
});

test('los controles nuevos no cambian los diseños ya aprobados en el repositorio', () => {
  const css = source('apps/pwa/approved-presence.css');
  assert.match(css, /\.janus-approved-stage/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /janus-3d-dialog/);
  const page = source('apps/pwa/dashboard-access.js');
  assert.match(page, /dialog\.showModal\(\)/);
  assert.doesNotMatch(page, /document\.body\.replaceChildren/);
});
