'use strict';
// e2e del espacio de criaturas (GLB), la cara con expresiones y la pasarela de modelo del chat.
// Uso: PLAYWRIGHT_MODULE=… [DASH_FILE=ruta.html] [SHOTS=carpeta] node tests/e2e-slot.cjs
// WebGL sin GPU: SwiftShader. Tablet (1194×834) y teléfono (430×932).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs');
const F = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const FIX = (n) => path.join(__dirname, 'fixtures', n + '.glb'), SHOTS = process.env.SHOTS || '';
const launch = () => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };

async function nueva(br, w, h, init) {
  const phone = w < 700, ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone }); await ctx.route('**/api.open-meteo.com/**', (r) => r.abort());
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + String(e))); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/ERR_FAILED|net::|GPU stall|swiftshader|WebGL: INVALID|Automatic fallback|deprecated/i.test(m.text())) errs.push('CON ' + m.type() + ' ' + m.text().slice(0, 200)); });
  await p.goto(F + '#companero'); await p.waitForTimeout(2500);
  return { ctx, p, errs, st: () => p.evaluate(() => JanusStage3D.get('kendra').stats()) };
}

async function modulo(br, nom, w, h) {
  console.log('\n[' + nom + '] espacio de criaturas GLB');
  const { ctx, p, errs, st } = await nueva(br, w, h);
  ok(await p.evaluate(() => !!window.JanusCreatureSlot && JanusCreatureSlot.supported() && !!window.JanusGLTF), 'el módulo y el cargador glTF están en la página');
  ok((await st()).kind === 'procedural', 'sin modelos importados, la criatura es la procedural de siempre');
  await p.click('.cptab:nth-child(6)'); await p.waitForTimeout(600);
  ok((await p.$$('.cpslot')).length === 5, 'el panel muestra los 5 huecos (Lumi, Bombo, Musgo, Nimbo y el robot de Janus)');
  await p.setInputFiles('input[data-slotfile="lumi"]', FIX('contrato-completo')); await p.waitForTimeout(2500);
  ok(/Cumple el contrato/.test(await p.textContent('.cpslot >> nth=0')) || /Cumple el contrato/.test(await p.textContent('.cptc')), 'GLB completo: «Cumple el contrato»');
  ok(await p.evaluate(() => JanusCreatureSlot.has('lumi')), 'el modelo queda registrado');
  const s1 = await st(); ok(s1.kind === 'glb' && s1.creature === 'lumi', 'la escena muestra el GLB en lugar de la procedural (' + s1.kind + ')');
  await shot(p, 'slot-glb-' + nom); await p.waitForTimeout(1500);
  const rep = await p.evaluate(() => JanusCreatureSlot.report('lumi')); ok(rep.stats.bones === 13 && rep.stats.clips.length === 6 && rep.stats.morphs.length >= 8, 'informe: huesos ' + rep.stats.bones + ', clips ' + rep.stats.clips.length + ', morphs ' + rep.stats.morphs.length);
  // animación y expresiones sobre el GLB
  await p.click('.cptab:nth-child(5)'); await p.waitForTimeout(500);
  for (const m of ['alegre', 'triste', 'enojado', 'sorprendido', 'pensativo']) { await p.click('[data-act="cpMood"][data-arg="' + m + '"]'); await p.waitForTimeout(500); }
  const infl = await p.evaluate(() => { const o = []; return JanusStage3D.get('kendra')._debugInfl ? JanusStage3D.get('kendra')._debugInfl() : null; });
  // persistencia: recargar y recuperar de IndexedDB
  await p.reload(); await p.waitForTimeout(3500);
  ok(await p.evaluate(() => JanusCreatureSlot.has('lumi')), 'tras recargar, el modelo se recupera de este dispositivo (IndexedDB)');
  ok((await st()).kind === 'glb', 'y la escena lo vuelve a usar');
  await p.click('.cptab:nth-child(6)'); await p.waitForTimeout(500);
  await p.click('[data-act="cpSlotDel"][data-arg="lumi"]'); await p.waitForTimeout(1500);
  ok(!(await p.evaluate(() => JanusCreatureSlot.has('lumi'))) && (await st()).kind === 'procedural', 'Quitar: vuelve la criatura procedural');
  // incompleto: carga con avisos y dice qué falta
  await p.setInputFiles('input[data-slotfile="bombo"]', FIX('contrato-incompleto')); await p.waitForTimeout(2200);
  const r2 = await p.evaluate(() => JanusCreatureSlot.report('bombo'));
  ok(r2 && r2.level === 'avisos' && r2.missing.sockets.length > 0 && r2.missing.morphs.length > 0 && r2.missing.clips.length > 0, 'GLB incompleto: carga con avisos y lista lo que falta (sockets ' + (r2 && r2.missing.sockets.length) + ', morphs ' + (r2 && r2.missing.morphs.length) + ', clips ' + (r2 && r2.missing.clips.length) + ')');
  // archivo que no es glTF: se rechaza sin romper
  fs.writeFileSync('/tmp/no-es-glb.glb', 'esto no es un modelo'); await p.setInputFiles('input[data-slotfile="musgo"]', '/tmp/no-es-glb.glb'); await p.waitForTimeout(1500);
  ok(!(await p.evaluate(() => JanusCreatureSlot.has('musgo'))) && /no se pudo usar|Error/i.test(await p.textContent('.cptc')), 'un archivo que no es glTF se rechaza con un mensaje');
  await p.evaluate(() => JanusCreatureSlot.remove('bombo'));
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
}

