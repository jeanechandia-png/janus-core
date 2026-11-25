// Nodo real + navegador: alta local, inicio de sesión, cifrado persistente y PWA sin conexión.
// PLAYWRIGHT_MODULE puede apuntar a una instalación de Playwright externa al producto.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
let stage = 'initialisation';
const browserErrors = [];
const checks = [];
const ok = label => { checks.push(label); console.log('OK · ' + label); };
async function stop() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(done => child.once('exit', done));
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill('SIGTERM'); await exited; clearTimeout(timer);
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(20000);
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  stage = 'owner key creation';
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
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
  stage = 'first owner sign-in';
  await stop(); configureLocal(env, publicPath); await start();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#founderSignInButton').click();
  await page.waitForURL(origin + '/dashboard/a');
  await page.locator('[data-layout="approved-option-2"]').waitFor();
  assert.ok(await page.evaluate(() => Boolean(sessionStorage.getItem('janus.founder.session'))));
  ok('llave del navegador conservada; autenticación real tras reiniciar el nodo');
  stage = 'encrypted case persistence';
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
  await page.goto(origin + '/?returnTo=%2Fdashboard%2Fb#approvals');
  await page.locator('#founderSignInButton').click();
  await page.waitForURL(origin + '/dashboard/b');
  await page.locator('[data-layout="approved-option-2"]').waitFor();
  const stored = await page.evaluate(async id => {
    const response = await fetch('/api/cases', { headers: { authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') } });
    const body = await response.json();
    return { status: response.status, text: JSON.stringify(body.cases?.find(item => item.id === id)) };
  }, caseId);
  assert.equal(stored.status, 200); assert.match(stored.text, /PRIVATE_TABLET_FIXTURE_1126/);
  ok('caso cifrado conservado en SQLite después de parada y reinicio');
  stage = 'parent controls and child pairing';
  await page.goto(origin + '/');
  await page.locator('#founderSignOutButton').click();
  await page.locator('#kendraOpenPanel').click();
  await page.locator('#founderSignInButton').click();
  await page.getByRole('button', { name: 'Emparejar un dispositivo nuevo' }).click();
  await page.waitForFunction(() => document.querySelector('.kp-code')?.textContent.startsWith('Código: '));
  const code = (await page.locator('.kp-code').textContent()).split(' ')[1];
  const kidContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await kidContext.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const kid = await kidContext.newPage();
  kid.on('pageerror', error => browserErrors.push(error.message));
  await kid.goto(origin + '/kendra');
  await kid.getByLabel('Código de papá').fill(code);
  await kid.getByRole('button', { name: 'Activar' }).click();
  await kid.locator('.kid-home-grid').waitFor();
  assert.equal(await kid.evaluate(() => sessionStorage.getItem('janus.founder.session')), null);
  await kid.reload();
  await kid.locator('.kid-home-grid').waitFor();
  const denial = await kid.evaluate(async () => (await fetch('/api/parent/kid/overview?kidId=kendra', {
    headers: { authorization: 'Bearer ' + localStorage.getItem('kendra.device.v1') }
  })).status);
  assert.ok([401, 403].includes(denial));
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    await kid.screenshot({ path: join(process.env.SHOTS, 'kendra-inicio-tablet.png') });
  }
  await kid.getByRole('button', { name: 'School', exact: true }).click();
  await kid.locator('.kid-school-subject button').first().waitFor();
  await kid.getByRole('button', { name: 'Baile', exact: true }).click();
  await kid.getByRole('heading', { name: 'Baile', exact: true }).waitFor();
  await kidContext.close();
  await page.locator('#founderSignOutButton').click();
  await page.locator('#kendraPanel').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#kendraPanel').textContent(), '');
  ok('código del tutor, dispositivo infantil independiente, reentrada, School y Baile; controles privados cerrados al salir');

  stage = 'dashboard navigation';
  for (const route of ['/dashboard/a', '/dashboard/b', '/kendra']) {
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200);
    assert.ok(await page.locator('link[rel=manifest]').count());
    if (route.startsWith('/dashboard')) {
      await page.locator('[data-layout="approved-option-2"]').waitFor();
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'founder-' + route.at(-1) + '-tablet.png') });
    }
  }
  ok('dashboards A/B y Kendra servidas por el Core con sus manifests');
  stage = 'service worker installation';
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration('/'))?.active));
  await page.waitForFunction(async () => Boolean(await caches.match('/dashboard/a')) && Boolean(await caches.match('/dashboard/b')));
  const privateCached = await page.evaluate(async () => {
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) {
      if (new URL(request.url).pathname.startsWith('/api/')) return true;
    }
    return false;
  });
  assert.equal(privateCached, false);
  stage = 'offline navigation';
  await context.setOffline(true);
  for (const route of ['/dashboard/a', '/dashboard/b', '/kendra']) {
    const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded' });
    assert.equal(response.status(), 200); assert.ok(await page.locator('#app').count());
  }
  ok('apertura sin conexión de las tres pantallas; ninguna API privada en caché');
  await context.setOffline(false);
  await context.close();
  console.log(`Tablet browser smoke: ${checks.length} bloques PASS (Chromium; Android físico pendiente).`);
} catch (error) {
  console.error('Tablet browser diagnostic:', JSON.stringify({ stage, browserErrors: browserErrors.slice(-12), runtime: log.slice(-1200) }));
  throw error;
} finally {
  await browser?.close(); await stop(); rmSync(dir, { recursive: true, force: true });
}
