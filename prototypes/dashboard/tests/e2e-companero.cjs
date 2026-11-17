'use strict';
// e2e del Compañero 3D (la criatura vive dentro de la escena): lección, manipulación, canje 10↔1, vestidor, tienda, mundo, nombre y persistencia.
// Uso: PLAYWRIGHT_MODULE=… [CHROME_PATH=…] [DASH_FILE=ruta.html] node tests/e2e-companero.cjs
// WebGL sin GPU: SwiftShader (--use-angle=swiftshader). Corre en tablet (1194×834) y teléfono (430×932).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
const F = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const launch = () => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const solve = (q) => { const m = q.match(/(\d+)\s*([+−×÷])\s*(\d+)/); if (!m) return null; const a = +m[1], x = +m[3]; return { '+': a + x, '−': a - x, '×': a * x, '÷': a / x }[m[2]]; };
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

async function nueva(br, w, h) {
  const phone = w < 700, ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone }); await ctx.route('**/api.open-meteo.com/**', (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push('CON ' + m.text()); });
  await p.goto(F + '#companero'); await p.waitForTimeout(2500);
  return { ctx, p, errs, S: (js) => p.evaluate('(()=>{const s=JanusStage3D.get("kendra");' + js + '})()') };
}

async function leccion(br, nom, w, h) {
  console.log('\n[' + nom + '] lección y manipulación de la escena');
  const { ctx, p, errs, S } = await nueva(br, w, h);
  ok(await p.evaluate(() => !!window.JanusStage3D && JanusStage3D.supported() && !!document.querySelector('.cpgl canvas')), 'la criatura vive en un escenario 3D (hay lienzo WebGL, no una imagen)');
  await p.click('.cpb.go'); await p.waitForTimeout(1800);
  ok((await S('return s.stats().props')) > 0, 'Muéstramelo crea objetos en la escena');
  await p.click('.cptp .pill2:nth-child(1)'); await p.waitForTimeout(500); await p.click('.cpbtns .btn2:nth-child(2)'); await p.waitForTimeout(1200);
  for (let i = 0; i < 14; i++) { if (await p.$('.cpgoal')) break; const nx = await p.$('.cplb .cpb.go'); if (!nx) break; await nx.click(); await p.waitForTimeout(1100); }
  ok(!!(await p.$('.cpgoal')), 'llega al paso «Tu turno» con una meta');
  const tap = async (id) => { const q = await S('return s.screenOf(' + JSON.stringify(id) + ')'); await p.mouse.click(q.x, q.y); await p.waitForTimeout(500); };
  const cnt = async () => (await p.textContent('.cptool .cpn')).trim();
  await tap('c0'); ok(/unidades/.test(await cnt()), 'tocar una columna la selecciona');
  const q0 = await S('return s.screenOf("c0")'); await p.mouse.move(q0.x, q0.y); await p.mouse.down(); await p.mouse.move(q0.x + 60, q0.y + 20, { steps: 5 }); await p.mouse.move(q0.x + 120, q0.y + 40, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(1000);
  const q1 = await S('return s.screenOf("c0")'); ok(Math.hypot(q1.x - q0.x, q1.y - q0.y) > 30, 'arrastrar mueve el objeto');
  await tap('c0');
  for (let i = 0; i < 10; i++) { await p.click('.cptool .cpb[data-arg="1"]:not(.wd)'); await p.waitForTimeout(220); }
  ok(/^10 /.test(await cnt()) && /llevas 10 de/.test(await p.textContent('.cpgoal')), 'diez fichas de unidad: la meta cuenta 10');
  await p.click('.cpb.wd:has-text("10 → 1")'); await p.waitForTimeout(2600);
  ok(/^0 /.test(await cnt()) && /llevas 10 de/.test(await p.textContent('.cpgoal')), 'el canje 10→1 vacía las unidades y el valor total no cambia');
  await tap('c1'); ok(/^1 decena/.test(await cnt()), 'la decena vale 1');
  const y0 = await S('return s.stats().camera.yaw'), r = await p.evaluate(() => { const b = document.querySelector('.cpgl').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  await p.mouse.move(r[0] + 30, r[1] + r[3] * 0.6); await p.mouse.down(); await p.mouse.move(r[0] + 150, r[1] + r[3] * 0.6, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(700);
  ok(Math.abs((await S('return s.stats().camera.yaw')) - y0) > 0.05, 'arrastrar el fondo gira la cámara');
  const hint = await p.evaluate(() => { try { const rg = JanusCreatures3D.build('lumi', '#fff'); rg.setLook({ fur: '#fff', accent: '#fff', eyes: '#fff', outfit: 'inventada', outfitColor: '#fff', accessoryColor: '#fff', accessories: { cabeza: 'inventado' } }); rg.update(0, 0.016, { pose: 'idle' }); return 'ok'; } catch (e) { return String(e); } });
  ok(hint === 'ok', 'prendas y accesorios desconocidos se ignoran sin romper (' + hint + ')');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : '')); await ctx.close();
}

async function tienda(br, nom, w, h) {
  console.log('\n[' + nom + '] estrellas, vestidor, tienda, mundo, nombre y persistencia');
  const { ctx, p, errs, S } = await nueva(br, w, h); const stars = async () => +(await p.textContent('.cpstars b'));
  for (let i = 0; i < 3; i++) {
    const ans = solve(await p.textContent('.cpq'));
    await p.fill('[data-f="cpAns"]', '9999'); await p.click('.addf .btn:nth-of-type(1)'); await p.waitForTimeout(500);
    await p.fill('[data-f="cpAns"]', String(ans)); await p.press('[data-f="cpAns"]', 'Enter'); await p.waitForTimeout(900);
  }
  ok((await stars()) === 9, 'estrellas por esfuerzo, acierto y racha (9)');
  await p.click('.cptab:nth-child(2)'); await p.waitForTimeout(700);
  await p.click('.cpc.lock'); await p.waitForTimeout(500);
  ok(/todav[ií]a no es m[ií]o/i.test(await p.textContent('.cpsay span:nth-child(2)')), 'una prenda sin comprar no se pone y explica por qué');
  await p.click('.cptab:nth-child(3)'); await p.waitForTimeout(700);
  await p.click('.cpc[data-arg="dec:planta"]'); await p.waitForTimeout(800); ok((await stars()) === 4, 'comprar la planta cuesta 5 estrellas');
  await p.click('.cpc[data-arg="veh:moto"]'); await p.waitForTimeout(500); ok((await stars()) === 4, 'sin estrellas suficientes no se cobra');
  await p.click('.cptab:nth-child(4)'); await p.waitForTimeout(1600);
  ok((await S('return s.stats().mode')) === 'mundo' && (await S('return s.worldInfo().decor.length')) >= 1, '«Mi mundo» muestra la aldea con lo comprado');
  await p.click('.cptab:nth-child(5)'); await p.waitForTimeout(1200); ok((await S('return s.stats().mode')) === 'escena', 'al salir de «Mi mundo» vuelve la escena');
  await p.click('.cpo:nth-child(2)'); await p.waitForTimeout(1200); ok((await S('return s.stats().creature')) === 'bombo', 'elegir otra criatura la cambia dentro de la escena');
  await p.click('.cpname .mini'); await p.fill('[data-f="cpName"]', 'Gordi'); await p.click('.cpname .mini'); await p.waitForTimeout(600);
  ok(!!(await p.$('[data-f="cpName"]')) && /mejor no/.test(await p.textContent('.cpsay span:nth-child(2)')), 'un nombre de cuerpo/peso se rechaza con cariño');
  await p.fill('[data-f="cpName"]', 'Coco'); await p.click('.cpname .mini'); await p.waitForTimeout(600);
  ok((await p.textContent('.cpname b')).trim() === 'Coco', 'Kendra le pone nombre a la criatura');
  await p.reload(); await p.waitForTimeout(2500);
  ok((await p.textContent('.cpname b')).trim() === 'Coco' && (await stars()) === 4, 'nombre y estrellas sobreviven a recargar');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : '')); await ctx.close();
}

(async () => {
  const br = await launch();
  await leccion(br, 'tablet 1194×834', 1194, 834); await tienda(br, 'tablet 1194×834', 1194, 834);
  await leccion(br, 'teléfono 430×932', 430, 932);
  await br.close(); console.log('\n' + (bad ? bad + ' comprobaciones fallidas' : 'TODO OK')); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
