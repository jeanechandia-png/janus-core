// Smoke de la plantilla laboral «JANUS Work» contra el runtime REAL (SQLite en memoria, sin red externa).
// Fase 1 (siempre): permisos y aislamiento por API con dos colaboradores (ES y NL) y el Founder.
// Fase 2 (si hay piel de IBA + Playwright): la página /work en un navegador real, con llave WebCrypto del
//         dispositivo, alta por el Founder con prueba biométrica, inicio de sesión, sesión de trabajo,
//         registro de avance y chat por proyecto. Sin piel: se comprueba que /work responde 503 (nunca otro diseño).
// Uso: node tests/work-runtime-smoke.mjs   [PLAYWRIGHT_MODULE=/ruta/playwright CHROME_PATH=/usr/bin/google-chrome]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const ecKeys = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const founderKeys = ecKeys(), faceKeys = ecKeys(), devKeys = ecKeys();
const skinPath = process.env.JANUS_WORK_SKIN_CSS || 'prototypes/dashboard/local/iba-command-center.css';
const hasSkin = existsSync(skinPath);
rmSync('prototypes/dashboard/dist/Janus-Work-core.html', { force: true }); // siempre se sirve el build de ESTE código

const child = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env, PORT: String(port), JANUS_DB: ':memory:', JANUS_TIME_ZONE: 'Europe/Amsterdam',
    GOOGLE_ACCESS_TOKEN: '', THREADS_ACCESS_TOKEN: '', JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'), JANUS_CREDENTIAL_VAULT_PATH: '',
    GOOGLE_OAUTH_CLIENT_ID: '', GOOGLE_OAUTH_CLIENT_SECRET: '', THREADS_APP_SECRET: '', GITHUB_TOKEN: '', NETLIFY_AUTH_TOKEN: '',
    JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', JANUS_WORK_OPERATOR_UPLOADS: '',
    JANUS_FOUNDER_PUBLIC_KEY_PEM: founderKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_PUBLIC_KEY_PEM: faceKeys.publicKey, JANUS_FOUNDER_BIOMETRIC_KEY_ID: 'smoke-face-key',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const checks = [];
const ok = (name) => { checks.push(name); };

