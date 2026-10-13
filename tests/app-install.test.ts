import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error -- plain browser ES module without type declarations
import { APP_INSTALL_COPY, appInstallCopy, appInstallMode, isAppleTouchDevice } from '../apps/pwa/app-install.js';

test('install path: installed app hides, Chromium uses native prompt, iOS gets the guide', () => {
  assert.equal(appInstallMode({ standalone: true, ios: true, hasPrompt: true }), 'installed');
  assert.equal(appInstallMode({ standalone: false, ios: false, hasPrompt: true }), 'native');
  assert.equal(appInstallMode({ standalone: false, ios: true, hasPrompt: false }), 'ios-guide');
  assert.equal(appInstallMode({ standalone: false, ios: false, hasPrompt: false }), 'browser-guide');
});

test('iPhone and iPadOS (MacIntel + touch) are detected; desktop Mac is not', () => {
  assert.equal(isAppleTouchDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
  assert.equal(isAppleTouchDevice({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(isAppleTouchDevice({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(isAppleTouchDevice({ userAgent: 'Android' }), false);
});

test('copy exists for the ecosystem languages and falls back to Spanish', () => {
  for (const lang of ['es', 'en', 'nl', 'tr']) {
    const copy = APP_INSTALL_COPY[lang];
    assert.ok(copy.button && copy.close && copy.title.includes('{app}'));
    assert.equal(copy.ios.length, 2);
    assert.equal(copy.other.length, 2);
  }
  assert.equal(appInstallCopy('nl-NL', 'JANUS').title, 'Installeer JANUS');
  assert.equal(appInstallCopy('xx', 'JANUS').title, 'Instala JANUS');
});

test('PWA integrity: installable manifest fields and offline shell covers every local script', () => {
  const manifest = JSON.parse(readFileSync('apps/pwa/manifest.webmanifest', 'utf8'));
  for (const key of ['name', 'short_name', 'start_url', 'display', 'id', 'scope']) assert.ok(manifest[key], key);
  assert.equal(manifest.display, 'standalone');

  const html = readFileSync('apps/pwa/index.html', 'utf8');
  const app = readFileSync('apps/pwa/app.js', 'utf8');
  const sw = readFileSync('apps/pwa/sw.js', 'utf8');
  const referenced = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css|webmanifest))"/g)) referenced.add(match[1]!);
  for (const match of app.matchAll(/from '\.\/([^']+\.js)'/g)) referenced.add('/' + match[1]);
  assert.ok(referenced.has('/app-install.js'));
  for (const path of referenced) assert.ok(sw.includes(`'${path}'`), `service worker shell is missing ${path}`);

  assert.match(html, /data-app-install hidden/);
  assert.match(html, /apple-mobile-web-app-capable/);
});

test('regression: closed install sheet must not keep an invisible full-screen overlay', () => {
  const css = readFileSync('apps/pwa/styles.css', 'utf8');
  assert.match(css, /\.app-install-sheet\[hidden\][^{]*\{\s*display:\s*none\s*!important/);
});

test('Janus app icon: opaque PNGs at the declared sizes are wired in manifest, iOS head and offline shell', () => {
  const manifest = JSON.parse(readFileSync('apps/pwa/manifest.webmanifest', 'utf8'));
  const html = readFileSync('apps/pwa/index.html', 'utf8');
  const sw = readFileSync('apps/pwa/sw.js', 'utf8');
  for (const [size, file] of [[192, 'janus-icon-192.png'], [512, 'janus-icon-512.png']] as const) {
    assert.ok(manifest.icons.some((icon: { src: string; sizes: string }) => icon.src === `/icons/${file}` && icon.sizes === `${size}x${size}`), file);
  }
  assert.match(html, /rel="apple-touch-icon"[^>]*href="\/icons\/janus-icon-180\.png"/);
  for (const file of ['janus-icon-180.png', 'janus-icon-192.png', 'janus-icon-512.png']) {
    const png = readFileSync(`apps/pwa/icons/${file}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const size = Number(file.match(/(\d+)\.png/)![1]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.notEqual(png[25], 6, `${file} must not carry an alpha channel (iOS would paint it black/transparent)`);
    assert.ok(sw.includes(`/icons/${file}`), `${file} cached in offline shell`);
  }
});

test('living emblem: pose maps pointer to tilt/light, clamps, and is wired offline', async () => {
  // @ts-expect-error -- plain browser ES module without type declarations
  const { emblemPose } = await import('../apps/pwa/glow-emblem.js');
  const rect = { left: 100, top: 100, width: 80, height: 80 };
  assert.deepEqual(emblemPose(rect, { x: 140, y: 140 }), { x: 0.5, y: 0.5, rotateY: 0, rotateX: 0 });
  const corner = emblemPose(rect, { x: 180, y: 100 }, 14);
  assert.equal(corner.rotateY, 14);
  assert.equal(corner.rotateX, 14);
  const outside = emblemPose(rect, { x: 9999, y: -9999 }, 14);
  assert.equal(outside.x, 1);
  assert.equal(outside.y, 0);
  assert.ok(Math.abs(outside.rotateY) <= 14 && Math.abs(outside.rotateX) <= 14);
  assert.equal(emblemPose({ left: 0, top: 0, width: 0, height: 0 }, { x: 5, y: 5 }).x, 1);
  const html = readFileSync('apps/pwa/index.html', 'utf8');
  const css = readFileSync('apps/pwa/styles.css', 'utf8');
  assert.match(html, /id="janusEmblem"[^>]*role="img"/);
  assert.match(css, /\.glow-emblem\.is-lit/);
  assert.match(css, /prefers-reduced-motion/);
  assert.ok(readFileSync('apps/pwa/sw.js', 'utf8').includes("'/glow-emblem.js'"));
  assert.ok(readFileSync('apps/pwa/app.js', 'utf8').includes("mountGlowEmblem(document.querySelector('#janusEmblem'))"));
});
