#!/usr/bin/env node
// Prueba de humo en navegador real (Chromium) de la app de la niña: /kendra.
// Arranca el servidor real de Janus (base en memoria), empareja con un código de verdad y recorre las pantallas.
// Uso: node scripts/kendra-smoke.mjs [directorio-de-capturas]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const shots = process.argv[2] ? resolve(process.argv[2]) : mkdtempSync(join(tmpdir(), 'kendra-smoke-'));
mkdirSync(shots, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'kendra-devices-'));
const devicesPath = join(work, 'home-devices.json');
writeFileSync(devicesPath, JSON.stringify([{ id: 'dev-cama', name: 'Luz de la cama', room: 'cama', kind: 'light' }]));

const port = await new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = `http://127.0.0.1:${port}`;
const keys = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const server = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), JANUS_DB: ':memory:', JANUS_TIME_ZONE: 'Europe/Amsterdam', JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'), JANUS_CREDENTIAL_VAULT_PATH: '', JANUS_FOUNDER_PUBLIC_KEY_PEM: keys.publicKey, JANUS_HOME_DEVICES_PATH: devicesPath, JANUS_KID_WEATHER: 'off', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', GITHUB_TOKEN: '', NETLIFY_AUTH_TOKEN: '', GOOGLE_ACCESS_TOKEN: '' },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 200; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* arrancando */ } await new Promise((r) => setTimeout(r, 100)); }

  const jsonCall = async (method, path, headers, body) => {
    const response = await fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const challenge = (await jsonCall('POST', '/api/auth/challenge', {}, { principalId: 'founder' })).body;
  const signature = sign('sha256', Buffer.from(challenge.challenge.signingPayload, 'utf8'), keys.privateKey).toString('base64url');
  const session = (await jsonCall('POST', '/api/auth/verify', {}, { challengeId: challenge.challenge.id, principalId: 'founder', signature })).body.session.token;
  const founder = { authorization: `Bearer ${session}` };
  await jsonCall('PUT', '/api/parent/kid/settings', founder, { kidId: 'kendra', limits: { allowedFrom: '00:00', allowedUntil: '23:59', totalDailyMinutes: 600, perCategoryMinutes: {}, warnMinutesBefore: 5 } });
  const code = (await jsonCall('POST', '/api/parent/kid/pairing', founder, { kidId: 'kendra' })).body.code;

  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });

  // 1) Emparejar con el código.
  await page.goto(`${base}/kendra`, { waitUntil: 'domcontentloaded' });
  await page.locator('input.code').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, '1-emparejar.png') });
  await page.fill('input.code', code);
  await page.click('button:has-text("Activar")');
  await page.locator('h2:has-text("¡Hola, Peque!")').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, '2-inicio.png') });

  // 2) Personalizar: nombre, icono, color y compañero (lo hace ELLA).
  await page.click('.top .who');
  await page.fill('.sheet input[type=text]', 'Kendra');
  await page.click('.sheet .icons button:nth-child(8)');
  await page.click('.sheet .themes button:nth-child(2)');
  await page.click('.sheet .creatures button:has-text("Bombo")');
  await page.screenshot({ path: join(shots, '3-personalizar.png') });
  await page.click('.sheet button:has-text("Guardar")');
  await page.locator('h2:has-text("¡Hola, Kendra!")').waitFor({ timeout: 10_000 });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'menta');

  // 3) Chat: normal responde; lo adulto se frena con un mensaje amable.
  await page.click('nav.tabs button:has-text("Charla")');
  await page.fill('.composer input[type=text]', 'hola, cuéntame algo de los zorros');
  await page.click('.composer button:has-text("Enviar")');
  await page.locator('.msg.pet').nth(1).waitFor({ timeout: 10_000 });
  await page.fill('.composer input[type=text]', 'quiero ver porno');
  await page.click('.composer button:has-text("Enviar")');
  await page.locator('.msg.pet').nth(2).waitFor({ timeout: 10_000 });
  assert.ok(await page.locator('.jx-att-plus').isVisible(), 'el «+» está en su chat');
  await page.screenshot({ path: join(shots, '4-chat.png') });

  // 4) Agenda por frase y tarea.
  await page.click('nav.tabs button:has-text("Mi día")');
  await page.fill('input[aria-label="Apuntar en mi agenda"]', 'mañana a las 5 tengo dentista');
  await page.click('button:has-text("Apuntar")');
  await page.locator('li:has-text("dentista")').first().waitFor({ timeout: 10_000 });
  await page.fill('input[aria-label="Nueva tarea"]', 'Terminar el dibujo de Stitch');
  await page.click('button:has-text("Añadir")');
  await page.locator('li:has-text("Terminar el dibujo de Stitch")').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, '5-mi-dia.png') });

  // 5) Vídeo: sin lista → petición a papá; con lista aprobada → iframe con sandbox y youtube-nocookie.
  await page.click('nav.tabs button:has-text("Ver")');
  await page.fill('input[aria-label="¿Qué quieres ver?"]', 'ponme videos de baile coreano en youtube');
  await page.click('button:has-text("Pedir")');
  await page.locator('p[role=status]:has-text("papá")').waitFor({ timeout: 10_000 });
  const approve = await jsonCall('PUT', '/api/parent/kid/settings', founder, { kidId: 'kendra', media: { youtube: { mode: 'allowlist', channels: [], videos: [{ id: 'dQw4w9WgXcQ', label: 'Baile de prueba' }] }, netflix: { mode: 'off' } } });
  assert.equal(approve.status, 200);
  await page.click('nav.tabs button:has-text("Inicio")');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('nav.tabs button:has-text("Ver")');
  await page.click('button.vid:has-text("Baile de prueba")');
  const frame = page.locator('.player iframe');
  await frame.waitFor({ timeout: 10_000 });
  assert.match(await frame.getAttribute('src'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
  assert.match(await frame.getAttribute('sandbox'), /allow-scripts/);
  assert.ok(!(await frame.getAttribute('sandbox')).includes('allow-popups') && !(await frame.getAttribute('sandbox')).includes('allow-top-navigation'));
  await page.click('button:has-text("Cerrar el vídeo")');

  // 6) Casa: apagada → mensaje amable; el tutor la activa → modo latente (aún sin Tuya).
  await page.click('nav.tabs button:has-text("Casa")');
  await page.click('button:has-text("Hacer")');
  await page.fill('input[aria-label="Qué quieres hacer en la casa"]', 'apaga la luz de la cama');
  await page.click('button:has-text("Hacer")');
  await page.locator('p[role=status]:not(:empty)').first().waitFor({ timeout: 10_000 });
  await jsonCall('PUT', '/api/parent/kid/settings', founder, { kidId: 'kendra', home: { enabled: true, allowedRooms: ['cama'], allowedKinds: ['light'] } });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('nav.tabs button:has-text("Casa")');
  await page.fill('input[aria-label="Qué quieres hacer en la casa"]', 'apaga la luz de la cama');
  await page.click('button:has-text("Hacer")');
  await page.locator('p[role=status]:has-text("todavía no estoy conectado")').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: join(shots, '6-casa.png') });

  // 7) Zona de padres: sin PIN no entra; con PIN se abre el panel con el aviso del filtro.
  await page.click('button[aria-label="Zona de padres"]');
  await page.fill('.sheet input.pin', '4826');
  await page.click('.sheet button:has-text("Entrar")');
  await page.locator('.sheet p.err:has-text("PIN")').waitFor({ timeout: 10_000 });
  await jsonCall('POST', '/api/parent/kid/pin', founder, { kidId: 'kendra', pin: '4826' });
  await page.fill('.sheet input.pin', '0000');
  await page.click('.sheet button:has-text("Entrar")');
  await page.locator('.sheet p.err:has-text("incorrecto")').waitFor({ timeout: 10_000 });
  await page.fill('.sheet input.pin', '4826');
  await page.click('.sheet button:has-text("Entrar")');
  await page.locator('.sheet h2:has-text("Panel de padres")').waitFor({ timeout: 10_000 });
  await page.locator('.sheet .kp-card:has-text("Avisos del filtro") .kp-sev-block').waitFor({ timeout: 10_000 });
  assert.equal(await page.locator('.sheet button:has-text("Emparejar un dispositivo nuevo")').count(), 0, 'con PIN no se empareja ni se cambia el PIN');
  await page.screenshot({ path: join(shots, '7-padres.png'), fullPage: false });

  // 8) La tarjeta del dashboard de Jean existe y la página carga sin errores.
  const jean = await context.newPage();
  jean.on('pageerror', (error) => problems.push(`pageerror(jean): ${error.message}`));
  await jean.goto(base, { waitUntil: 'domcontentloaded' });
  await jean.locator('#kendraOpenPanel').waitFor({ timeout: 10_000 });
  assert.equal(await jean.getAttribute('#kendraOpenApp', 'href'), '/kendra');

  assert.deepEqual(problems.filter((item) => !/Failed to load resource|youtube-nocookie/i.test(item)), [], `errores en la página:\n${problems.join('\n')}`);
  console.log(`OK · capturas en ${shots}`);
} finally {
  await browser?.close();
  server.kill('SIGKILL');
}
