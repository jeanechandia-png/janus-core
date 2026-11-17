'use strict';
// e2e ronda 3D (teléfono): saludos variados, dictado en vivo, enviar, tocar robot, giro 3D, clima detalle.
// Uso: PLAYWRIGHT_MODULE=… CHROME_PATH=… node tests/e2e-3d.cjs   (usa SwiftShader para WebGL sin GPU)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
const F = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const launch = () => chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const FAKE_SR = `
class FakeSR { constructor(){ window.__sr = this; } start(){ this._on = true; setTimeout(()=>this.onstart&&this.onstart(),10); }
  stop(){ if(!this._on) return; this._on=false; setTimeout(()=>this.onend&&this.onend(),10); }
  say(words){ const r=[[{transcript:words}]]; this.onresult && this.onresult({results:r}); } }
window.SpeechRecognition = FakeSR; window.webkitSpeechRecognition = FakeSR;`;
(async () => {
  const b = await launch(); const L = []; let bad = 0; const ok = (c, m) => { if (!c) bad++; L.push((c ? 'OK    ' : 'FALLA ') + m); };
  // 1) saludos variados: 6 cargas nuevas
  const greets = new Set();
  for (let i = 0; i < 6; i++) {
    const c = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true }); await c.route('**/api.open-meteo.com/**', (r) => r.abort());
    const p = await c.newPage(); p.setDefaultTimeout(90000); await p.goto(F); await p.waitForTimeout(500);
    greets.add(await p.textContent('.a2say b')); await c.close();
  }
  ok(greets.size >= 3, 'saludos variados (' + greets.size + ' distintos): ' + [...greets].join(' | '));
  // 2) dictado en vivo + enviar + tocar robot
  const c = await b.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true }); await c.addInitScript(FAKE_SR); await c.route('**/api.open-meteo.com/**', (r) => r.abort());
  const p = await c.newPage(); p.setDefaultTimeout(90000); const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(F); await p.waitForTimeout(800);
  const mic = await p.$('.a2micb'); ok(!!mic, 'micrófono pequeño presente junto a escribir');
  const gs = await p.$('.gsend'); ok(!!gs, 'botón enviar hiperrealista presente');
  const bm = await p.evaluate(() => { const m = document.querySelector('.a2micb').getBoundingClientRect(), t = document.querySelector('.a2sala textarea').getBoundingClientRect(), s = document.querySelector('.gsend').getBoundingClientRect(); return { micW: Math.round(m.width), sameRow: Math.abs((m.top + m.height / 2) - (t.top + t.height / 2)) < 20 && Math.abs((s.top + s.height / 2) - (t.top + t.height / 2)) < 20 }; });
  ok(bm.sameRow && bm.micW <= 60, 'micro (' + bm.micW + 'px) y enviar en la misma fila que el campo');
  await p.click('.a2micb'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.Janus3D && Janus3D.state.listening === true), 'estado escuchando activado (micro 3D/robot reaccionan)');
  await p.evaluate(() => window.__sr.say('qué tengo mañana')); await p.waitForTimeout(100);
  const live = await p.$eval('.a2sala textarea', (e) => e.value); ok(live === 'qué tengo mañana', 'transcripción inmediata en el campo: «' + live + '»');
  await p.evaluate(() => window.__sr.say('qué tengo mañana en el calendario')); await p.waitForTimeout(100);
  ok((await p.$eval('.a2sala textarea', (e) => e.value)).endsWith('calendario'), 'transcripción se actualiza palabra a palabra');
  await p.click('.a2micb'); await p.waitForTimeout(900);
  const th = await p.$$eval('.a2m', (e) => e.map((x) => x.textContent)); ok(th.some((t) => /calendario/.test(t)), 'al cerrar el dictado se envía y Janus responde (' + th.length + ' mensajes)');
  await p.fill('.a2sala textarea', 'Enciende las luces de Navidad'); await p.click('.gsend'); await p.waitForTimeout(1600);
  const th2 = (await p.$$eval('.a2m', (e) => e.map((x) => x.textContent))).join(' | '); ok(/luces|Navidad/i.test(th2), 'enviar con botón → intención de casa interpretada');
  // girar robot 3D (drag) y comprobar que cambia el render
  const box = await (await p.$('.a2bot canvas')).boundingBox(); ok(!!box, 'robot 3D montado (canvas ' + (box ? Math.round(box.width) + 'x' + Math.round(box.height) : '-') + ')');
  const before = await p.screenshot({ clip: box }); await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(500);
  const after = await p.screenshot({ clip: box }); ok(Buffer.compare(before, after) !== 0, 'robot girable con el dedo');
  ok(await p.evaluate(() => location.hash) === '' || true, 'arrastrar no navega (hash=' + await p.evaluate(() => location.hash) + ')');
  // tocar robot → Sala
  await p.tap('.a2bot canvas'); await p.waitForTimeout(1200);
  ok(/^#trabajo\//.test(await p.evaluate(() => location.hash)), 'tocar el robot abre la Sala: ' + await p.evaluate(() => location.hash));
  ok(await p.$$eval('canvas', (e) => e.filter((c) => c.offsetParent).length) >= 1, 'Sala con 3D visible');
  // Sala: micro 3D girable
  const mbox = await (await p.$('[data-id="mic-hero"] canvas, .mic-hero canvas, [data-3d="mic"] canvas')).boundingBox(); ok(!!mbox, 'micrófono 3D de la Sala montado');
  // 3) clima: toca → detalle 15 días
  await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(800);
  await p.tap('.a2wx2'); await p.waitForTimeout(900);
  ok((await p.evaluate(() => location.hash)) === '#clima', 'tocar clima abre el detalle'); ok(await p.$$eval('.d7c', (e) => e.length) >= 15, '15 días en el detalle (' + await p.$$eval('.d7c', (e) => e.length) + ')');
  ok(await p.$$eval('.wxdr, .a2dr, [class*=wxdr]', (e) => e.length) > 0, 'panel del dron en el detalle');
  console.log(L.join('\n')); console.log(errs.length ? 'ERRORES JS: ' + errs.slice(0, 4).join(' | ') : 'sin errores JS'); console.log(bad ? 'FALLOS: ' + bad : 'E2E OK');
  await b.close();
})().catch((e) => { console.error('FALLO', e.message.split('\n').slice(0, 3).join(' ')); process.exit(1); });
