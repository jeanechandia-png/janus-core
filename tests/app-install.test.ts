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