try {
  await waitForJson(`${base}/health`, 15_000);
  const founder = await authenticate('founder', founderKeys.privateKey);

  // ── Preparación por el Founder ────────────────────────────────────────────────────────────────
  for (const [id, label] of [['scope-api', 'API'], ['scope-nl', 'Acquisitie NL']]) await call('POST', '/api/coordination/scopes', founder, { id, label, classification: 'project' }, 201);
  await delegate(founder, { principalId: 'colab-dev', displayName: 'Persona Dev', publicKeyPem: devKeys.publicKey, locale: 'es' });
  await call('POST', '/api/coordination/grants', founder, { principalId: 'colab-dev', scopeId: 'scope-api', permissions: ['read_context', 'write_work', 'handoff'] }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-api', name: 'Proyecto API', description: 'API de prueba', instructions: 'TypeScript estricto.', coordinationScopeId: 'scope-api' }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-nl', name: 'Acquisitie Nederland', coordinationScopeId: 'scope-nl' }, 201);
  await call('POST', '/api/projects', founder, { id: 'p-privado', name: 'Privado del Founder', instructions: 'SECRETO-FOUNDER' }, 201);
  await call('POST', '/api/coordination/assignments', founder, { id: 'as-dev-1', title: 'Listado con permisos', goal: 'Exponer el listado', assigneePrincipalId: 'colab-dev', scopeIds: ['scope-api'], priority: 'high', nextActions: ['Paginar'] }, 201);
  const dev = await authenticate('colab-dev', devKeys.privateKey);

  // ── Perfil laboral: solo el Founder fija identidad, funciones e instrucciones ─────────────────
  const profile = await call('PUT', '/api/coordination/operators/colab-dev/profile', founder, { roleTitle: 'Desarrollo de API', functions: ['Backend', 'Pruebas'], instructions: 'Nada crítico queda solo en tu equipo.', role: 'founder_director' }, 200);
  assert.equal(profile.profile.roleTitle, 'Desarrollo de API'); assert.equal(profile.profile.role, undefined);
  await call('PUT', '/api/coordination/operators/colab-dev/profile', dev, { instructions: 'Me autorizo a todo' }, 403);
  await call('PUT', '/api/coordination/operators/no-existe/profile', founder, { roleTitle: 'x' }, 404);
  await call('PUT', '/api/coordination/operators/colab-dev/profile', founder, { locale: 'tr' }, 400);
  ok('perfil laboral solo editable por el Founder');

  // ── Dashboard del colaborador: solo lo suyo ───────────────────────────────────────────────────
  await call('GET', '/api/dashboard/work', null, undefined, 401);
  await call('GET', '/api/dashboard/work', founder, undefined, 403); // el Founder tiene su propia dashboard
  let dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.templateId, 'janus-work-v1'); assert.equal(dash.skinSource, 'iba-command-center');
  assert.equal(dash.locale, 'es'); assert.equal(dash.profile.displayName, 'Persona Dev');
  assert.deepEqual(dash.profile.functions, ['Backend', 'Pruebas']);
  assert.deepEqual(dash.projects.map((p) => p.id), ['p-api']);
  assert.equal(dash.projects[0].instructions, 'TypeScript estricto.'); assert.equal(dash.projects[0].canWrite, true);
  assert.deepEqual(dash.assignments.map((a) => a.assignment.id), ['as-dev-1']);
  assert.equal(dash.capabilities.voice, false); assert.equal(dash.capabilities.uploadAttachments, false);
  assert.doesNotMatch(JSON.stringify(dash), /SECRETO-FOUNDER|p-privado|p-nl/);
  ok('dashboard acotada a proyectos y tareas propios');

  // ── Lo reservado al CEO sigue cerrado para el colaborador ─────────────────────────────────────
  await call('PUT', '/api/projects/p-api/instructions', dev, { instructions: 'cambio no autorizado' }, 403);
  await call('GET', '/api/projects/p-privado/context', dev, undefined, 403);
  await call('GET', '/api/projects/p-nl/context', dev, undefined, 403);
  await call('POST', '/api/coordination/grants', dev, { principalId: 'colab-dev', scopeId: 'scope-nl', permissions: ['read_context'] }, 403);
  await call('POST', '/api/coordination/assignments', dev, { title: 't', goal: 'g', assigneePrincipalId: 'colab-dev', scopeIds: ['scope-api'] }, 403);
  await call('POST', '/api/auth/operator/delegate', dev, { principalId: 'intruso', publicKeyPem: ecKeys().publicKey }, 403);
  const created = await call('POST', '/api/projects', dev, { id: 'p-dev-own', name: 'x', instructions: 'colada' }, null);
  if (created.ok) assert.equal(created.project.instructions, undefined, 'un colaborador no puede fijar instrucciones de proyecto');
  ok('instrucciones de proyecto, permisos, asignaciones y altas: solo CEO');

  // ── Idioma: configurable por la propia persona ────────────────────────────────────────────────
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'xx' }, 400);
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'en' }, 200);
  assert.equal((await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard.labels.title, 'Work dashboard');
  await call('PUT', '/api/dashboard/work/locale', dev, { locale: 'es' }, 200);
  await call('PUT', '/api/dashboard/work/locale', founder, { locale: 'nl' }, 403);
  ok('idioma configurable (es/nl/en)');

  // ── Sesiones de trabajo ───────────────────────────────────────────────────────────────────────
  const ev = (token, body, status) => call('POST', '/api/work/sessions/events', token, body, status);
  assert.equal((await ev(dev, { kind: 'pause' }, 409)).error, 'work_session_not_open');
  const started = await ev(dev, { kind: 'start', projectId: 'p-api', assignmentId: 'as-dev-1' }, 201);
  assert.equal(started.session.state, 'running'); assert.equal(started.session.projectId, 'p-api');
  assert.equal((await ev(dev, { kind: 'start' }, 409)).error, 'work_session_already_open');
  await ev(dev, { kind: 'start-ish' }, 400);
  await ev(dev, { kind: 'progress' }, 400); // sin nota
  await ev(dev, { kind: 'progress', note: 'x', projectId: 'p-privado' }, 403); // proyecto ajeno
  await ev(dev, { kind: 'progress', note: 'x', projectId: 'no-existe' }, 404);
  await ev(dev, { kind: 'progress', note: 'Filtro en verde', at: '2020-01-01T00:00:00Z' }, 201);
  await ev(dev, { kind: 'pause' }, 201);
  assert.equal((await ev(dev, { kind: 'pause' }, 409)).error, 'work_session_not_running');
  await ev(dev, { kind: 'resume' }, 201);
  const ended = await ev(dev, { kind: 'end' }, 201);
  assert.equal(ended.session.state, 'ended'); assert.equal(ended.session.pauses, 1);
  assert.ok(Date.parse(ended.session.startedAt) > Date.now() - 60_000, 'la hora la pone el servidor, no el cliente');
  assert.deepEqual(ended.session.progress.map((p) => p.note), ['Filtro en verde']);
  await ev(founder, { kind: 'start' }, 403);
  await ev(null, { kind: 'start' }, 401);
  ok('registro de sesión: transiciones, hora del servidor y acceso');

  // ── Adjuntos de colaboradores: en reposo hasta que el CEO lo active ───────────────────────────
  const up = await fetch(`${base}/api/work/attachments`, { method: 'POST', headers: { authorization: `Bearer ${dev}`, 'content-type': 'text/plain', 'x-attachment-project-id': 'p-api', 'x-attachment-source': 'device-file', 'x-attachment-name': 'nota.txt' }, body: 'hola' });
  assert.equal(up.status, 403); assert.equal((await up.json()).code, 'operator_uploads_disabled');
  assert.equal((await fetch(`${base}/api/attachments`, { method: 'POST', headers: { authorization: `Bearer ${dev}`, 'content-type': 'text/plain', 'x-attachment-source': 'device-file', 'x-attachment-name': 'nota.txt' }, body: 'hola' })).status, 403);
  ok('carga de adjuntos de colaboradores desactivada por defecto');

  // ── Avance/entrega (handoff) y chat por proyecto ──────────────────────────────────────────────
  await call('POST', '/api/coordination/assignments/as-dev-1/handoffs', dev, { executiveSummary: 'Listado listo', completed: ['Filtro'], pending: ['Paginación'], evidenceRefs: ['commit abc'] }, 201);
  dash = (await call('GET', '/api/dashboard/work', dev, undefined, 200)).dashboard;
  assert.equal(dash.deliveries.length, 1); assert.equal(dash.deliveries[0].executiveSummary, 'Listado listo');
  assert.equal(dash.sessions.recent.length, 1); assert.equal(dash.sessions.open, null);
  const thread = await call('POST', '/api/projects/p-api/threads', dev, { title: 'Chat de trabajo' }, 201);
  const command = await call('POST', '/api/command', dev, { text: 'resume el estado del proyecto', projectId: 'p-api', threadId: thread.thread.id, assignmentId: 'as-dev-1' }, 202);
  assert.equal(command.authenticatedPrincipal, 'colab-dev'); assert.equal(command.projectId, 'p-api');
  await call('POST', '/api/command', dev, { text: 'hola', projectId: 'p-privado', threadId: thread.thread.id }, 404);
  await call('POST', '/api/projects/p-nl/threads', dev, { title: 'intruso' }, 403);
  ok('avances/entregas y chat con contexto de proyecto');

  // ── /work: una sola página para todos; sin piel verificada no se sirve otro diseño ────────────
  const page = await fetch(`${base}/work`);
  let browserPhase = 'omitida';
  if (!hasSkin) {
    assert.equal(page.status, 503); assert.match((await page.json()).detail, /Falta la piel de IBA/);
    ok('/work responde 503 sin la piel privada (sin diseño sustituto)');
  } else {
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /janus-work-v1 · skin iba-command-center@/); assert.match(html, /rel="manifest" href="\/work\.webmanifest"/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.doesNotMatch(html, /Persona Dev|Proyecto API|SECRETO-FOUNDER/, 'la página no lleva datos de nadie: llegan tras iniciar sesión');
    const manifest = await (await fetch(`${base}/work.webmanifest`)).json();
    assert.equal(manifest.start_url, '/work'); assert.equal(manifest.display, 'standalone');
    ok('/work servida con la piel de IBA y manifest PWA propio');
    const playwright = loadPlaywright();
    if (playwright) { await browserFlow(playwright, founder); browserPhase = 'superada'; }
  }

  // ── Aislamiento final entre colaboradores y vista del Founder ─────────────────────────────────
  const mine = await call('GET', '/api/work/sessions', dev, undefined, 200);
  assert.ok(mine.sessions.every((s) => s.principalId === 'colab-dev')); assert.equal(mine.selfReported, true);
  const all = await call('GET', '/api/work/sessions', founder, undefined, 200);
  assert.ok(all.sessions.some((s) => s.principalId === 'colab-dev'));
  await call('GET', '/api/work/sessions', null, undefined, 401);
  ok('cada persona ve solo sus sesiones; el Founder ve el conjunto');

  console.log(`work-runtime-smoke ok · ${checks.length} bloques · navegador: ${browserPhase}${hasSkin ? '' : ' (piel de IBA no instalada)'}`);
  for (const name of checks) console.log('  ✓ ' + name);
} catch (error) {
  console.error(stderr.split('\n').slice(-15).join('\n'));
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(1_000)]);
  if (!child.killed) child.kill('SIGKILL');
}

