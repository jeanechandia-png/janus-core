// Trabajo SIN INTERNET contra el runtime REAL: detección, capacidades veraces, modelo local, bandeja de salida e idempotencia.
// (arnés compartido con) Contabilidad e impuestos contra el runtime REAL con base de datos en disco: solo Founder, cuadre, cifrado en
// reposo, diario de solo añadir, persistencia tras reiniciar y reglas fiscales como datos. Empresa FICTICIA.
// Uso: node tests/offline-runtime.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ecKeys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const dir = mkdtempSync(join(tmpdir(), 'janus-offline-'));
const importDir = join(dir, 'import'); mkdirSync(importDir);
const dbFile = join(dir, 'janus.db');
const founderKeys = ecKeys(), faceKeys = ecKeys(), devKeys = ecKeys();
const vaultKey = randomBytes(32).toString('base64');
let base = '', child = null, stderr = '';
const ok = (text) => console.log('  ✓ ' + text);

async function freePort() { const s = createServer(); await new Promise((res, rej) => { s.once('error', rej); s.listen(0, '127.0.0.1', res); }); const p = s.address().port; await new Promise((res) => s.close(res)); return p; }
async function start(extraEnv = {}) {
  const port = await freePort(); base = `http://127.0.0.1:${port}`; stderr = '';
  child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), JANUS_DB: dbFile,
    GOOGLE_ACCESS_TOKEN: '', GOOGLE_OAUTH_CLIENT_ID: '', GOOGLE_OAUTH_CLIENT_SECRET: '', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_CREDENTIAL_VAULT_KEY: vaultKey, JANUS_CREDENTIAL_VAULT_PATH: '',
    JANUS_PRIVATE_IMPORT_DIR: importDir, JANUS_RADAR_INTERVAL_MIN: '', JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: faceKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'k', ...extraEnv } });
  child.stderr.on('data', (c) => { stderr += c.toString(); });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) { try { if ((await fetch(base + '/health')).ok) return; } catch { /* arrancando */ } await delay(120); }
  throw new Error('runtime did not start: ' + stderr.slice(-400));
}
async function stop() { if (!child) return; const done = new Promise((res) => child.once('exit', res)); child.kill('SIGTERM'); await Promise.race([done, delay(4000)]); child = null; }
async function call(method, path, token, body, expected, extra = {}) {
  const r = await fetch(base + path, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({})); assert.equal(r.status, expected, `${method} ${path} → ${r.status} ${JSON.stringify(j).slice(0, 200)}`); return j;
}
async function authenticate(principalId, privateKey) {
  const challenge = (await call('POST', '/api/auth/challenge', null, { principalId }, 200)).challenge;
  return (await call('POST', '/api/auth/verify', null, { challengeId: challenge.id, principalId, signature: sign('sha256', Buffer.from(challenge.signingPayload, 'utf8'), privateKey).toString('base64url') }, 200)).session.token;
}

