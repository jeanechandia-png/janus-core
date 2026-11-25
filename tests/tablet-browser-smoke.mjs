// Nodo real + navegador: alta local, inicio de sesión, cifrado persistente y PWA sin conexión.
// PLAYWRIGHT_MODULE puede apuntar a una instalación de Playwright externa al producto.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import net from 'node:net';
import { configureLocal } from '../scripts/tablet/configure-local.mjs';
import { loadEnvFile } from '../scripts/lib/env-file.mjs';

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
  // Own the actual Core PID so restarting cannot leave an orphan listening on this port.
  const runtimeEnv = { ...env };
  loadEnvFile(env.JANUS_ENV_FILE, runtimeEnv);
  child = spawn(process.execPath, ['--import', 'tsx', join(root, 'apps/runtime/server.ts')], { cwd: root, env: runtimeEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('Runtime exited: ' + log.slice(-1200));
    try { const r = await fetch(origin + '/health', { headers: { connection: 'close' }, cache: 'no-store' }); if (r.ok) return; } catch { /* wait */ }
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
  await page.getByRole('button', { name: 'Nederlands' }).click();
  await page.getByRole('button', { name: 'Dit apparaat koppelen' }).waitFor();
  await page.getByRole('link', { name: 'Kendra’s app openen' }).waitFor();
  await page.getByRole('button', { name: 'Español' }).click();
  const secondTab = await context.newPage();
  await secondTab.goto(origin + '/');
  await Promise.all([page, secondTab].map(tab => tab.locator('#founderLinkButton').click()));
  await secondTab.locator('#founderKeyBox').waitFor({ state: 'visible' });
  await page.locator('#founderKeyBox').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#founderKeyText').inputValue(), await secondTab.locator('#founderKeyText').inputValue());
  await secondTab.close();
  ok('dos pestañas de alta obtienen la misma llave del dispositivo');
  const downloadReady = page.waitForEvent('download');
  await page.locator('#founderKeyDownload').click();
  const download = await downloadReady;
  assert.equal(download.suggestedFilename(), 'janus-founder-public.pem');
  const publicPath = join(dir, 'founder-public.pem'); await download.saveAs(publicPath);
  const publicText = readFileSync(publicPath, 'utf8');
  assert.match(publicText, /BEGIN PUBLIC KEY/); assert.doesNotMatch(publicText, /PRIVATE/);
  ok('vinculación desde la interfaz real; descarga exclusivamente pública');
  stage = 'local deployment check';
  await promisify(execFile)(process.execPath, ['scripts/tablet/check-install.mjs', '--runtime'], { cwd: root, env });
  ok('diagnóstico de entrega identifica las tres pantallas y los archivos servidos por este Core');
  stage = 'first owner sign-in';
  await stop(); configureLocal(env, publicPath); await start();
  const authorityStatus = await (await fetch(origin + '/api/auth/status', { cache:'no-store' })).json();
  assert.equal(authorityStatus.authority.founderConfigured, true);
  assert.equal(authorityStatus.authority.activeSessions, 0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#founderSignInButton').click();
  await page.waitForURL(origin + '/dashboard/a');
  await page.locator('[data-layout="approved-option-2"]').waitFor();
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    await page.screenshot({ path: join(process.env.SHOTS, 'founder-a-tablet.png') });
  }
  const confirmed = await page.evaluate(async () => {
    const token = sessionStorage.getItem('janus.founder.session') || '';
    const response = await fetch('/api/auth/session', { cache:'no-store', headers:{authorization:'Bearer '+token} });
    const body = await response.json();
    return { validFormat: /^janus_auth_[A-Za-z0-9_-]{43}$/.test(token), status: response.status, role: body.principal?.role };
  });
  assert.deepEqual(confirmed, { validFormat:true, status:200, role:'founder_director' });
  ok('llave del navegador conservada; autenticación real tras reiniciar el nodo');
  stage = 'authenticated home data';
  const summary=await page.evaluate(async()=>{
    const allowed=await fetch('/api/founder/home-summary',{cache:'no-store',headers:{authorization:'Bearer '+sessionStorage.getItem('janus.founder.session')}});
    const denied=await fetch('/api/founder/home-summary',{cache:'no-store'});
    return {denied:denied.status,allowed:allowed.status,body:await allowed.json()};
  });
  assert.ok([401,403].includes(summary.denied));
  assert.equal(summary.allowed,200, 'Core: '+(summary.body.error || summary.allowed));
  assert.equal(summary.body.ok,true);
  assert.equal(summary.body.revenue.minor,null,'no fabricated revenue in empty SQLite');
  assert.equal(summary.body.agenda.source,'janus-work-agenda');
  await page.locator('[data-home-card="dia"] .jh-card-body').getByText('Sin citas pendientes en JANUS',{exact:true}).waitFor();
  await page.locator('[data-home-card="ingresos"] .jh-card-body').getByText('Sin datos verificados',{exact:true}).waitFor();
  await page.locator('[data-home-card="dia"] .jh-detail').click();
  await page.locator('[data-founder-live="dia"]').getByText('Sin citas pendientes en JANUS',{exact:true}).waitFor();
  await page.locator('.vh [data-go=""]').click();
  await page.locator('[data-layout="approved-option-2"]').waitFor();
  ok('portada consulta fuentes privadas reales y no inventa ventas');
  stage='integration readiness with isolated credentials';
  const readiness=await page.evaluate(async()=>{
    const path='/api/founder/integration-readiness';
    const denied=await fetch(path,{method:'POST',cache:'no-store'});
    const allowed=await fetch(path,{method:'POST',cache:'no-store',headers:{authorization:'Bearer '+sessionStorage.getItem('janus.founder.session')}});
    return {denied:denied.status,allowed:allowed.status,body:await allowed.json()};
  });
  assert.ok([401,403].includes(readiness.denied));
  assert.equal(readiness.allowed,200);
  assert.equal(readiness.body.results.find(x=>x.service==='gmail').state,'needs_auth');
  assert.equal(readiness.body.results.find(x=>x.service==='calendar').state,'needs_auth');
  assert.ok(!readiness.body.results.some(x=>x.state==='verified'));
  ok('integraciones: sin credenciales no se simula conexión ni se permite acceso anónimo');
  stage = 'integration readiness without credentials';
  const integration=await page.evaluate(async()=>{
    const allowed=await fetch('/api/founder/integration-readiness',{method:'POST',cache:'no-store',headers:{authorization:'Bearer '+sessionStorage.getItem('janus.founder.session')}});
    const denied=await fetch('/api/founder/integration-readiness',{method:'POST',cache:'no-store'});
    return {denied:denied.status,allowed:allowed.status,body:await allowed.json()};
  });
  assert.ok([401,403].includes(integration.denied));
  assert.equal(integration.allowed,200);
  assert.equal(integration.body.ok,true);
  assert.equal(integration.body.results.find(item=>item.service==='gmail').state,'needs_auth');
  assert.equal(integration.body.results.find(item=>item.service==='calendar').state,'needs_auth');
  ok('verificador real protege acceso y no presenta cuentas de prueba como conectadas');
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
  await page.waitForFunction(() => !sessionStorage.getItem('janus.founder.session'));
  await page.locator('#founderSignInButton').click();
  await page.waitForURL(origin + '/dashboard/b');
  await page.locator('[data-layout="approved-option-2"]').waitFor();
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, 'founder-b-tablet.png') });
  const stored = await page.evaluate(async id => {
    const response = await fetch('/api/cases', { headers: { authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') } });
    const body = await response.json();
    return { status: response.status, sessionPresent: Boolean(sessionStorage.getItem('janus.founder.session')), error: body.error, text: JSON.stringify(body.cases?.find(item => item.id === id)) };
  }, caseId);
  assert.equal(stored.status, 200, 'sesión presente: ' + stored.sessionPresent + ', Core: ' + (stored.error || stored.status)); assert.match(stored.text, /PRIVATE_TABLET_FIXTURE_1126/);
  ok('caso cifrado conservado en SQLite después de parada y reinicio');
  stage = 'parent controls and child pairing';
  await page.goto(origin + '/');
  await page.locator('#founderSignOutButton').click();
  await page.locator('#kendraOpenPanel').click();
  await page.reload(); // el alta inicial de la llave puede exigir reiniciar el Core
  await page.locator('#founderSignInButton').click();
  await page.getByRole('button', { name: 'Emparejar un dispositivo nuevo' }).click();
  await page.waitForFunction(() => document.querySelector('.kp-code')?.textContent.startsWith('Código: '));
  const code = (await page.locator('.kp-code').textContent()).split(' ')[1];
  const kidContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await kidContext.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const kid = await kidContext.newPage();
  kid.on('pageerror', error => browserErrors.push(error.message));
  await kid.goto(origin + '/kendra');
  await kid.getByRole('button', { name: 'Nederlands' }).click();
  await kid.getByLabel("Papa's code").fill('INVALID');
  await kid.getByRole('button', { name: 'Activeren' }).click();
  await kid.getByRole('alert').getByText(/Deze code is ongeldig/).waitFor();
  await kid.getByLabel("Papa's code").fill(code);
  await kid.getByRole('button', { name: 'Español' }).click();
  assert.equal(await kid.getByLabel('Código de papá').inputValue(), code);
  await kid.getByRole('alert').getByText(/Ese código no sirve/).waitFor();
  ok('alta infantil ES/NL, error de código real y cambio de idioma conservando la entrada');
  await kid.getByRole('button', { name: 'Activar' }).click();
  await kid.locator('.kid-home-grid').waitFor();
  assert.equal(await kid.evaluate(() => sessionStorage.getItem('janus.founder.session')), null);
  await kid.reload();
  await kid.locator('.kid-home-grid').waitFor();
  const denial = await kid.evaluate(async () => (await fetch('/api/parent/kid/overview?kidId=kendra', {
    headers: { authorization: 'Bearer ' + localStorage.getItem('kendra.device.v1') }
  })).status);
  assert.ok([401, 403].includes(denial));
  const secondRowVisible = await kid.evaluate(() => {
    const nextRow = document.querySelector('.kid-media h3').getBoundingClientRect();
    return nextRow.bottom <= document.querySelector('nav.tabs').getBoundingClientRect().top;
  });
  assert.ok(secondRowVisible, 'La fila de vídeos y recordatorios debe empezar a la vista a 1280×800');
  if (process.env.SHOTS) {
    mkdirSync(process.env.SHOTS, { recursive: true });
    await kid.screenshot({ path: join(process.env.SHOTS, 'kendra-inicio-tablet.png') });
  }
  await kid.evaluate(() => window.JanusGLTF.MeshoptDecoder.ready);
  const setPracticeWindow = async (allowedFrom, allowedUntil) => {
    const status = await page.evaluate(async limits => (await fetch('/api/parent/kid/settings', {
      method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + sessionStorage.getItem('janus.founder.session') },
      body: JSON.stringify({ kidId: 'kendra', timeZone: 'UTC', limits }),
    })).status, { allowedFrom, allowedUntil });
    assert.equal(status, 200);
  };
  await page.getByLabel('Objetivo de práctica').selectOption('mat-amigos');
  await page.getByRole('button', {name:'Guardar objetivo'}).click();
  await page.getByText('Objetivo en curso · Completa el diez').waitFor();
  await setPracticeWindow('00:00', '00:00');
  await kid.getByRole('navigation').getByRole('button', { name: 'School', exact: true }).click();
  await kid.getByText(/Ahora toca descansar/).first().waitFor();
  assert.equal(await kid.locator('.kid-school-subject').count(), 0);
  const hour = new Date().getUTCHours();
  const hourAt = delta => String((hour + delta + 24) % 24).padStart(2, '0') + ':00';
  await setPracticeWindow(hourAt(-2), hourAt(2));
  await kid.getByRole('button', { name: 'Reintentar', exact: true }).click();
  const goalSection = kid.locator('section').filter({has: kid.getByRole('heading', {name:'Mi objetivo', exact:true})});
  await goalSection.getByRole('button', {name:'Completa el diez', exact:true}).first().click();
  const finishExercise = async () => {
    await kid.getByRole('button', {name:'Siguiente', exact:true}).click();
    await kid.getByRole('button', {name:'Terminar', exact:true}).click();
  };
  await finishExercise();
  await kid.getByRole('button', {name:'2', exact:true}).click();
  await kid.getByText(/Buen intento/).waitFor();
  await kid.getByRole('button', {name:'Elegir otro ejercicio'}).click();
  const review = kid.getByRole('heading', {name:'Para volver a practicar', exact:true});
  await review.locator('..').getByRole('button', {name:'Completa el diez'}).click();
  await finishExercise();
  await kid.getByRole('button', {name:'3', exact:true}).click();
  await kid.getByText(/7 \+ 3 = 10/).waitFor();
  await kid.getByRole('button', {name:'Elegir otro ejercicio'}).click();
  await kid.getByRole('heading', {name:'Objetivo completado'}).waitFor();
  assert.equal(await review.count(), 0);
  await kid.getByRole('button', {name:'Nederlands'}).click();
  await kid.getByRole('heading', {name:'Oefendoel behaald'}).waitFor();
  await kid.getByRole('button', {name:'Español'}).click();
  await page.locator('#kendraPanel').getByRole('button', {name:'Actualizar',exact:true}).click();
  await page.getByText('Objetivo completado · Completa el diez').waitFor();
  ok('objetivo parental, repaso tras error y confirmación bilingüe del acierto en ambas sesiones');
  await kid.getByRole('navigation').getByRole('button', { name: 'Baile', exact: true }).click();
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
