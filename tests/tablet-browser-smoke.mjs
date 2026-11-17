// Nodo real + navegador: alta local, inicio de sesión, cifrado persistente y PWA sin conexión.
// PLAYWRIGHT_MODULE puede apuntar a una instalación de Playwright externa al producto.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { configureLocal } from '../scripts/tablet/configure-local.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..');
const dir = mkdtempSync(join(tmpdir(), 'janus-tablet-browser-'));
const portServer = net.createServer();
await new Promise(done => portServer.listen(0, '127.0.0.1', done));
const port = portServer.address().port;
await new Promise(done => portServer.close(done));
const origin = `http://127.0.0.1:${port}`;
const env = { ...process.env, HOME: dir, JANUS_APP_DIR: root, JANUS_DATA_DIR: join(dir, 'data'), JANUS_SECRETS_DIR: join(dir, 'secrets'), PORT: String(port),
  JANUS_ENV_FILE: join(dir, 'secrets/janus.env'), JANUS_KID_WEATHER: 'off', JANUS_RADAR_INTERVAL_MIN: '0', JANUS_BIND_HOST: '127.0.0.1',
};
for (const key of Object.keys(env)) {
  if (/TOKEN|API_KEY|PUBLIC_KEY_PEM|VAULT_KEY|JANUS_MODEL_|JANUS_.*_MODEL|JANUS_STT_|JANUS_TTS_|GOOGLE_OAUTH/.test(key)) delete env[key];
}
delete env.JANUS_DB;
let child, browser;
let log = '';
const checks = [];
const ok = label => { checks.push(label); console.log('OK · ' + label); };
async function stop() {
  if (child && child.exitCode === null) {
    const exited = new Promise(done => child.once('exit', done));
    child.kill('SIGTERM'); await exited;
  }
}
async function start() {
  child = spawn(process.execPath, [join(root, 'scripts/start-local.mjs')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Runtime exited: ' + log.slice(-1200));
    try { const r = await fetch(origin + '/health'); if (r.ok) return; } catch { /* wait */ }
    await new Promise(done => setTimeout(done, 100));
  }
  throw new Error('Runtime timeout');
}

try {
  configureLocal(env);
  await start();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 800, height: 1280 }, acceptDownloads: true });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  await page.locator('#founderLinkButton').click();
  await page.locator('#founderKeyBox').waitFor({ state: 'visible' });
  const downloadReady = page.waitForEvent('download');
  await page.locator('#founderKeyDownload').click();
  const download = await downloadReady;
  assert.equal(download.suggestedFilename(), 'janus-founder-public.pem');
  const publicPath = join(dir, 'founder-public.pem'); await download.saveAs(publicPath);
  const publicText = readFileSync(publicPath, 'utf8');
  assert.match(publicText, /BEGIN PUBLIC KEY/); assert.doesNotMatch(publicText, /PRIVATE/);
  ok('vinculación desde la interfaz real; descarga exclusivamente pública');
  await stop(); configureLocal(env, publicPath); await start();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#founderSignInButton').click();
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('janus.founder.session')));
  ok('llave del navegador conservada; autenticación real tras reiniciar el nodo');
  const caseId = await page.evaluate(async () => {
    const response = await fetch('/api/cases', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') }, body: JSON.stringify({ id: 'tablet-smoke-case', title: 'Tablet smoke fixture', category: 'Personal / Privado', context: 'PRIVATE_TABLET_FIXTURE_1126', status: 'waiting_reply' }) });
    const body = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(body));
    return body.case?.id || body.id;
  });
  assert.ok(caseId, 'case id');
  await stop();
  assert.ok(!readFileSync(join(dir, 'data/janus.db')).includes(Buffer.from('PRIVATE_TABLET_FIXTURE_1126')), 'no private case text stored in plaintext');
  await start();
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#founderSignInButton').click();
  await page.waitForFunction(() => Boolean(sessionStorage.getItem('janus.founder.session')));
  const stored = await page.evaluate(async id => {
    const response = await fetch('/api/cases', { headers: { authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') } });
    const body = await response.json();
    return { status: response.status, text: JSON.stringify(body.cases?.find(item => item.id === id)) };
  }, caseId);
  assert.equal(stored.status, 200); assert.match(stored.text, /PRIVATE_TABLET_FIXTURE_1126/);
  ok('caso cifrado conservado en SQLite después de parada y reinicio');
  for (const route of ['/dashboard/a', '/dashboard/b', '/kendra']) {
    const response = await page.goto(origin + route, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    assert.ok(await page.locator('link[rel=manifest]').count());
  }
  ok('dashboards A/B y Kendra servidas por el Core con sus manifests');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(async () => Boolean(await caches.match('/dashboard/a')) && Boolean(await caches.match('/dashboard/b')));
  const privateCached = await page.evaluate(async () => {
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) {
      if (new URL(request.url).pathname.startsWith('/api/')) return true;
    }
    return false;
  });
  assert.equal(privateCached, false);
  await context.setOffline(true);
  for (const route of ['/dashboard/a', '/dashboard/b', '/kendra']) {
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200); assert.ok(await page.locator('#app').count());
  }
  ok('apertura sin conexión de las tres pantallas; ninguna API privada en caché');
  await context.setOffline(false);
  await context.close();
  console.log(`Tablet browser smoke: ${checks.length} bloques PASS (Chromium; Android físico pendiente).`);
} finally {
  await browser?.close(); await stop(); rmSync(dir, { recursive: true, force: true });
}