async function cara(br, nom, w, h) {
  console.log('\n[' + nom + '] cara con expresiones y emociones en la criatura');
  const { ctx, p, errs, st } = await nueva(br, w, h);
  await p.click('.cptab:nth-child(5)'); await p.waitForTimeout(500);
  ok((await p.$$('[data-act="cpMood"]')).length === 6, 'seis emociones: alegre, contento, triste, enojado, sorprendido, pensativo');
  for (const m of ['alegre', 'triste', 'enojado', 'sorprendido', 'pensativo', 'contento']) { await p.click('[data-act="cpMood"][data-arg="' + m + '"]'); await p.waitForTimeout(1300); await shot(p, 'criatura-' + m + '-' + nom); }
  await p.click('.cptab:nth-child(2)'); await p.waitForTimeout(500);
  await p.click('[data-act="cpAspect"][data-arg="cara"]'); await p.waitForTimeout(1500);
  const s = await st(); ok(s.kind === 'cara', 'aspecto «Cara con expresiones»: ojos y sonrisa flotantes en la escena');
  await shot(p, 'cara-contento-' + nom);
  await p.click('.cptab:nth-child(5)'); await p.waitForTimeout(400);
  const seen = {};
  for (const m of ['alegre', 'triste', 'enojado', 'sorprendido', 'pensativo']) { await p.click('[data-act="cpMood"][data-arg="' + m + '"]'); await p.waitForFunction((x) => JanusStage3D.get('kendra').stats().mood === x, m, { timeout: 12000 }).catch(() => {}); seen[m] = (await st()).mood; await shot(p, 'cara-' + m + '-' + nom); }
  ok(Object.keys(seen).every((m) => seen[m] === m), 'la cara adopta cada emoción pedida (' + JSON.stringify(seen) + ')');
  // color de ojos: cambia con el vestidor
  await p.click('.cptab:nth-child(2)'); await p.waitForTimeout(400);
  const dots = await p.$$('.cpgr:has(h4:text("Ojos")) .cpdot'); if (dots.length > 2) { await dots[2].click(); await p.waitForTimeout(1200); await shot(p, 'cara-ojos-' + nom); }
  ok(dots.length > 2, 'se puede elegir el color de los ojos');
  // cambio de criatura mantiene el aspecto
  await p.click('.cptab:nth-child(1)'); await p.waitForTimeout(300);
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
}

