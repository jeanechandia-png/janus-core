'use strict';
// E2E de la VISTA PREVIA de JANUS Work (datos de ejemplo) en Chromium: móvil, tablet y escritorio.
// Uso: PLAYWRIGHT_MODULE=playwright [CHROME_PATH=…] node prototypes/dashboard/tests/e2e-work.cjs [--shots dir]
// Necesita la piel privada de IBA en prototypes/dashboard/local/ (si falta, termina con aviso y código 0).
const fs = require('fs'), os = require('os'), path = require('path');
const { buildWork } = require('../work/build-work.cjs');
const shotsArg = process.argv.indexOf('--shots'); const SHOTS = shotsArg > 0 ? process.argv[shotsArg + 1] : '';
let html;
try { html = buildWork({ mode: 'example', publicSafe: true }); } catch (e) { console.log('e2e-work OMITIDA: ' + e.message); process.exit(0); }
const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jw-e2e-')), 'work.html'); fs.writeFileSync(file, html);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let pass = 0; const fail = [];
const check = (name, cond) => { if (cond) pass++; else fail.push(name); };

(async () => {
  const chrome = process.env.CHROME_PATH || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ ...(chrome ? { executablePath: chrome } : {}), args: ['--no-sandbox'] });
  for (const [label, width, height, touch] of [['movil', 430, 932, true], ['tablet', 1194, 834, true], ['escritorio', 1440, 900, false]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, locale: 'es-ES' });
    const page = await context.newPage(); const errors = [], requests = [];
    page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) requests.push(r.url()); });
    await page.goto('file://' + file); await page.waitForSelector('.cc-shell');
    const T = (name, cond) => check(label + ' · ' + name, cond);
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    const text = (sel) => page.locator(sel).innerText();

    T('carga con la piel de IBA', await page.locator('.cc-sidebar .cc-wordmark').count() === 1 && await page.locator('.cc-panel').count() >= 7);
    T('rotulada como vista previa con datos de ejemplo', /VISTA PREVIA · DATOS DE EJEMPLO/.test(await text('.jw-example')));
    T('sin desbordamiento horizontal', await noOverflow());
    T('todas las secciones presentes', (await page.evaluate(() => ['today', 'assistant', 'tasks', 'project', 'documents', 'deliveries', 'instructions', 'session', 'permissions'].every((id) => document.getElementById(id)))));
    T('la navegación apunta a secciones que existen', await page.evaluate(() => [...document.querySelectorAll('.cc-sidebar nav a')].every((a) => document.querySelector(a.getAttribute('href')))));
    T('solo texto: sin micrófono ni audio (la cámara solo sirve para fotos y códigos)', await page.locator('audio, [class*=mic], [data-act*=voice], input[capture]:not([accept="image/*"])').count() === 0 && !/audio:\s*(true|\{)/.test(html));
    T('archivos: adjuntar, hacer foto y escanear código disponibles', await page.locator('#documents [data-act=pick-file]').count() === 1 && await page.locator('#documents [data-act=pick-cam]').count() === 1 && await page.locator('#documents [data-act=scan]').count() === 1);
    T('archivos: sin descarga; se abren dentro del panel con marca de agua', await page.locator('[data-act=download], a[download]').count() === 0 && await page.locator('#documents [data-act=view]').count() >= 1);
    await page.locator('#documents [data-act=view]').first().click(); await page.waitForSelector('.jw-viewer');
    T('visor: marca de agua con la persona y cierre', /Colaborador A/.test(await page.locator('.jw-viewer-mark span').first().innerText())); await page.click('.jw-viewer-x'); await page.waitForSelector('.jw-viewer', { state: 'detached' });
    T('agenda: muestra lo personal y lo de trabajo con su etiqueta', /personal/i.test(await text('#agenda')) && /trabajo/i.test(await text('#agenda')));
    await page.fill('#agenda input[name=text]', 'Prueba <b>agenda</b>'); await page.click('#agenda button[type=submit]');
    T('agenda: añade un recordatorio (privado por defecto, escapado)', /Prueba <b>agenda<\/b>/.test(await text('#agenda')) && await page.locator('#agenda b:text-is("agenda")').count() === 0);
    const before = await page.locator('#agenda .cc-list article').count(); await page.locator('#agenda [data-act=agenda-del]').last().click();
    T('agenda: quitar un elemento', await page.locator('#agenda .cc-list article').count() === before - 1);
    await page.fill('#jw-chat-input', 'Recuérdame mañana a las 17:30 llamar al proveedor'); await page.click('form[data-form=chat] button[type=submit]');
    await page.waitForFunction(() => /llamar al proveedor/i.test(document.querySelector('#agenda').innerText));
    T('chat: «recuérdame…» crea el recordatorio en la agenda y lo confirma', /17:30/.test(await text('#agenda')) && /Anotado en tu agenda/.test(await text('#assistant')));
    await page.click('#project [data-act=project-new]'); await page.fill('.jw-project-form input[name=name]', 'Proyecto de prueba'); await page.click('.jw-project-form button[type=submit]');
    T('proyecto propio: se crea, queda seleccionado y marcado como abierto por ti', /Proyecto de prueba/.test(await text('#project')) && /Abierto por ti/i.test(await text('#project')) && await page.locator('select[data-act=project]').inputValue() !== 'p-api');
    await page.selectOption('select[data-act=project]', 'p-api');
    T('proyecto confidencial: muestra «solo modelo propio»', /Solo modelo propio/i.test(await text('#project')) && /Solo modelo propio/i.test(await text('#assistant')));
    await page.fill('#messages input[name=subject]', 'Consulta <i>x</i>'); await page.fill('#messages textarea[name=body]', 'Necesito acceso.'); await page.click('#messages button[type=submit]');
    T('mensaje interno: enviado al CEO, sin campo para destinatarios externos', /Consulta <i>x<\/i>/.test(await text('#messages')) && await page.locator('#messages input[type=email], #messages input[name=recipient]').count() === 0 && await page.locator('#messages select[name=recipient] option').count() === 1);
    await page.click('#documents [data-act=scan]'); await page.waitForSelector('.jat-scan');
    T('lector de códigos: se abre y se cierra', await page.locator('.jat-scan .jat-x').count() === 1); await page.click('.jat-scan .jat-x'); await page.waitForSelector('.jat-scan', { state: 'detached' });
    // Códigos de barras clásicos: se dibuja el patrón en un lienzo y lo lee la MISMA pieza que usa la cámara.
    const readBars = (bits) => page.evaluate(async (pattern) => { const m = '0'.repeat(12) + pattern + '0'.repeat(12), k = 3, c = document.createElement('canvas'); c.width = m.length * k; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111'; for (let i = 0; i < m.length; i += 1) if (m[i] === '1') x.fillRect(i * k, 20, k, 80); const r = await JanusAttach.decodeQR(c); return r ? r.format + ':' + r.text : 'nada'; }, bits);
    T('lector: lee un código de barras EAN-13', await readBars("00000000000010100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101") === "ean_13:5901234123457");
    T('lector: lee un código de barras Code 128', await readBars("1101001000010110111000101000110001011100011011011101110110111010001001101110010111011110110010011101110010011011101011110101110011001010001100011101101110110001000101100011101011") === "code_128:JANUS-2026/A7");
    T('voz mostrada como no disponible', /Voz[\s\S]*no disponible en dashboards laborales/.test(await text('#permissions')));
    T('reservado al CEO visible', (await page.locator('#permissions .status-draft').count()) >= 6 && /Pagos[\s\S]*solo CEO/i.test(await text('#permissions')));
    T('instrucciones de proyecto de solo lectura', await page.locator('#project textarea, #project input, #instructions textarea, #instructions input').count() === 0);

    // Medallones de idioma
    T('tres medallones cargados', await page.locator('.janus-language-button img').evaluateAll((n) => n.length === 3 && n.every((i) => i.complete && i.naturalWidth === 192)));
    T('medallón activo iluminado = ES', await page.locator('.janus-language-button.is-lit').getAttribute('data-language') === 'es');
    T('objetivo táctil ≥ 44 px', await page.locator('.janus-language-button').evaluateAll((n) => n.every((b) => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)));
    const dim = await page.locator('.janus-language-button[data-language=nl]').evaluate((b) => getComputedStyle(b).filter);
    const lit = await page.locator('.janus-language-button.is-lit').evaluate((b) => getComputedStyle(b).filter);
    T('el iluminado se distingue del apagado', dim !== lit && /drop-shadow/.test(lit));
    await page.click('.janus-language-button[data-language=en]');
    T('EN: cambia textos y atributo lang', /What needs your attention today\?/.test(await text('.cc-topbar h1')) && await page.evaluate(() => document.documentElement.lang) === 'en');
    T('EN: sin restos en español en rótulos', !/Mis tareas|Sesión de trabajo|Cerrar sesión/.test(await text('.cc-main')));
    await page.click('.janus-language-button[data-language=es]');

    // Una sola plantilla, otra configuración
    await page.click('[data-act=persona][data-v="colab-b"]');
    T('persona B: neerlandés por configuración', /Wat vraagt vandaag je aandacht\?/.test(await text('.cc-topbar h1')) && await page.locator('.janus-language-button.is-lit').getAttribute('data-language') === 'nl');
    T('persona B: solo sus datos', /Acquisitie Nederland/.test(await text('.cc-main')) && !/Proyecto API|Paginación/.test(await text('.cc-main')));
    T('persona B: sin desbordamiento', await noOverflow());
    await page.click('#documents [data-act=scan]'); await page.waitForSelector('.jat-scan');
    T('persona B: lector en neerlandés y con la piel de IBA', /Code scannen/.test(await page.locator('.jat-scan .jat-ttl').innerText()) && await page.locator('.jat-scan.jat-theme-iba').count() === 1 && !/Escanear|Linterna|Hacer foto/.test(await page.locator('.jat-scan').innerText()));
    await page.click('.jat-scan .jat-x'); await page.waitForSelector('.jat-scan', { state: 'detached' });
    await page.click('[data-act=persona][data-v="colab-c"]');
    T('persona C: sin instrucciones → estado vacío claro', /El CEO aún no ha definido instrucciones/.test(await text('#instructions')));
    await page.click('[data-act=persona][data-v="colab-a"]');

    // Proyecto de solo lectura: sin chat
    await page.selectOption('select[data-act=project]', 'p-web');
    T('proyecto sin permiso de escritura: chat cerrado', await page.locator('#jw-chat-input').count() === 0 && /solo lectura/.test(await text('#project')));
    await page.selectOption('select[data-act=project]', 'p-api');

    // Sesión de trabajo
    await page.click('[data-act=sess][data-v=pause]');
    T('sesión: pausa', /en pausa/i.test(await text('#session')) && await page.locator('[data-act=sess][data-v=resume]').count() === 1);
    await page.click('[data-act=sess][data-v=resume]'); await page.click('[data-act=sess][data-v=end]');
    T('sesión: fin → se puede iniciar otra', await page.locator('[data-act=sess][data-v=start]').count() === 1);
    await page.click('[data-act=sess][data-v=start]');
    T('sesión: inicio', /en marcha/i.test(await text('#session')));
    T('aviso de no vigilancia', /no vigila tu equipo/.test(await text('#session')));

    // Registro de avance con validación y texto hostil
    await page.click('.cc-top-actions [data-act=progress]'); await page.waitForSelector('#jw-form');
    await page.evaluate(() => document.querySelector('#jw-form textarea[name=summary]').removeAttribute('required'));
    await page.click('#jw-form button[type=submit]');
    T('formulario: exige resumen', /Escribe un resumen/.test(await text('#jw-form')));
    await page.fill('#jw-form textarea[name=done]', 'uno\ndos');
    await page.click('.janus-language-button[data-language=nl]');
    T('formulario: conserva lo escrito al cambiar de idioma', await page.locator('#jw-form textarea[name=done]').inputValue() === 'uno\ndos');
    await page.click('.janus-language-button[data-language=es]');
    await page.fill('#jw-form textarea[name=summary]', '<img src=x onerror="window.__xss=1"> avance & "prueba"');
    await page.fill('#jw-form textarea[name=blockers]', 'esperando acceso');
    await page.click('#jw-form button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('#jw-form'));
    T('avance guardado y visible', /avance & "prueba"/.test(await text('#deliveries')) && /Registro guardado/.test(await text('.cc-main')));
    T('texto hostil escapado (sin XSS)', await page.evaluate(() => !window.__xss && !document.querySelector('#deliveries img')));
    await page.locator('#tasks [data-act=deliver]').first().click(); await page.waitForSelector('#jw-form');
    T('entregar: marca completar por defecto', await page.locator('#jw-form select[name=complete]').inputValue() === '1');
    await page.fill('#jw-form textarea[name=summary]', 'Entrega final'); await page.click('#jw-form button[type=submit]');
    await page.waitForFunction(() => !document.querySelector('#jw-form'));
    T('entrega: la tarea pasa a completada y pierde acciones', /completada/i.test(await text('#tasks article:first-child')) && await page.locator('#tasks article:first-child [data-act=deliver]').count() === 0);

    // Chat escrito (simulado y rotulado)
    await page.click('[data-act=prompt][data-v=prompt1]');
    T('sugerencia rellena el cuadro', await page.locator('#jw-chat-input').inputValue() === '¿Cuál es mi siguiente paso?');
    await page.click('form[data-form=chat] button[type=submit]'); await page.waitForFunction(() => /SIMULADA/i.test((Array.from(document.querySelectorAll('.jw-msg.jw-janus')).pop() || {}).innerText || ''));
    const lastReply = await page.locator('.jw-msg.jw-janus').last().innerText();
    T('chat: respuesta rotulada como simulada', /RESPUESTA SIMULADA/.test(lastReply) && /Proyecto API/.test(lastReply));
    await page.click('[data-act=chat-new]');
    T('nueva conversación limpia el hilo', await page.locator('.jw-msg').count() === 0);
    T('continuidad visible', /Continuidad activa/.test(await text('#assistant')));

    T('sin errores de consola', errors.length === 0); if (errors.length) console.log(label, errors.slice(0, 3));
    T('sin ninguna petición de red', requests.length === 0); if (requests.length) console.log(label, requests.slice(0, 3));
    T('sin desbordamiento al final', await noOverflow());
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.reload(); await page.waitForSelector('.cc-shell');
      await page.screenshot({ path: path.join(SHOTS, 'work-' + label + '-es.png'), fullPage: label !== 'movil' });
      await page.click('[data-act=persona][data-v="colab-b"]');
      await page.screenshot({ path: path.join(SHOTS, 'work-' + label + '-nl.png') });
    }
    await context.close();
  }
  await browser.close();
  console.log('e2e-work ' + pass + '/' + (pass + fail.length)); if (fail.length) { console.log('FALLOS:\n - ' + fail.join('\n - ')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
