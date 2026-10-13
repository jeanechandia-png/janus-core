import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
// @ts-expect-error -- plain browser ES module without type declarations
import { base64url, explainAuthError, spkiToPem } from '../apps/pwa/founder-session.js';

test('founder session helpers: base64url, PEM wrapping and Spanish error explanations', () => {
  assert.equal(base64url(new Uint8Array([251, 255, 0])), '-_8A');
  const pem = spkiToPem(new Uint8Array(91).fill(7));
  assert.match(pem, /^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PUBLIC KEY-----\n$/);
  assert.ok(String(pem).split('\n').every((line: string) => line.length <= 64));
  assert.match(explainAuthError(426), /HTTPS/);
  assert.match(explainAuthError(400, 'credential_unavailable'), /no está registrada/);
  assert.match(explainAuthError(401, 'invalid_signature'), /firma/);
});

test('approvals panel: device key is non-extractable, decisions need auth, UI never injects HTML from the server', () => {
  const session = readFileSync('apps/pwa/founder-session.js', 'utf8');
  const app = readFileSync('apps/pwa/app.js', 'utf8');
  const html = readFileSync('apps/pwa/index.html', 'utf8');
  const sw = readFileSync('apps/pwa/sw.js', 'utf8');
  assert.match(session, /generateKey\(\{ name: 'ECDSA', namedCurve: 'P-256' \}, false/);
  assert.match(app, /\/api\/approvals\/\$\{encodeURIComponent\(id\)\}\/decision/);
  assert.match(app, /headers: \{ 'content-type': 'application\/json', \.\.\.authHeaders\(\) \}/);
  const panel = app.slice(app.indexOf('function renderApprovals'), app.indexOf('async function pollApprovals'));
  assert.equal(panel.includes('innerHTML'), false);
  for (const id of ['approvalsList', 'founderLinkButton', 'founderSignInButton', 'founderSignOutButton', 'founderKeyCopy']) assert.match(html, new RegExp(`id="${id}"`));
  assert.ok(sw.includes("'/founder-session.js'"));
});