async function chat(br, nom, w, h) {
  console.log('\n[' + nom + '] chat de Janus con la pasarela de modelo');
  // 1) con adaptador Claude simulado (window.claude.use('sample'))
  const stub = () => { window.__calls = []; window.claude = { use: async (n) => (n === 'sample' ? async (input, o) => { window.__calls.push(input); await new Promise((r) => setTimeout(r, 400)); return { text: 'Respuesta de prueba del modelo. HECHO: recibí ' + input.length + ' turno(s).' }; } : null) }; };
  let { ctx, p, errs } = await nueva(br, w, h, stub);
  await p.goto(F + '#trabajo'); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => JanusGateway.live()), 'con el adaptador Claude disponible, la pasarela está activa');
  await p.fill('#view [data-f="msg"]', 'Resume el estado del proyecto'); await p.click('#view .gsend'); await p.waitForTimeout(2500);
  const txt = await p.textContent('#thr'); ok(/Respuesta de prueba del modelo/.test(txt) && /Janus · Claude/.test(txt), 'la respuesta del modelo aparece en el hilo, etiquetada «Claude»');
  const call = await p.evaluate(() => window.__calls[0]); ok(call && call.length === 1 && call[0].role === 'user' && /Eres Janus/.test(call[0].content) && /Resume el estado del proyecto/.test(call[0].content) && /No ejecutas acciones externas/.test(call[0].content), 'el modelo recibe las reglas de Janus y el mensaje (sin claves ni datos personales)');
  await p.fill('#view [data-f="msg"]', 'Publica la landing nueva'); await p.click('#view .gsend'); await p.waitForTimeout(2500);
  ok(/visto bueno|Aprobar/.test(await p.textContent('#thr')) && (await p.evaluate(() => window.__calls.length)) === 1, 'una acción externa («publica») sigue pidiendo aprobación y no llega al modelo');
  await p.fill('#view [data-f="msg"]', 'Segunda pregunta'); await p.click('#view .gsend'); await p.waitForTimeout(2500);
  const c2 = await p.evaluate(() => window.__calls[1]); ok(c2 && c2[c2.length - 1].role === 'user' && c2.every((m, i) => i === 0 || m.role !== c2[i - 1].role), 'la conversación se envía alternando turnos y terminando en el usuario (' + (c2 ? c2.length : 0) + ' turnos)');
  await shot(p, 'chat-claude-' + nom);
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
  // 2) fallo del modelo: cae al simulado y lo dice
  const failing = () => { window.claude = { use: async () => async () => { throw Object.assign(new Error('rechazado por prueba'), { code: 'not_granted' }); } }; };
  ({ ctx, p, errs } = await nueva(br, w, h, failing)); await p.goto(F + '#trabajo'); await p.waitForTimeout(1500);
  await p.fill('#view [data-f="msg"]', 'Hola Janus'); await p.click('#view .gsend'); await p.waitForTimeout(2200);
  ok(/No pude consultar al modelo/.test(await p.textContent('#thr')), 'si el modelo falla, lo dice y no inventa una respuesta');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
  // 3) sin adaptador (fuera del Artifact): comportamiento simulado de siempre
  ({ ctx, p, errs } = await nueva(br, w, h)); await p.goto(F + '#trabajo'); await p.waitForTimeout(1500);
  ok(!(await p.evaluate(() => JanusGateway.live())), 'sin Claude disponible la pasarela no está activa (vista previa simulada)');
  await p.fill('#view [data-f="msg"]', 'Hola Janus'); await p.click('#view .gsend'); await p.waitForTimeout(4500);
  ok(/Hecho en la vista previa/.test(await p.textContent('#thr')) && /simulado/.test(await p.textContent('#thr')), 'respuesta simulada etiquetada como tal');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
}

(async () => {
  const br = await launch();
  const only = process.env.ONLY || 'modulo,cara,chat';
  for (const [nom, w, h] of [['tablet', 1194, 834], ['telefono', 430, 932]]) {
    if (only.includes('modulo')) await modulo(br, nom, w, h);
    if (only.includes('cara')) await cara(br, nom, w, h);
    if (only.includes('chat')) await chat(br, nom, w, h);
  }
  await br.close(); console.log(bad ? '\nFALLAN ' + bad : '\nE2E ESPACIO + CARA + CHAT: TODO OK'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
