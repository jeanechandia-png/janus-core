// Casos prioritarios contra el runtime REAL con base de datos en disco: privacidad, cifrado en reposo,
// persistencia tras reiniciar, importación privada y estado de conexión veraz. El caso es FICTICIO.
// Uso: node tests/priority-case-runtime.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ecKeys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const dir = mkdtempSync(join(tmpdir(), 'janus-case-'));
const importDir = join(dir, 'import'); mkdirSync(importDir);
const dbFile = join(dir, 'janus.db');
const founderKeys = ecKeys(), faceKeys = ecKeys(), devKeys = ecKeys();
const vaultKey = randomBytes(32).toString('base64');
let base = '', child = null, stderr = '';
const ok = (text) => console.log('  ✓ ' + text);

async function freePort() { const s = createServer(); await new Promise((res, rej) => { s.once('error', rej); s.listen(0, '127.0.0.1', res); }); const p = s.address().port; await new Promise((res) => s.close(res)); return p; }
async function start() {
  const port = await freePort(); base = `http://127.0.0.1:${port}`; stderr = '';
  child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: String(port), JANUS_DB: dbFile,
    GOOGLE_ACCESS_TOKEN: '', GOOGLE_OAUTH_CLIENT_ID: '', GOOGLE_OAUTH_CLIENT_SECRET: '', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_CREDENTIAL_VAULT_KEY: vaultKey, JANUS_CREDENTIAL_VAULT_PATH: '',
    JANUS_PRIVATE_IMPORT_DIR: importDir, JANUS_RADAR_INTERVAL_MIN: '', JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: faceKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'k' } });
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
const SECRET_TITLE = 'Reclamación ficticia Zeta-4471';
const demo = { id: 'caso-demo', title: SECRET_TITLE, category: 'Personal / Privado', priority: 'high', context: 'Contexto privado de prueba Omega-9', nextAction: 'Esperar la respuesta de la agente.',
  thread: { account: 'dueno@example.com', threadId: 'abc123def456', messageId: 'abc123def456', subject: 'Verzoek om contact – Voorbeeldstraat', sentAt: '2026-03-01T09:00:00Z', counterpart: { name: 'Agente Ejemplo', email: 'agente@gemeente.example' }, keywords: ['Voorbeeldstraat'] } };

