// Contabilidad e impuestos contra el runtime REAL con base de datos en disco: solo Founder, cuadre, cifrado en
// reposo, diario de solo añadir, persistencia tras reiniciar y reglas fiscales como datos. Empresa FICTICIA.
// Uso: node tests/books-runtime.mjs
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
const dir = mkdtempSync(join(tmpdir(), 'janus-books-'));
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

try {
  await start();
  let founder = await authenticate('founder', founderKeys.privateKey);
  const proofChallenge = (await call('POST', '/api/auth/biometric/challenge', founder, { action: 'security.authority.delegate_operator' }, 200)).challenge;
  const proof = (await call('POST', '/api/auth/biometric/verify', founder, { challengeId: proofChallenge.id, keyId: 'k', signature: sign('sha256', Buffer.from(proofChallenge.signingPayload, 'utf8'), faceKeys.privateKey).toString('base64url') }, 200)).proof.proofId;
  await call('POST', '/api/auth/operator/delegate', founder, { principalId: 'colab-x', displayName: 'Persona X', publicKeyPem: devKeys.publicKey, locale: 'es' }, 201, { 'x-janus-biometric-proof': proof });
  const dev = await authenticate('colab-x', devKeys.privateKey);
  for (const [m, p, b] of [['GET', '/api/books'], ['POST', '/api/books/entries', { kind: 'income', amount: '10', description: 'x' }], ['POST', '/api/books/entries/x/reverse', {}], ['POST', '/api/books/accounts', {}], ['PUT', '/api/books/company', { legalForm: 'bv' }], ['GET', '/api/tax/nl'], ['POST', '/api/tax/packs', {}]]) {
    await call(m, p, null, b, 401); await call(m, p, dev, b, 403);
  }
  assert.equal((await fetch(base + '/api/books/journal.csv')).status, 401);
  assert.equal((await fetch(base + '/api/books/journal.csv', { headers: { authorization: `Bearer ${dev}` } })).status, 403);
  ok('sin sesión 401; un colaborador recibe 403 en todas las rutas de cuentas e impuestos');

  let books = await call('GET', '/api/books?from=2026-01-01&to=2026-12-31', founder, undefined, 200);
  assert.equal(books.totalEntries, 0); assert.equal(books.balanceSheet.balanced, true); assert.equal(books.incomeStatement.netResultMinor, 0);
  assert.equal(books.company.confirmed, false); assert.equal(books.company.legalForm, 'unregistered'); assert.equal(books.sealedAtRest, true);
  ok('sin asientos: informes a cero (no hay cifras de ejemplo) y forma jurídica «sin confirmar»');

  const post = (b, status = 201) => call('POST', '/api/books/entries', founder, b, status);
  await post({ kind: 'owner_contribution', amount: '5.000', date: '2026-01-05', description: 'Aportación ficticia Tau-77', verified: true });
  await post({ kind: 'income', amount: '2.420,00', vatPercent: 21, date: '2026-02-01', description: 'Web cliente ficticio Rho-31', verified: true });
  const wrong = (await post({ kind: 'expense', amount: 121, vatPercent: 21, category: '6100', date: '2026-03-01', description: 'Suscripción mal anotada' })).entry;
  await post({ kind: 'expense', amount: '12,345', description: 'ambiguo' }, 400);
  await post({ kind: 'income', amount: '10', date: '2031-01-01', description: 'futuro' }, 400);
  await post({ kind: 'income', amount: '10', category: '9999', description: 'cuenta inexistente' }, 400);
  await post({ description: 'no cuadra', lines: [{ account: '1000', debitMinor: 100 }, { account: '4000', creditMinor: 90 }] }, 400);
  await post({ description: 'Manual ficticio', date: '2026-03-05', lines: [{ account: '6500', debitMinor: 5000 }, { account: '1000', creditMinor: 5000 }] });
  ok('asientos sencillos y manuales; se rechazan importes ambiguos, fechas futuras, cuentas inexistentes y asientos que no cuadran');

  await call('POST', `/api/books/entries/${wrong.id}/reverse`, founder, { reason: 'importe mal' }, 201);
  await call('POST', `/api/books/entries/${wrong.id}/reverse`, founder, {}, 409);
  await call('POST', '/api/books/entries/je_nope/reverse', founder, {}, 404);
  await post({ kind: 'expense', amount: '12,10', vatPercent: 21, category: '6100', date: '2026-03-01', description: 'Suscripción ficticia', verified: true });
  books = await call('GET', '/api/books?from=2026-01-01&to=2026-12-31', founder, undefined, 200);
  assert.equal(books.totalEntries, 6);
  assert.equal(books.incomeStatement.revenue.totalMinor, 200000);
  assert.equal(books.incomeStatement.operatingExpenses.totalMinor, 1000 + 5000);
  assert.equal(books.incomeStatement.netResultMinor, 194000);
  assert.equal(books.balanceSheet.totalAssetsMinor, books.balanceSheet.totalLiabilitiesAndEquityMinor); assert.equal(books.balanceSheet.balanced, true);
  assert.equal(books.balanceSheet.assets[0].totalMinor, 500000 + 242000 - 12100 + 12100 - 5000 - 1210);
  assert.equal(books.trialBalance.balanced, true);
  assert.equal(books.incomeStatement.evidence.unverifiedEntries, 3);
  assert.ok(books.entries.find((e) => e.id === wrong.id).reversed);
  ok('anular = contrasiento (una sola vez); balance cuadrado y resultado correcto; cuenta los asientos sin justificante');

  await call('POST', '/api/books/accounts', founder, { code: '4000', name: 'X', group: 'revenue' }, 409);
  await call('POST', '/api/books/accounts', founder, { code: '4100', name: 'Formación', group: 'nope' }, 400);
  await call('POST', '/api/books/accounts', founder, { code: '4100', name: 'Formación ficticia', group: 'revenue' }, 201);
  await post({ kind: 'income', amount: '1000', category: '4100', date: '2026-04-01', description: 'Curso ficticio', verified: true });
  const csv = await (await fetch(base + '/api/books/journal.csv', { headers: { authorization: `Bearer ${founder}` } })).text();
  assert.match(csv, /Fecha;Asiento/); assert.match(csv, /Formación ficticia/); assert.equal(csv.trim().split('\r\n').length, 19);
  ok('cuenta propia añadida sin tocar el plan base; diario exportable en CSV');

  let tax = await call('GET', '/api/tax/nl?year=2026&hours=1400&starter=1', founder, undefined, 200);
  assert.equal(tax.worksheet.estimatedTaxMinor, null); assert.match(tax.worksheet.warnings.join(' '), /NO registrada/);
  await call('PUT', '/api/books/company', founder, { legalForm: 'sociedad' }, 400);
  await call('PUT', '/api/books/company', founder, { legalForm: 'eenmanszaak', name: 'Empresa ficticia Sigma' }, 200);
  tax = await call('GET', '/api/tax/nl?year=2026&hours=1400&starter=1', founder, undefined, 200);
  const line = (k) => tax.worksheet.lines.find((l) => l.key === k);
  assert.equal(line('profit').amountMinor, 294000); assert.equal(line('za').amountMinor, -120000); assert.equal(line('sa').amountMinor, -212300);
  assert.equal(line('za').citation.confidence, 'verified'); assert.ok(line('za').citation.sources.some((s) => /belastingdienst\.nl/.test(s.url)));
  assert.equal(tax.worksheet.regime, 'inkomstenbelasting'); assert.equal(typeof tax.worksheet.estimatedTaxMinor, 'number');
  assert.equal(tax.vat[0].vatChargedMinor, 42000); assert.equal(tax.vat[0].vatPaidMinor, 210); assert.equal(tax.vat[0].dueDate, '2026-04-30');
  assert.equal(tax.closingBalance.balanced, true); assert.equal(tax.openingBalance.totalAssetsMinor, 0);
  const none = await call('GET', '/api/tax/nl?year=2024', founder, undefined, 200);
  assert.equal(none.worksheet, null); assert.match(none.reason, /No hay reglas fiscales/);
  ok('hoja fiscal: sin forma jurídica no calcula; con ella cita fuentes oficiales; sin reglas del año no extrapola');

  const pack = JSON.parse(readFileSync('packages/modules/nl-tax-prep/packs/nl-2026.json', 'utf8'));
  await call('POST', '/api/tax/packs', founder, { ...pack, year: 2027, checkedAt: '2031-01-01' }, 400);
  await call('POST', '/api/tax/packs', founder, { ...pack, year: 2027, sources: { ...pack.sources, 'kvk-tarieven': { ...pack.sources['kvk-tarieven'], url: 'http://inseguro.example' } } }, 400);
  const p27 = structuredClone(pack); p27.year = 2027; p27.status = 'announced'; p27.params.zelfstandigenaftrekEur.value = 900; p27.params.startersaftrekEur.value = 0; p27.deadlines = []; p27.announced = [];
  await call('POST', '/api/tax/packs', founder, p27, 201);
  ok('reglas de un año nuevo: entran como DATOS validados, sin tocar el código');

  // Privacidad: nada en claro en disco ni en registros.
  await stop();
  const disk = ['', '-wal', '-shm'].map((s) => dbFile + s).filter(existsSync).map((f) => readFileSync(f).toString('latin1')).join('');
  for (const secret of ['Tau-77', 'Rho-31', 'Manual ficticio']) { assert.ok(!disk.includes(secret), `«${secret}» está en claro en el disco`); assert.ok(!stderr.includes(secret), `«${secret}» está en los registros`); }
  ok('privado: los asientos están cifrados en el disco y no aparecen en los registros');

  await start();
  founder = await authenticate('founder', founderKeys.privateKey);
  books = await call('GET', '/api/books?from=2026-01-01&to=2026-12-31', founder, undefined, 200);
  assert.equal(books.totalEntries, 7); assert.equal(books.incomeStatement.revenue.totalMinor, 300000); assert.equal(books.balanceSheet.balanced, true);
  assert.equal(books.company.legalForm, 'eenmanszaak'); assert.ok(books.accounts.some((a) => a.code === '4100'));
  const t27 = await call('GET', '/api/tax/nl?year=2027', founder, undefined, 200);
  assert.ok(t27.worksheet); assert.match(t27.worksheet.warnings.join(' '), /solo anunciadas/); assert.deepEqual(t27.available.map((h) => h.year), [2026, 2027]);
  ok('persistencia: tras reiniciar JANUS siguen el diario, la cuenta propia, la forma jurídica y las reglas de 2027');
  console.log('books runtime ok');
} finally { await stop(); rmSync(dir, { recursive: true, force: true }); }