/** Navegador real: segundo colaborador (NL) que se da de alta con la llave WebCrypto de su dispositivo. */
async function browserFlow({ chromium }, founder) {
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH || existsSync('/usr/bin/google-chrome') ? { executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' } : {}), args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 }, locale: 'nl-NL', hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('response', (response) => { if (response.status() === 404) errors.push('404 ' + response.url()); });
    page.on('console', (message) => { if (message.type() === 'error' && !/401|403|409/.test(message.text())) errors.push(message.text()); });
    await page.goto(`${base}/work`);
    await page.waitForSelector('.cc-login-card');
    assert.equal(await page.locator('.janus-language-button.is-lit').getAttribute('data-language'), 'nl', 'idioma inicial según el dispositivo');
    assert.equal(await page.locator('.janus-language-button img').evaluateAll((imgs) => imgs.filter((img) => img.complete && img.naturalWidth === 192).length), 3, 'los tres medallones cargan');
    assert.equal(await page.locator('input[type=password]').count(), 0, 'sin contraseñas');
    // Sin llave: no entra. Vincula el dispositivo y entrega la llave PÚBLICA.
    await page.fill('#jw-login-id', 'colab-nl');
    await page.click('button[type=submit]');
    await page.waitForSelector('.cc-notice');
    await page.click('[data-act=link]');
    await page.waitForSelector('.jw-pem');
    const pem = await page.locator('.jw-pem').inputValue();
    assert.match(pem, /^-----BEGIN PUBLIC KEY-----/); assert.doesNotMatch(pem, /PRIVATE/);
    // Aún no autorizado por el Founder → no hay acceso.
    await page.click('button[type=submit]');
    await page.waitForFunction(() => document.querySelectorAll('.cc-notice').length >= 1 && !document.querySelector('button[type=submit]').disabled);
    assert.equal(await page.locator('.cc-shell').count(), 0);
    // El Founder la da de alta (con prueba biométrica), le concede su ámbito y le asigna trabajo.
    await delegate(founder, { principalId: 'colab-nl', displayName: 'Persoon NL', publicKeyPem: pem, locale: 'nl' });
    await call('POST', '/api/coordination/grants', founder, { principalId: 'colab-nl', scopeId: 'scope-nl', permissions: ['read_context', 'write_work', 'handoff'] }, 201);
    await call('POST', '/api/coordination/assignments', founder, { id: 'as-nl-1', title: 'Demo’s inplannen', goal: 'Drie demo’s', assigneePrincipalId: 'colab-nl', scopeIds: ['scope-nl'], nextActions: ['Tijdsloten voorstellen'] }, 201);
    await page.click('button[type=submit]');
    await page.waitForSelector('.cc-shell', { timeout: 15_000 });
    const text = await page.locator('.cc-main').innerText();
    assert.match(text, /Wat vraagt vandaag je aandacht\?/); assert.match(text, /Persoon NL/); assert.match(text, /Demo’s inplannen/); assert.match(text, /Acquisitie Nederland/);
    assert.doesNotMatch(text, /Proyecto API|Listado con permisos|Persona Dev|Privado del Founder/, 'no ve nada del otro colaborador ni del Founder');
    assert.equal(await page.locator('select[data-act=project] option').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'nl');
    assert.equal(await page.locator('audio, video, [class*=mic], [data-act*=voice]').count(), 0, 'sin elementos de voz');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'sin desbordamiento horizontal en móvil');
    // Sesión de trabajo real.
    await page.click('[data-act=sess][data-v=start]');
    await page.waitForSelector('[data-act=sess][data-v=pause]');
    await page.click('[data-act=sess][data-v=pause]');
    await page.waitForSelector('[data-act=sess][data-v=resume]');
    // Registrar avance: validación y guardado real (handoff + evento de sesión).
    await page.click('[data-act=progress][data-v="as-nl-1"]');
    await page.waitForSelector('#jw-form');
    await page.evaluate(() => document.querySelector('#jw-form textarea[name=summary]').removeAttribute('required'));
    await page.click('#jw-form button[type=submit]');
    await page.waitForSelector('#jw-form .cc-inline-notice');
    await page.fill('#jw-form textarea[name=summary]', 'Drie zaken gebeld <b>x</b>');
    await page.fill('#jw-form textarea[name=done]', 'Belronde\nNotities');
    await page.fill('#jw-form textarea[name=evidence]', 'notitie-1');
    await page.click('#jw-form button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('#jw-form') && /Drie zaken gebeld/.test(document.querySelector('#deliveries').innerText), null, { timeout: 15_000 });
    assert.equal(await page.locator('#deliveries b:text-is("x")').count(), 0, 'el texto del usuario se muestra escapado');
    // Chat escrito con contexto de proyecto (sin modelo configurado: el Núcleo responde con su estado real).
    await page.fill('#jw-chat-input', 'Wat is mijn volgende stap?');
    await page.click('form[data-form=chat] button[type=submit]');
    await page.waitForSelector('.jw-msg.jw-janus', { timeout: 100_000 });
    assert.match(await page.locator('.jw-msg.jw-user p').innerText(), /volgende stap/);
    assert.ok((await page.locator('.jw-msg.jw-janus p').innerText()).length > 0);
    // Idioma: cambia al instante y queda guardado en su perfil.
    await page.click('.janus-language-button[data-language=es]');
    await page.waitForFunction(() => /¿Qué necesita tu atención hoy\?/.test(document.querySelector('.cc-topbar h1').innerText));
    // Recarga: la sesión del navegador sigue y el idioma elegido persiste en el servidor.
    await page.reload();
    await page.waitForSelector('.cc-shell');
    assert.match(await page.locator('.cc-topbar h1').innerText(), /¿Qué necesita tu atención hoy\?/);
    assert.match(await page.locator('#session').innerText(), /en pausa/i);
    // Cerrar sesión devuelve a la pantalla de acceso y la API deja de responderle.
    await page.click('.jw-foot [data-act=signout]'); // visible también en móvil
    await page.waitForSelector('.cc-login-card');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('janus.founder.session')), null);
    assert.deepEqual(errors, [], 'errores de consola: ' + errors.join(' | '));
    ok('navegador real: alta con llave del dispositivo, NL, sesión, avance, chat, idioma persistente y cierre');
  } finally { await browser.close(); }
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/npm-tools/node_modules/playwright'].filter(Boolean)) {
    try { return require(id); } catch { /* siguiente */ }
  }
  return null;
}