try {
  // Importación privada: el archivo vive fuera del repositorio y se borra al quedar guardado y sellado.
  writeFileSync(join(importDir, 'importado.case.json'), JSON.stringify({ ...demo, id: 'caso-importado', title: 'Importado ficticio Kappa-22' }));
  await start();
  let founder = await authenticate('founder', founderKeys.privateKey);
  await call('GET', '/api/cases', null, undefined, 401);
  const proofChallenge = (await call('POST', '/api/auth/biometric/challenge', founder, { action: 'security.authority.delegate_operator' }, 200)).challenge;
  const proof = (await call('POST', '/api/auth/biometric/verify', founder, { challengeId: proofChallenge.id, keyId: 'k', signature: sign('sha256', Buffer.from(proofChallenge.signingPayload, 'utf8'), faceKeys.privateKey).toString('base64url') }, 200)).proof.proofId;
  await call('POST', '/api/auth/operator/delegate', founder, { principalId: 'colab-x', displayName: 'Persona X', publicKeyPem: devKeys.publicKey, locale: 'es' }, 201, { 'x-janus-biometric-proof': proof });
  const dev = await authenticate('colab-x', devKeys.privateKey);
  for (const [m, p, b] of [['GET', '/api/cases'], ['POST', '/api/cases', demo], ['POST', '/api/cases/caso-importado/check', {}], ['POST', '/api/cases/caso-importado/notes', { text: 'x' }], ['PUT', '/api/cases/caso-importado/status', { status: 'closed' }]]) await call(m, p, dev, b, 403);
  ok('sin sesión 401; un colaborador recibe 403 en todas las rutas de casos');

  let list = await call('GET', '/api/cases', founder, undefined, 200);
  assert.deepEqual(list.cases.map((c) => c.id), ['caso-importado']); assert.equal(list.encryptedAtRest, true);
  assert.deepEqual(readdirSync(importDir), [], 'el archivo privado se borra tras importarlo');
  ok('importación privada: crea el caso una vez y no deja copia en claro');

  await call('POST', '/api/cases', founder, { ...demo, thread: { ...demo.thread, account: 'no-es-correo' } }, 400);
  const created = (await call('POST', '/api/cases', founder, demo, 201)).case;
  await call('POST', '/api/cases', founder, demo, 409);
  assert.equal(created.priority, 'high'); assert.equal(created.statusLabel, 'Correo enviado; esperando respuesta');
  assert.equal(created.monitoringLabel, 'Conexión pendiente'); assert.match(created.gmailUrl, /^https:\/\/mail\.google\.com\/mail\/\?authuser=dueno%40example\.com#all\/abc123def456$/);
  const checked = await call('POST', '/api/cases/caso-demo/check', founder, {}, 200);
  assert.equal(checked.case.monitoringLabel, 'Conexión pendiente', 'Gmail no está conectado: nunca «Monitorización activa»'); assert.equal(checked.added, 0);
  ok('caso creado con prioridad ALTA; sin Gmail conectado dice «Conexión pendiente»');

  await call('POST', '/api/cases/caso-demo/notes', founder, { text: 'Nota privada Sigma-7' }, 200);
  await call('POST', '/api/cases/caso-demo/notes', founder, { text: '  ' }, 400);
  assert.equal((await call('PUT', '/api/cases/caso-demo/next-action', founder, { decision: 'approved' }, 200)).case.nextAction.state, 'approved');
  await call('PUT', '/api/cases/caso-demo/next-action', founder, { decision: 'otra' }, 400);
  await call('POST', '/api/cases/no-existe/notes', founder, { text: 'x' }, 404);
  await call('POST', '/api/cases/caso-demo/translate', founder, { eventId: 'ev-0' }, 404);
  const before = (await call('GET', '/api/cases', founder, undefined, 200)).cases.find((c) => c.id === 'caso-demo');
  assert.deepEqual(before.timeline.map((e) => e.kind).sort(), ['created', 'next_action', 'note', 'sent']);
  ok('historial: nota, aprobación de la próxima acción y errores claros');

  // Nada del caso aparece en otras superficies ni en claro en el disco.
  for (const path of ['/api/work/team', '/api/radar', '/api/memory/search?q=' + encodeURIComponent('Reclamación ficticia Zeta')]) {
    assert.doesNotMatch(JSON.stringify(await call('GET', path, founder, undefined, 200)), /Zeta-4471|Omega-9|Sigma-7|Kappa-22/, path);
  }
  assert.doesNotMatch(JSON.stringify(await call('GET', '/api/dashboard/work', dev, undefined, 200)), /Zeta-4471|Omega-9|Sigma-7|caso-demo/);
  await stop();
  const disk = readdirSync(dir).filter((f) => f.startsWith('janus.db')).map((f) => readFileSync(join(dir, f)).toString('latin1')).join('');
  assert.ok(disk.includes('priority_cases'), 'la tabla existe en el disco');
  for (const secret of ['Zeta-4471', 'Omega-9', 'Sigma-7', 'Kappa-22', 'agente@gemeente.example', 'Voorbeeldstraat']) assert.ok(!disk.includes(secret), `«${secret}» no está en claro en la base de datos`);
  assert.doesNotMatch(stderr, /Zeta-4471|Omega-9|Sigma-7|Kappa-22/, 'nada del caso en los registros');
  ok('privado: no sale por otras rutas, no está en claro en el disco ni en los registros');

  // Persistencia tras reiniciar (mismo archivo de base de datos, misma clave).
  await start();
  founder = await authenticate('founder', founderKeys.privateKey);
  list = await call('GET', '/api/cases', founder, undefined, 200);
  const after = list.cases.find((c) => c.id === 'caso-demo');
  assert.equal(after.title, SECRET_TITLE); assert.equal(after.nextAction.state, 'approved'); assert.equal(after.timeline.length, before.timeline.length);
  assert.equal(list.cases.length, 2);
  ok('persistencia: tras reiniciar JANUS el caso, su historial y sus decisiones siguen ahí');
  console.log('priority case runtime ok');
} catch (error) {
  console.error(error); if (stderr) console.error(stderr.replace(/Zeta-4471|Omega-9|Sigma-7|Kappa-22/g, '***').slice(-800)); process.exitCode = 1;
} finally { await stop(); rmSync(dir, { recursive: true, force: true }); }
