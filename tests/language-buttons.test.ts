import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error Browser ES module without .d.ts
import { LANGUAGES, currentLanguage, translations } from '../apps/pwa/language-buttons.js';

test('approved original app icon remains separate from the two language flags', () => {
  const founder = readFileSync('apps/pwa/index.html', 'utf8');
  const child = readFileSync('apps/pwa/companion.html', 'utf8');
  const jeanManifest = JSON.parse(readFileSync('apps/pwa/manifest.webmanifest', 'utf8'));
  const kendraManifest = JSON.parse(readFileSync('apps/pwa/companion.webmanifest', 'utf8'));
  assert.match(founder, /id="founderLanguageSwitch"/);
  assert.match(child, /id="companionLanguageSwitch"/);
  assert.ok(!founder.includes('flags/'));
  assert.match(founder, /\/icons\/janus-icon-180\.png/);
  assert.match(child, /\/icons\/janus-icon-180\.png/);
  assert.equal(jeanManifest.start_url, '/');
  assert.equal(kendraManifest.start_url, '/companion.html');
  assert.notEqual(jeanManifest.id, kendraManifest.id);
  for (const manifest of [jeanManifest, kendraManifest]) {
    assert.equal(manifest.icons[0].src, '/icons/janus-icon-192.png');
    assert.equal(manifest.icons[1].src, '/icons/janus-icon-512.png');
  }
});

test('language controls are exactly NL and ES and save independent choices', () => {
  assert.deepEqual(LANGUAGES.map((x: { code: string }) => x.code), ['nl', 'es']);
  const memory = new Map([['janus.language.founder', 'nl'], ['janus.language.companion', 'es']]);
  const storage = { getItem: (key: string) => memory.get(key) ?? null };
  assert.equal(currentLanguage('founder', storage), 'nl');
  assert.equal(currentLanguage('companion', storage), 'es');
  assert.equal(currentLanguage('not-set', storage), 'es');
  assert.equal(translations('founder','nl')['#sendButton'], 'Uitvoeren');
  assert.equal(translations('founder','es')['#sendButton'], 'Ejecutar');
  assert.equal(translations('companion','nl')['#chooseTitle'], 'Kies een personage');
});

test('existing flag artwork is embedded from local WebP copies (no CDN or emoji substitutes)', () => {
  const source = readFileSync('apps/pwa/language-buttons.js','utf8');
  const shell = readFileSync('apps/pwa/sw.js', 'utf8');
  for (const lang of ['nederland','espana']) {
    const file = 'apps/pwa/language-art/' + lang + '.webp.b64';
    const bytes = Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
    assert.equal(bytes.subarray(0,4).toString('ascii'), 'RIFF');
    assert.equal(bytes.subarray(8,12).toString('ascii'), 'WEBP');
    assert.ok(bytes.length > 1200);
    assert.match(source, new RegExp('/language-art/' + lang + '\\\\.webp\\\\.b64'));
    assert.ok(shell.includes("/language-art/" + lang + ".webp.b64"));
  }
  assert.ok(source.includes("data:image/webp;base64,"));
  assert.ok(!source.includes('https://'));
});

test('small tactile flags light up and display specular reflection without replacing dashboard CSS', () => {
  const css = readFileSync('apps/pwa/language-buttons.css','utf8');
  assert.match(css, /width:\s*44px/);
  assert.match(css, /height:\s*44px/);
  assert.match(css, /is-lit/);
  assert.match(css, /linear-gradient/);
  assert.match(css, /:active::after/);
  assert.match(css, /prefers-reduced-motion/);
  const owner = readFileSync('apps/pwa/app.js','utf8');
  const child = readFileSync('apps/pwa/companion.js','utf8');
  assert.match(owner, /mountLanguageButtons\(document\.querySelector\('#founderLanguageSwitch'\), 'founder'\)/);
  assert.match(child, /mountLanguageButtons\(q\('#companionLanguageSwitch'\), 'companion'\)/);
  for (const component of ['language-buttons.css','language-buttons.js','companion.webmanifest']) {
    assert.ok(readFileSync('apps/pwa/sw.js','utf8').includes("'/" + component + "'"));
  }
});