async function delegate(founderToken, body) {
  const proof = await founderBiometricProof(founderToken, 'security.authority.delegate_operator');
  const result = await call('POST', '/api/auth/operator/delegate', founderToken, body, 201, { 'x-janus-biometric-proof': proof });
  assert.equal(result.operator?.principal?.role, 'operator');
}

async function call(method, path, token, body, expectedStatus, extraHeaders = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json().catch(() => ({}));
  if (expectedStatus !== null) assert.equal(response.status, expectedStatus, `${method} ${path} → ${response.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

async function authenticate(principalId, privateKey) {
  const challenge = (await call('POST', '/api/auth/challenge', null, { principalId }, 200)).challenge;
  const signature = sign('sha256', Buffer.from(challenge.signingPayload, 'utf8'), privateKey).toString('base64url');
  return (await call('POST', '/api/auth/verify', null, { challengeId: challenge.id, principalId, signature }, 200)).session.token;
}

async function founderBiometricProof(founderToken, action) {
  const challenge = (await call('POST', '/api/auth/biometric/challenge', founderToken, { action }, 200)).challenge;
  const signature = sign('sha256', Buffer.from(challenge.signingPayload, 'utf8'), faceKeys.privateKey).toString('base64url');
  return (await call('POST', '/api/auth/biometric/verify', founderToken, { challengeId: challenge.id, keyId: 'smoke-face-key', signature }, 200)).proof.proofId;
}

async function waitForJson(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); lastError = new Error(`HTTP ${response.status}`); } catch (error) { lastError = error; }
    await delay(100);
  }
  throw lastError ?? new Error(`timeout waiting for ${url}`);
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const selected = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return selected;
}
