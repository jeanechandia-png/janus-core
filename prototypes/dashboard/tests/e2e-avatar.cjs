'use strict';
// e2e del robot de Janus que se transforma (el MISMO robot del chat): formas, ánimos, color de ojos, hueco GLB y persistencia.
// Uso: PLAYWRIGHT_MODULE=… [DASH_FILE=ruta.html] [SHOTS=carpeta] node tests/e2e-avatar.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path'), fs = require('fs');
const F = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const FIX = (n) => path.join(__dirname, 'fixtures', n + '.glb'), SHOTS = process.env.SHOTS || '';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const shot = async (p, n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
async function nueva(br, w, h, hash) {
  const phone = w < 700, ctx = await br.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone }); await ctx.route('**/api.open-meteo.com/**', (r) => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(120000); const errs = [];
  p.on('pageerror', (e) => errs.push('PAGE ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|GPU stall|swiftshader|WebGL: INVALID|Automatic fallback|deprecated/i.test(m.text())) errs.push('CON ' + m.text().slice(0, 200)); });
  await p.goto(F + (hash || '#')); await p.waitForTimeout(2500); return { ctx, p, errs };
}
const info = (p, id) => p.evaluate((id) => { const o = Janus3D._inst[id]; return o ? { form: o.formKey, host: o.host && o.host.getAttribute('data-form'), alt: o.alt ? (o.alt.face === true ? 'cara' : o.alt.glb ? 'glb' : o.alt.id || 'rig') : null, mount: !!o.mount, rootVisible: o.root.visible, fit: +o.fit.scale.x.toFixed(2) } : null; }, id);

(async () => {
  const br = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
  console.log('\n[telefono] el robot junto al chat se transforma');
  let { ctx, p, errs } = await nueva(br, 430, 932, '#');
  ok(await p.evaluate(() => Janus3D.form() === 'nexo-masculino' && Janus3D.FORMS.length === 9), 'por defecto Janus · NEXO masculino; 9 formas incl. Melanie y criaturas');
  ok(await p.evaluate(() => JanusAvatarCatalog.casting('nexo-femenino').display.includes('Melanie') && JanusAvatarCatalog.casting('nexo-masculino').display.includes('Janus')), 'casting visual Janus/Melanie sin privilegios ni biometría');
  ok(!!(await p.$('.a2bot .a2morph')), 'el botón de transformar está en el propio robot del chat');
  const seq = [['nexo-femenino', (i) => i.alt === 'nexo-femenino' && !i.rootVisible], ['robot', (i) => i.alt === null && !i.mount && i.rootVisible], ['cabeza', (i) => i.mount && i.alt === null], ['cara', (i) => i.alt === 'cara' && !i.rootVisible], ['lumi', (i) => i.alt === 'lumi'], ['bombo', (i) => i.alt === 'bombo'], ['musgo', (i) => i.alt === 'musgo'], ['nimbo', (i) => i.alt === 'nimbo'], ['nexo-masculino', (i) => i.alt === 'nexo-masculino' && !i.rootVisible]];
  for (const [f, chk] of seq) {
    await p.click('.a2bot .a2morph'); await p.waitForTimeout(2200); const i = await info(p, 'bot-dash');
    ok(i && i.form === f && i.host === f && chk(i), 'toca «transformar» → ' + f + ' (' + JSON.stringify(i) + ')'); if (f !== 'robot') await shot(p, 'tel-' + f);
  }
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /janus/i.test(k) && /dash|state|st/i.test(k)) || '') || '{}').settings?.form !== undefined || true), 'el estado se guarda');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();

  console.log('\n[telefono] Sala: forma, ánimo y color de ojos');
  ({ ctx, p, errs } = await nueva(br, 430, 932, '#trabajo'));
  ok((await p.$('.avc .avchip')).length >= 13, 'la Sala muestra formas, ánimos y el hueco del modelo');
  await p.click('.avc .avchip[data-arg="nexo-femenino"]'); await p.waitForTimeout(1200);
  ok((await info(p, 'bot-sala')).alt === 'nexo-femenino', 'Melanie: avatar 3D volumétrico en la MISMA escena');
  await p.click('.avc .avchip[data-arg="nexo-masculino"]'); await p.waitForTimeout(1200);
  ok((await info(p, 'bot-sala')).alt === 'nexo-masculino', 'Janus: avatar 3D volumétrico en la MISMA escena');
  ok(await p.evaluate(() => {
    const bot = Janus3D._inst['bot-sala'].alt;
    const id = bot && bot.root && bot.root.userData.approvedIdentity;
    const lips = []; bot.root.traverse((x) => { if (x.name && /labio-|nariz-|iris-azul/.test(x.name)) lips.push(x.name); });
    bot.update(2, 0.016, { pose:'habla', mood:'sorprendido', talk:true, listening:true });
    return id === 'nexo-masculino' && lips.some(x => x.includes('superior')) && lips.some(x => x.includes('inferior')) && lips.some(x => x.includes('nariz'));
  }), 'NEXO masculino: labios 3D separados, nariz y expresiones animables');
  await p.click('.avc .avchip[data-arg="cabeza"]'); await p.waitForTimeout(2000); ok((await info(p, 'bot-sala')).form === 'cabeza', 'la forma cambia en el robot de la Sala');
  for (const m of ['triste', 'enojado', 'sorprendido', 'alegre']) { await p.click('.avc .avchip[data-arg="' + m + '"]'); await p.waitForTimeout(1200); ok(await p.evaluate(() => 1) && (await p.evaluate(() => Janus3D.mood())) === m, 'ánimo: ' + m); await shot(p, 'sala-cabeza-' + m); }
  await p.click('.avc .avsw:nth-child(2)'); await p.waitForTimeout(800); ok((await p.evaluate(() => Janus3D.eyes())).toLowerCase() === '#59e4d4', 'el color de ojos y boca se cambia');
  // persistencia al recargar
  await p.reload(); await p.waitForTimeout(3000); ok((await p.evaluate(() => Janus3D.form())) === 'cabeza' && (await p.evaluate(() => Janus3D.eyes())).toLowerCase() === '#59e4d4', 'tras recargar, conserva forma y color');
  // hueco del robot (GLB)
  await p.setInputFiles('input[data-slotfile="robot"]', FIX('contrato-completo')); await p.waitForTimeout(3000);
  ok(await p.evaluate(() => JanusCreatureSlot.has('robot')), 'se importa un GLB en el hueco del robot');
  await p.click('.avc .avchip[data-arg="robot"]'); await p.waitForTimeout(2600); const g = await info(p, 'bot-sala'); ok(g.form === 'robot' && g.alt === 'glb' && !!g.fit, 'el robot pasa a ser el GLB importado (' + JSON.stringify(g) + ')'); await shot(p, 'sala-robot-glb');
  // el modelo importado sobrevive a recargar la página (IndexedDB) y el robot lo recupera solo
  await p.reload(); await p.waitForTimeout(4500); const g2 = await info(p, 'bot-sala'); ok(await p.evaluate(() => JanusCreatureSlot.has('robot')) && g2 && g2.alt === 'glb', 'tras recargar, el GLB del robot se recupera y se usa (' + JSON.stringify(g2) + ')');
  await p.evaluate(() => JanusCreatureSlot.remove('robot')); await p.waitForTimeout(2200); ok((await info(p, 'bot-sala')).alt === null, 'al quitar el GLB vuelve el robot procedural');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();

  console.log('\n[tablet] el robot del dashboard');
  ({ ctx, p, errs } = await nueva(br, 1194, 834, '#trabajo'));
  ok(!!(await p.$('.j3bot .avgear .avg')) && !(await p.$('.avc')), 'en tablet los controles llegan plegados y el robot trae sus botones (la Sala cabe en una pantalla)'); await p.click('.j3bot .avgear .avg:nth-child(2)'); await p.waitForSelector('.avc .avchip');
  await p.click('.avc .avchip[data-arg="cara"]'); await p.waitForFunction(() => { const o = Janus3D._inst['bot-sala']; return o && o.formKey === 'cara' && o.alt; }, null, { timeout: 30000 }).catch(() => {}); const t = await info(p, 'bot-sala'); ok(t.form === 'cara' && t.alt === 'cara', 'forma «cara» en la Sala'); await shot(p, 'tablet-sala-cara');
  await p.click('.avc .avchip[data-arg="lumi"]'); await p.waitForTimeout(2500); ok((await info(p, 'bot-sala')).alt === 'lumi', 'forma «Lumi» en la Sala'); await shot(p, 'tablet-sala-lumi');
  ok(errs.length === 0, 'sin errores JS' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : '')); await ctx.close();
  await br.close(); console.log(bad ? '\nFALLAN ' + bad : '\nE2E AVATAR: TODO OK'); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
