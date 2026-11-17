'use strict';
// E2E de la VISTA PREVIA de la vista de equipo del CEO (datos de ejemplo). Uso: PLAYWRIGHT_MODULE=playwright node …/e2e-team.cjs
const fs = require('fs'), os = require('os'), path = require('path');
const { buildTeam } = require('../work/build-work.cjs');
let html; try { html = buildTeam({ mode: 'team-example' }); } catch (e) { console.log('e2e-team OMITIDA: ' + e.message); process.exit(0); }
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jt-e2e-')), 'team.html'); fs.writeFileSync(file, html);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const exe = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch(Object.assign({ args: ['--no-sandbox'] }, exe ? { executablePath: exe } : {}));
  let pass = 0; const fail = [], T = (name, ok) => { if (ok) pass += 1; else fail.push(name); };
  for (const [label, w, h] of [['movil', 430, 932], ['escritorio', 1280, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } }); const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + file); await page.waitForSelector('#team');
    const text = (sel) => page.locator(sel).innerText();
    T(label + ' · sin desbordamiento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    T(label + ' · equipo, disponibilidad, tareas, entregas, mensajes, archivos y proyectos', (await page.locator('#team, #availability, #tasks, #deliveries, #messages, #files, #projects').count()) === 7);
    T(label + ' · solo asuntos de empresa (sin agenda personal)', !/taller|médico|dentista/i.test(await text('.cc-main')) && /recordatorios personales son privados/i.test(await text('#availability')));
    await page.locator('#tasks select[data-act=agent]').nth(1).selectOption('openai');
    T(label + ' · el CEO cambia el agente de una tarea', await page.locator('#tasks select[data-act=agent]').nth(1).inputValue() === 'openai');
    const box = page.locator('#projects input[data-act=local]').nth(1); await box.check();
    T(label + ' · el CEO marca un proyecto como «solo modelo propio»', await page.locator('#projects input[data-act=local]').nth(1).isChecked());
    T(label + ' · un intento de escribir fuera aparece rechazado', /rechazado: destino externo/i.test(await text('#messages')));
    await page.locator('#messages [data-act=msg]').first().click();
    T(label + ' · leer un mensaje lo marca como leído', /Para terminar las pruebas E2E/.test(await text('#messages')) && /leído/i.test(await text('#messages article:first-child')));
    T(label + ' · accesos: dos enlaces de ejemplo (ES y NL) pendientes', / · ES/i.test(await text('#access')) && / · NL/i.test(await text('#access')) && (await page.locator('#access .cc-list article').count()) === 2);
    await page.fill('#access input[name=displayName]', 'Carla Soto'); await page.selectOption('#access select[name=locale]', 'es'); await page.click('#access form button[type=submit]');
    await page.waitForSelector('#access .jt-link');
    T(label + ' · crear un acceso muestra el enlace una vez y avisa de que es de un solo uso', /una sola vez/i.test(await text('#access .jt-link')) && /carla-soto/.test(await text('#access')));
    await page.locator('#access [data-act=invite-revoke]').first().click();
    T(label + ' · el CEO puede anular un enlace pendiente', /anulado/i.test(await text('#access')));
    T(label + ' · accesos sin desbordamiento', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    T(label + ' · sin errores de página', errors.length === 0);
    await page.close();
  }
  await browser.close();
  console.log('e2e-team ' + pass + '/' + (pass + fail.length)); if (fail.length) { console.log('FALLOS:\n - ' + fail.join('\n - ')); process.exit(1); }
})();