import { createServer as createHttp } from 'node:http';
const listen = (handler) => new Promise((res) => { const s = createHttp(handler); s.listen(0, '127.0.0.1', () => res(s)); });
const closeServer = (s) => new Promise((res) => { s.closeAllConnections?.(); s.close(() => res()); });
try {
  // «Internet» simulado: un servidor que se puede apagar. Modelo propio simulado en el propio aparato (127.0.0.1).
  let internet = await listen((q, r) => { r.writeHead(204); r.end(); });
  const probePort = internet.address().port; let modelCalls = 0;
  const localModel = await listen((q, r) => { let raw = ''; q.on('data', (c) => { raw += c; }); q.on('end', () => { modelCalls += 1; r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ choices: [{ message: { content: '{"steps":[]}' } }] })); }); });
  const env = { JANUS_OFFLINE_PROBE_URLS: `http://127.0.0.1:${probePort}`, JANUS_OFFLINE_PROBE_MS: '0', JANUS_MODEL_BASE_URL: `http://127.0.0.1:${localModel.address().port}`, JANUS_MODEL_NAME: 'local-fake' };
  await start(env);
  let founder = await authenticate('founder', founderKeys.privateKey);
  const proofChallenge = (await call('POST', '/api/auth/biometric/challenge', founder, { action: 'security.authority.delegate_operator' }, 200)).challenge;
  const proof = (await call('POST', '/api/auth/biometric/verify', founder, { challengeId: proofChallenge.id, keyId: 'k', signature: sign('sha256', Buffer.from(proofChallenge.signingPayload, 'utf8'), faceKeys.privateKey).toString('base64url') }, 200)).proof.proofId;
  await call('POST', '/api/auth/operator/delegate', founder, { principalId: 'colab-x', displayName: 'Persona X', publicKeyPem: devKeys.publicKey, locale: 'es' }, 201, { 'x-janus-biometric-proof': proof });
  const dev = await authenticate('colab-x', devKeys.privateKey);
  for (const [m, p, b] of [['GET', '/api/offline/status'], ['POST', '/api/offline/probe', {}], ['POST', '/api/offline/outbox', { kind: 'x.y', summary: 's' }], ['POST', '/api/offline/outbox/x/decision', { decision: 'send' }]]) { await call(m, p, null, b, 401); await call(m, p, dev, b, 403); }
  ok('solo el Founder ve y gobierna el estado sin conexión');

  let st = await call('POST', '/api/offline/probe', founder, {}, 200);
  assert.equal(st.connectivity.state, 'online'); assert.equal(st.resources.local_model, true);
  const by = (list, id) => list.find((c) => c.id === id);
  assert.equal(by(st.now, 'chat').status, 'works'); assert.equal(by(st.now, 'google').status, 'works');
  assert.deepEqual(st.withoutInternet.works.map((c) => c.id), ['data', 'books', 'dashboard', 'remote', 'chat', 'interpreter']);
  assert.deepEqual(st.withoutInternet.unavailable.map((c) => c.id), ['listen', 'google', 'integrations']);
  assert.deepEqual(st.withoutInternet.degraded.map((c) => c.id), ['speak', 'push']);
  ok('con conexión: todo funciona; y declara con exactitud qué seguiría funcionando sin internet (modelo propio sí, voz y Google no)');

  await closeServer(internet);
  st = await call('POST', '/api/offline/probe', founder, {}, 200);
  assert.equal(st.connectivity.state, 'online', 'un solo fallo no desconecta');
  st = await call('POST', '/api/offline/probe', founder, {}, 200);
  assert.equal(st.connectivity.state, 'offline');
  assert.equal(by(st.now, 'google').status, 'unavailable'); assert.equal(by(st.now, 'chat').status, 'works'); assert.equal(by(st.now, 'books').status, 'works');
  ok('se cae internet: lo detecta al segundo fallo y cambia el veredicto de cada función');

  // Lo local sigue funcionando sin internet: cuentas (con clave de idempotencia para reenvíos).
  const idem = { 'idempotency-key': 'reenvio-ficticio-0001' };
  const e1 = await call('POST', '/api/books/entries', founder, { kind: 'income', amount: '100', date: '2026-02-01', description: 'Cobro sin internet Phi-9', verified: true }, 201, idem);
  const e2 = await call('POST', '/api/books/entries', founder, { kind: 'income', amount: '100', date: '2026-02-01', description: 'Cobro sin internet Phi-9', verified: true }, 200, idem);
  assert.equal(e2.duplicate, true); assert.equal(e2.entryId, e1.entry.id);
  const books = await call('GET', '/api/books?from=2026-01-01&to=2026-12-31', founder, undefined, 200);
  assert.equal(books.totalEntries, 1); assert.equal(books.incomeStatement.revenue.totalMinor, 10000); assert.equal(books.balanceSheet.balanced, true);
  ok('sin internet: las cuentas se anotan y calculan; un reenvío con la misma clave no duplica el asiento');

  // Conversar sin internet: usa el modelo propio del aparato, no espera a nadie de fuera.
  const before = modelCalls; const t0 = Date.now();
  const run = await call('POST', '/api/command', founder, { text: 'resume mis tareas pendientes' }, 202);
  assert.ok(Date.now() - t0 < 5000, 'aceptar la orden no espera a un proveedor externo');
  for (let i = 0; i < 40 && modelCalls === before; i += 1) await new Promise((r) => setTimeout(r, 150));
  assert.ok(run && !run.error, JSON.stringify(run).slice(0, 200));
  assert.ok(modelCalls > before, 'sin internet la orden llega al modelo propio del aparato');
  ok(`sin internet: una orden se acepta en ${Date.now() - t0} ms y la atiende el modelo propio del aparato (${modelCalls - before} llamada/s)`);

  // Bandeja de salida: lo delicado no sale solo al reconectar; lo desconocido tampoco se pierde.
  const sensitive = await call('POST', '/api/offline/outbox', founder, { kind: 'mail.send', summary: 'Correo ficticio Chi-4', payload: { to: 'x@example.org' }, sensitive: true }, 201);
  const plain = await call('POST', '/api/offline/outbox', founder, { kind: 'note.sync', summary: 'Nota ficticia', payload: { t: 1 } }, 201);
  await call('POST', '/api/offline/outbox', founder, { kind: 'Bad Kind', summary: 'x' }, 400);
  internet = await new Promise((res) => { const s = createHttp((q, r) => { r.writeHead(204); r.end(); }); s.listen(probePort, '127.0.0.1', () => res(s)); });
  st = await call('POST', '/api/offline/probe', founder, {}, 200);
  assert.equal(st.connectivity.state, 'online');
  await new Promise((r) => setTimeout(r, 400));
  st = await call('GET', '/api/offline/status', founder, undefined, 200);
  const rev = Object.fromEntries(st.outbox.review.map((i) => [i.id, i]));
  assert.equal(rev[sensitive.id].state, 'needs_review'); assert.match(rev[sensitive.id].lastError, /confirmación/);
  assert.equal(rev[plain.id].state, 'failed'); assert.match(rev[plain.id].lastError, /no hay remitente/);
  assert.equal(JSON.stringify(st).includes('example.org'), false, 'el contenido no viaja a la pantalla, solo el resumen');
  await call('POST', `/api/offline/outbox/${sensitive.id}/decision`, founder, { decision: 'discard' }, 200);
  await call('POST', `/api/offline/outbox/${sensitive.id}/decision`, founder, { decision: 'discard' }, 404);
  await call('POST', `/api/offline/outbox/${plain.id}/decision`, founder, { decision: 'borrar' }, 400);
  st = await call('GET', '/api/offline/status', founder, undefined, 200);
  assert.equal(st.outbox.counts.discarded, 1); assert.equal(st.outbox.review.length, 1);
  ok('vuelve internet: lo delicado espera tu confirmación, lo que no tiene destino queda a la vista; nada se envía ni se pierde solo');

  await stop();
  const disk = ['', '-wal', '-shm'].map((s) => dbFile + s).filter(existsSync).map((f) => readFileSync(f).toString('latin1')).join('');
  for (const secret of ['Phi-9', 'Chi-4', 'example.org']) assert.ok(!disk.includes(secret), `«${secret}» está en claro en el disco`);
  await start(env);
  founder = await authenticate('founder', founderKeys.privateKey);
  st = await call('GET', '/api/offline/status', founder, undefined, 200);
  assert.equal(st.outbox.review.length, 1); assert.equal(st.outbox.review[0].id, plain.id);
  ok('la bandeja está cifrada en disco y sobrevive a un reinicio');
  await closeServer(internet); await closeServer(localModel);
  console.log('offline runtime ok');
} finally { await stop(); rmSync(dir, { recursive: true, force: true }); }
