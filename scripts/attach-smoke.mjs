#!/usr/bin/env node
// Prueba de humo en navegador real (Chromium + cámara simulada con un QR de verdad) del botón «+» de la PWA.
// Requiere Playwright con Chromium y ffmpeg. Uso: node scripts/attach-smoke.mjs [captura.png]
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(new URL('..', import.meta.url).pathname);
const work = mkdtempSync(join(tmpdir(), 'attach-smoke-'));
const screenshot = process.argv[2] ? resolve(process.argv[2]) : join(work, 'attach-menu.png');

// 1) Vídeo falso de cámara: un QR real (matriz de pruebas) ampliado sobre fondo blanco.
const fixtures = JSON.parse(readFileSync(`${root}/tests/fixtures/qr-matrices.json`, 'utf8'));
const rows = fixtures.url.rows;
const scale = 12, quiet = 4, size = (rows.length + quiet * 2) * scale;
const rgb = Buffer.alloc(size * size * 3, 255);
rows.forEach((row, y) => [...row].forEach((cell, x) => {
  if (cell !== '1') return;
  for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
    const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 3;
    rgb[i] = rgb[i + 1] = rgb[i + 2] = 0;
  }
}));
writeFileSync(`${work}/qr.ppm`, Buffer.concat([Buffer.from(`P6\n${size} ${size}\n255\n`), rgb]));
const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-i', `${work}/qr.ppm`, '-t', '3', '-r', '10', '-vf', 'scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:white', '-pix_fmt', 'yuv420p', `${work}/qr.y4m`]);
assert.equal(ff.status, 0, `ffmpeg: ${ff.stderr}`);

// 2) Servidor real de Janus (base en memoria, sin secretos).
const port = await new Promise((res, rej) => { const s = createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', 'tsx', 'apps/runtime/server.ts'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), JANUS_DB: ':memory:', JANUS_CREDENTIAL_VAULT_KEY: randomBytes(32).toString('base64'), JANUS_CREDENTIAL_VAULT_PATH: '', JANUS_MODEL_BASE_URL: '', JANUS_MODEL_NAME: '', GITHUB_TOKEN: '', NETLIFY_AUTH_TOKEN: '', GOOGLE_ACCESS_TOKEN: '' },
  stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 150; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* arrancando */ } await new Promise((r) => setTimeout(r, 100)); }

  browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${work}/qr.y4m`] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base, { waitUntil: 'domcontentloaded' });

  const plus = page.locator('.jx-att-plus');
  await plus.waitFor({ timeout: 10_000 });
  assert.equal(await plus.getAttribute('aria-expanded'), 'false');
  await plus.click();
  const items = await page.locator('.jx-att-menu [role=menuitem]').allTextContents();
  assert.equal(items.length, 4, `menú: ${items.join(' | ')}`);
  await page.screenshot({ path: screenshot });

  // Archivo peligroso: se rechaza en el navegador, sin subir nada.
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.jx-att-menu button', { hasText: 'Archivos' }).click();
  await (await chooser).setFiles({ name: 'foto.jpg.exe', mimeType: 'image/jpeg', buffer: Buffer.from('MZ00') });
  await page.locator('.jx-att-chip[data-state=error]').first().waitFor({ timeout: 5_000 });
  assert.match(await page.locator('.jx-att-chip[data-state=error]').first().innerText(), /seguridad/);

  // Archivo válido sin sesión de Founder: el servidor no lo acepta y el aviso lo explica.
  await page.locator('.jx-att-chip[data-state=error] button').first().click();
  await plus.click();
  const chooser2 = page.waitForEvent('filechooser');
  await page.locator('.jx-att-menu button', { hasText: 'Archivos' }).click();
  await (await chooser2).setFiles({ name: 'precios.csv', mimeType: 'text/csv', buffer: Buffer.from('producto;precio\nmódulo;120') });
  await page.locator('.jx-att-chip[data-state=error]').first().waitFor({ timeout: 5_000 });
  assert.match(await page.locator('.jx-att-chip[data-state=error]').first().innerText(), /Founder/);
  await page.locator('.jx-att-chip[data-state=error] button').first().click();

  // Escáner: la cámara simulada muestra un QR real y el decodificador lo lee (nada se abre solo).
  await plus.click();
  await page.locator('.jx-att-menu button', { hasText: 'Escanear código' }).click();
  await page.locator('.jx-att-scan').waitFor({ timeout: 5_000 });
  await page.locator('.jx-att-chip', { hasText: 'Código:' }).waitFor({ timeout: 15_000 });
  const chip = await page.locator('.jx-att-chip', { hasText: 'Código:' }).innerText();
  assert.match(chip, /janus\.example/);
  assert.equal(await page.locator('.jx-att-scan').count(), 0, 'el escáner se cierra al leer');
  assert.equal(await page.locator('a[href*="janus.example"]').count(), 0, 'el enlace escaneado no se abre ni se pinta como enlace');
  assert.deepEqual(errors, []);
  console.log(`attach smoke ok · captura: ${screenshot}`);
} finally {
  await browser?.close();
  server.kill('SIGKILL');
  if (!process.argv[2]) rmSync(work, { recursive: true, force: true });
}
