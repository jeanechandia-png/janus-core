'use strict';
// e2e del chat de Janus con Claude detrás (Artifact `sample`) usando un `window.claude` SIMULADO: no gasta nada ni toca la red.
// Comprueba: el adaptador se activa, la instrucción de Janus y el mensaje llegan al modelo, la respuesta aparece,
// un permiso denegado degrada con honestidad, y lo que actúa fuera (publicar/enviar/pagar…) pide aprobación SIN consultar al modelo.
// Uso: PLAYWRIGHT_MODULE=… DASH_FILE=ruta.html [SHOTS=carpeta] node tests/e2e-chat.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs');
const F = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html')), SHOTS = process.env.SHOTS || '';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const STUB = () => {
  window.__samples = []; window.__mode = 'ok';
  const sample = async (input, opts) => {
    window.__samples.push({ input, opts: { cache: opts && opts.cache, modelTier: opts && opts.modelTier } });
    if (window.__mode === 'deny') { const e = new Error('denegado por el usuario'); e.code = 'not_granted'; throw e; }
    if (opts && opts.onText) { opts.onText({ text: 'Hola Jean, ', delta: 'Hola Jean, ' }); await new Promise((r) => setTimeout(r, 250)); }
    const full = 'Hola Jean, soy Claude detrás de Janus. HECHO VERIFICADO: recibí tu mensaje.';
    if (opts && opts.onText) opts.onText({ text: full, delta: 'soy Claude…' });
    return { text: full, truncated: false };
  };
  sample.limits = async () => ({ images: false });
  window.claude = { use: async (n) => (n === 'sample' ? sample : null) };
};
const send = async (p, t) => { await p.fill('textarea[data-f="msg"]', t); await p.click('.gsend'); };
(async () => {
  const br = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  const ctx = await br.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true }); await ctx.route('**/api.open-meteo.com/**', (r) => r.abort());
  await ctx.addInitScript(STUB);
  const p = await ctx.newPage(); p.setDefaultTimeout(60000); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|GPU stall|swiftshader|WebGL: INVALID|Automatic fallback|deprecated/i.test(m.text())) errs.push('CON ' + m.text().slice(0, 200)); });
  await p.goto(F + '#'); await p.waitForTimeout(3000);

  console.log('\n[chat] Claude detrás de Janus (simulado)');
  ok(await p.evaluate(() => JanusGateway.live()), 'el gateway detecta un adaptador real (claude)');
  ok(await p.evaluate(() => JanusGateway.status().some((s) => s.id === 'claude' && s.available) && JanusGateway.status().some((s) => s.id === 'core' && !s.available)), 'claude disponible; el núcleo Janus sigue marcado como no disponible (pendiente)');
  await send(p, 'Resume el estado del proyecto'); await p.waitForFunction(() => /soy Claude detrás de Janus/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  ok(/soy Claude detrás de Janus/.test(await p.evaluate(() => document.body.innerText)), 'la respuesta del modelo aparece en el chat del teléfono');
  const s1 = await p.evaluate(() => window.__samples[0]);
  ok(!!s1 && s1.input[0].role === 'user' && s1.input[s1.input.length - 1].role === 'user', 'la conversación enviada empieza y termina en «user»');
  ok(!!s1 && /Eres Janus/.test(s1.input[0].content) && /Protocolo de la Verdad/.test(s1.input[0].content), 'la identidad y las reglas de Janus viajan en la instrucción');
  ok(!!s1 && /Resume el estado del proyecto/.test(s1.input[s1.input.length - 1].content), 'el mensaje de Jean llega al modelo');
  ok(!!s1 && s1.opts.cache === false, 'sin caché: cada pregunta es nueva');
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'chat-ok.png') }); }

  console.log('\n[chat] permiso denegado: degrada con honestidad');
  await p.evaluate(() => { window.__mode = 'deny'; });
  await send(p, '¿Qué hay pendiente hoy?'); await p.waitForFunction(() => /No pude consultar al modelo/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  ok(/No pude consultar al modelo/.test(await p.evaluate(() => document.body.innerText)), 'avisa «No pude consultar al modelo» en vez de inventar');

  console.log('\n[chat] acciones sensibles: aprobación antes, sin consultar al modelo');
  const n0 = await p.evaluate(() => window.__samples.length); await p.evaluate(() => { window.__mode = 'ok'; });
  await send(p, 'Publica el post en LinkedIn'); await p.waitForTimeout(3500);
  ok((await p.evaluate(() => window.__samples.length)) === n0, 'no se llamó al modelo para una acción que actúa fuera');
  ok(await p.evaluate(() => /visto bueno/i.test(document.body.innerText) || !!document.querySelector('.apb, [data-js="aprobacion"]')), 'Janus pide visto bueno antes de actuar');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await ctx.close(); await br.close(); console.log(bad ? '\nFALLAN ' + bad : '\nE2E CHAT: TODO OK'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
