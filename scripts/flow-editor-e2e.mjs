#!/usr/bin/env node
// Prueba de extremo a extremo del editor de flujos con un navegador real (Playwright + Chromium).
// No forma parte de `npm test` (necesita Playwright y un Chromium instalados). Uso:
//   node scripts/build-flow-editor.mjs && node scripts/flow-editor-e2e.mjs [carpeta-de-capturas]
// Variables: PLAYWRIGHT_DIR (carpeta node_modules que contiene playwright), CHROMIUM (ruta del ejecutable).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const shots = resolve(process.argv[2] ?? `${root}/dist/flow-editor/capturas`);
mkdirSync(shots, { recursive: true });
const html = `file://${root}/dist/flow-editor/janus-flujos.html`;
if (!existsSync(`${root}/dist/flow-editor/janus-flujos.html`)) { console.error('Falta compilar: node scripts/build-flow-editor.mjs'); process.exit(2); }

const candidates = [process.env.PLAYWRIGHT_DIR, `${root}/node_modules`, '/opt/npm-tools/node_modules', '/opt/node-tools/node_modules'].filter(Boolean);
const dir = candidates.find((d) => existsSync(`${d}/playwright`));
if (!dir) { console.error('No encuentro Playwright (define PLAYWRIGHT_DIR).'); process.exit(2); }
const { chromium } = createRequire(`${dir}/`)('playwright');
const executablePath = process.env.CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'OK   ' : 'FALLA'} ${name}${ok || !detail ? '' : ` — ${detail}`}`); };
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });

async function open(name, viewport, touch) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, acceptDownloads: true });
  const page = await ctx.newPage();
  const problems = [];
  const requests = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  await page.goto(html);
  await page.waitForSelector('.nd');
  await page.waitForTimeout(300);
  return { ctx, page, problems, requests, name };
}
const draft = (page) => page.evaluate(() => window.__flowEditor.getDraft());
const node = (page, label) => page.locator(`.nd:has(.t span:text-is("${label}"))`);
const tap = async (page, locator, touch) => { await locator.scrollIntoViewIfNeeded(); if (touch) { const box = await locator.boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); } else await locator.click(); };

for (const [name, viewport, touch] of [['tablet', { width: 1194, height: 834 }, false], ['phone', { width: 430, height: 932 }, true]]) {
  const t = await open(name, viewport, touch);
  const { page } = t;
  const P = (s) => `${name}: ${s}`;

  // Arranque
  let d = await draft(page);
  check(P('arranca con la plantilla real (5 nodos, 5 conexiones)'), d.workflow.nodes.length === 5 && d.workflow.connections.length === 5);
  check(P('rotula el borrador como ejemplo'), await page.locator('.chip.demo').count() === 1);
  check(P('rotula el entorno como simulado'), (await page.locator('#fe-hd').innerText()).includes('Entorno simulado'));
  if (touch) check(P('sin desplazamiento horizontal de la página'), await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  else check(P('sin desplazamiento vertical de la página (tablet)'), await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
  await page.screenshot({ path: `${shots}/${name}-01-inicio.png` });

  // Seleccionar y editar
  await tap(page, node(page, 'Agenda de hoy'), touch);
  check(P('al tocar un nodo se abre su detalle'), await page.locator('[data-node-form]').count() === 1);
  await page.fill('[data-f=label]', 'Agenda de mañana');
  await page.locator('[data-f=label]').blur();
  d = await draft(page);
  check(P('renombrar un nodo se guarda y se ve en el lienzo'), d.workflow.nodes.some((n) => n.label === 'Agenda de mañana') && await node(page, 'Agenda de mañana').count() === 1);
  await page.screenshot({ path: `${shots}/${name}-02-detalle.png` });

  // Riesgo alto ⇒ aprobación obligatoria (el editor aplica el invariante del motor)
  await page.selectOption('[data-f=risk]', 'high');
  check(P('riesgo alto fuerza la aprobación y bloquea la casilla'), await page.locator('[data-f=approval]').isChecked() && await page.locator('[data-f=approval]').isDisabled());
  await page.selectOption('[data-f=risk]', 'none');

  // Arrastrar
  const before = (await draft(page)).layout;
  const target = node(page, 'Entregar briefing');
  const box = await target.boundingBox();
  const id = await target.getAttribute('data-node');
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    const sx = box.x + box.width / 2, sy = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (let i = 1; i <= 6; i += 1) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 12, y: sy + i * 4 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(box.x + 60, box.y + 30); await page.mouse.down(); await page.mouse.move(box.x + 160, box.y + 60, { steps: 6 }); await page.mouse.up();
  }
  const after = (await draft(page)).layout;
  check(P('arrastrar mueve el nodo y lo deja en el borrador'), after[id].x !== before[id].x || after[id].y !== before[id].y, JSON.stringify({ a: before[id], b: after[id] }));

  // Añadir desde la paleta, conectado al seleccionado
  if (touch) await page.locator('[data-act=goto-palette]').click();
  await tap(page, node(page, 'Entregar briefing'), touch);
  const nBefore = (await draft(page)).workflow.nodes.length;
  await page.locator('.it', { hasText: 'Condición (si / si no)' }).click();
  d = await draft(page);
  check(P('añadir desde la paleta crea el nodo'), d.workflow.nodes.length === nBefore + 1);
  check(P('el nodo añadido queda conectado al seleccionado'), d.workflow.connections.some((c) => c.from === id && c.to === d.workflow.nodes.at(-1).id));
  await page.screenshot({ path: `${shots}/${name}-03-nodo-anadido.png` });

  // Conectar en dos toques con rama
  const cond = d.workflow.nodes.at(-1).id;
  await page.locator('.it', { hasText: 'Plantilla de texto' }).click();
  d = await draft(page);
  const tpl = d.workflow.nodes.at(-1).id;
  check(P('un nodo añadido junto a uno con ramas no se conecta solo'), !d.workflow.connections.some((c) => c.to === tpl));
  await page.locator(`.nd[data-node="${cond}"] .pt.out`).click();
  check(P('un nodo con ramas pide elegir la rama'), await page.locator('.banner button[data-act=branch]').count() === 2);
  await page.locator('.banner button[data-v=true]').click();
  check(P('tras elegir la rama pide el destino'), (await page.locator('.banner').innerText()).includes('Toca el nodo de destino'));
  await page.screenshot({ path: `${shots}/${name}-04-conectando.png` });
  // Un destino que cerraría un ciclo se rechaza con un mensaje claro y no crea nada.
  const connsBefore = (await draft(page)).workflow.connections.length;
  await tap(page, node(page, 'Resumir el día'), touch);
  check(P('una conexión que cerraría un ciclo se rechaza con mensaje'), (await page.locator('#fe-toast').innerText()).includes('ciclo') && (await draft(page)).workflow.connections.length === connsBefore);
  // Un destino válido sí conecta, con la rama elegida.
  await tap(page, node(page, 'Plantilla de texto'), touch);
  d = await draft(page);
  check(P('la conexión con rama se crea'), d.workflow.connections.some((c) => c.from === cond && c.to === tpl && c.branch === 'true'));
  check(P('al conectar sale del modo conexión'), await page.locator('.banner').count() === 0);

  // Quitar conexión
  await page.locator('path.hit').last().click({ force: true });
  check(P('tocar una línea abre la conexión'), (await page.locator('#fe-right').innerText()).includes('Quitar conexión'));
  const nConn = (await draft(page)).workflow.connections.length;
  await page.locator('#fe-right [data-act=unlink]').click();
  check(P('quitar la conexión la elimina'), (await draft(page)).workflow.connections.length === nConn - 1);

  // Deshacer y rehacer
  await page.locator('[data-act=undo]').click();
  check(P('deshacer restaura la conexión'), (await draft(page)).workflow.connections.length === nConn);
  await page.locator('[data-act=redo]').click();
  check(P('rehacer vuelve a quitarla'), (await draft(page)).workflow.connections.length === nConn - 1);

  // Entorno simulado
  await page.locator('[data-act=lt][data-v=entorno]').click();
  await page.locator('[data-act=env][data-v=todo]').click();
  await page.locator('[data-act=rt][data-v=problemas]').click();
  await page.screenshot({ path: `${shots}/${name}-05-problemas.png` });
  const errorsTodo = await page.locator('#fe-hd .chip.bad').count();
  await page.locator('[data-act=lt][data-v=entorno]').click();
  await page.locator('[data-act=env][data-v=hoy]').click();
  check(P('el entorno simulado cambia los avisos (todo disponible vs. hoy)'), errorsTodo <= await page.locator('#fe-hd .chip.bad').count());

  // Plantillas
  await page.locator('[data-act=lt][data-v=plantillas]').click();
  await page.screenshot({ path: `${shots}/${name}-06-plantillas.png` });
  await page.locator('[data-act=tpl][data-id=alerta-dron]').click();
  d = await draft(page);
  check(P('cargar una plantilla sustituye el borrador'), d.workflow.id.includes('alerta-dron'), d.workflow.id);
  await page.locator('[data-act=undo]').click();
  check(P('y se puede deshacer'), (await draft(page)).workflow.id.includes('briefing'));

  // Orden previsto
  await page.locator('[data-act=rt][data-v=orden]').click();
  check(P('el orden previsto lista los pasos'), await page.locator('.wv').count() >= 3);
  await page.screenshot({ path: `${shots}/${name}-07-orden.png` });

  // Exportar / importar
  await page.locator('[data-act=rt][data-v=archivo]').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-act=download]').click();
  const download = await downloadPromise;
  const text = readFileSync(await download.path(), 'utf8');
  const parsed = JSON.parse(text);
  check(P('la descarga es un borrador JSON del editor'), parsed.format === 'janus-flow-draft' && parsed.workflow.nodes.length > 0 && !/sk-|Bearer|password/i.test(text));
  await page.screenshot({ path: `${shots}/${name}-08-archivo.png` });

  // Un borrador hostil se importa sin ejecutar nada ni romper la página
  const hostile = JSON.parse(text);
  hostile.workflow.nodes[0].label = '<img src=x onerror="window.__xss=1">';
  hostile.workflow.status = 'published';
  await page.fill('[data-f=importtext]', JSON.stringify(hostile));
  await page.locator('[data-act=import]').click();
  await page.waitForTimeout(150);
  check(P('importar un borrador con HTML en un nombre no ejecuta código'), await page.evaluate(() => window.__xss === undefined));
  check(P('un borrador importado entra siempre como borrador'), (await draft(page)).workflow.status === 'draft');
  await page.fill('[data-f=importtext]', '{"x":1}').catch(() => {});
  await page.locator('[data-act=rt][data-v=archivo]').click();
  await page.fill('[data-f=importtext]', '{"__proto__":{"a":1}}');
  await page.locator('[data-act=import]').click();
  check(P('un JSON con claves peligrosas se rechaza con mensaje'), (await page.locator('#fe-right .err').innerText()).includes('no permitidas'));

  // Un secreto pegado a mano bloquea la exportación y no se guarda en el dispositivo
  await page.locator('[data-act=undo]').click().catch(() => {});
  await tap(page, node(page, 'Entregar briefing'), touch).catch(() => {});
  d = await draft(page);
  const holder = d.workflow.nodes.find((n) => n.type === 'transform.pick' || n.type === 'transform.set') ?? d.workflow.nodes[1];
  await page.evaluate((nodeId) => { document.querySelector(`.nd[data-node="${nodeId}"]`)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }, holder.id);
  await page.locator(`.nd[data-node="${holder.id}"]`).click({ force: true });
  await page.fill('[data-f=newparam]', 'api_key');
  await page.locator('[data-act=prm-new]').click();
  await page.fill('[data-p=api_key]', 'sk-live-0123456789abcdefghijklmnop');
  await page.locator('[data-p=api_key]').blur();
  await page.locator('[data-act=rt][data-v=archivo]').click();
  check(P('un valor con forma de clave bloquea la exportación'), await page.locator('[data-act=download]').isDisabled());
  const stored = await page.evaluate(() => localStorage.getItem('janus.flow-editor.draft.v1'));
  check(P('y no se guarda ni en el dispositivo'), !stored || !stored.includes('sk-live'));
  await page.screenshot({ path: `${shots}/${name}-09-secreto.png` });

  check(P('sin peticiones de red'), t.requests.length === 0, t.requests.join(', '));
  check(P('sin errores ni avisos de consola'), t.problems.length === 0, t.problems.join(' | '));
  await t.ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas`);
process.exit(failed.length ? 1 : 0);
