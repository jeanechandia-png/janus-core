'use strict';
// Respuesta con fuentes citadas en la Sala (EJEMPLO): tablet y móvil.
// Uso: node tests/cited.cjs [WxH,...]   (SHOTS_DIR=… para guardar capturas)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
const fs = require('fs');
const FILE = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, '../dist/shots');
fs.mkdirSync(SHOTS, { recursive: true });
const sizes = (process.argv[2] || '1194x834,430x932').split(',').map((s) => s.split('x').map(Number));
const Q = 'Investiga con fuentes: ¿cómo verificas una respuesta?';

(async () => {
  const br = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
  let bad = 0, total = 0;
  const ok = (name, cond, extra) => { total++; if (!cond) bad++; console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '  → ' + (extra === undefined ? '' : extra))); };
  for (const [w, h] of sizes) {
    const phone = w < 600;
    console.log('\n== ' + w + 'x' + h + (phone ? ' (móvil)' : ' (tablet)'));
    const ctx = await br.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone, deviceScaleFactor: 2 });
    await ctx.route('**/api.open-meteo.com/**', (r) => r.abort());
    await ctx.route('**/fonts.g*/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = []; const reqs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    page.on('request', (r) => { if (/^https?:/.test(r.url()) && !/open-meteo|fonts\.g/.test(r.url())) reqs.push(r.url()); });
    await page.goto(FILE + '#trabajo'); await page.waitForTimeout(700);
    const chip = await page.$$eval('#view [data-act=suggest]', (els) => els.map((e) => e.textContent.trim()));
    ok('hay una sugerencia para investigar con fuentes', chip.some((t) => /Investiga con fuentes/.test(t)), JSON.stringify(chip).slice(0, 200));

    // 1) Una pregunta normal NO genera bloque de fuentes
    await page.fill('#view textarea[data-f=msg]', 'Resume el estado del proyecto');
    await page.click('#view .gsend'); await page.waitForTimeout(3900);
    ok('mensaje normal: sin bloque de fuentes', (await page.$$('.cit')).length === 0);

    // 2) Pregunta de investigación → bloque con fuentes
    await page.fill('#view textarea[data-f=msg]', Q);
    await page.click('#view .gsend');
    await page.waitForTimeout(500);
    ok('mientras piensa no hay bloque aún', (await page.$$('.cit')).length === 0);
    await page.waitForSelector('.cit', { timeout: 6000 });
    await page.waitForTimeout(300);
    const tag = await page.$eval('.cit-tag', (e) => e.textContent);
    ok('rótulo EJEMPLO / fuentes simuladas visible', /EJEMPLO/.test(tag) && /simuladas/.test(tag), tag);
    ok('2 marcas [n] clicables', (await page.$$('.cit .cm')).length === 2);
    ok('2 fuentes numeradas', (await page.$$('.cit .csr')).length === 2);
    const srcTxt = await page.$$eval('.cit .csr', (els) => els.map((e) => e.textContent));
    ok('las fuentes muestran dominio .invalid (no hay enlace real)', srcTxt.every((t) => /\.invalid/.test(t)), srcTxt.join(' | ').slice(0, 300));
    ok('ninguna fuente es un enlace navegable', (await page.$$('.cit a[href]')).length === 0);
    const verdict = await page.$eval('.cit .vchip', (e) => e.textContent.trim());
    ok('veredicto honesto: POR CONFIRMAR (fuentes sin catalogar)', verdict === 'POR CONFIRMAR', verdict);
    const vline = await page.$eval('.cit-v', (e) => e.textContent);
    ok('muestra cobertura 100 % y por qué no es VERIFICADO', /100 %/.test(vline) && /independientes|nivel A/.test(vline), vline);
    ok('rotula que la comprobación la hace código', /código/.test(await page.$eval('.cit-n', (e) => e.textContent)));

    // 3) Interacción: tocar [1] resalta la fuente 1; tocar de nuevo la suelta; tocar la fuente 2 la marca
    await page.click('.cit .cm >> nth=0'); await page.waitForTimeout(250);
    ok('tocar [1] resalta la fuente 1', await page.$$eval('.cit .csr', (els) => els.map((e) => e.classList.contains('on')).join()) === 'true,false');
    await page.click('.cit .cm >> nth=0'); await page.waitForTimeout(250);
    ok('tocar [1] otra vez la suelta', (await page.$$('.cit .csr.on')).length === 0);
    await page.click('.cit .csr >> nth=1'); await page.waitForTimeout(250);
    ok('tocar la fuente 2 la marca y marca [2]', await page.$$eval('.cit .cm', (els) => els.map((e) => e.classList.contains('on')).join()) === 'false,true');

    // 4) Maquetación: sin desbordes horizontales dentro de la burbuja ni de la página
    const ov = await page.evaluate(() => {
      const c = document.querySelector('.cit'), b = c.closest('.bub');
      const r = c.getBoundingClientRect(), br = b.getBoundingClientRect();
      return { citeInBubble: r.right <= br.right + 1 && r.left >= br.left - 1, pageX: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1, vis: r.width > 120 };
    });
    ok('el bloque cabe dentro de su burbuja', ov.citeInBubble && ov.vis, JSON.stringify(ov));
    ok('sin desplazamiento horizontal de página', ov.pageX, JSON.stringify(ov));
    await page.$eval('.cit', (e) => e.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'cited-' + (phone ? 'movil' : 'tablet') + '.png') });

    // 5) Persistencia: tras recargar sigue el bloque (solo texto; la selección se reinicia)
    await page.reload(); await page.waitForTimeout(700);
    if (!(await page.$('.cit'))) await page.goto(FILE + '#trabajo');
    await page.waitForTimeout(500);
    ok('tras recargar sigue el bloque con su veredicto', (await page.$eval('.cit .vchip', (e) => e.textContent.trim()).catch(() => '')) === 'POR CONFIRMAR');

    // 6) Seguridad: lo guardado en el navegador puede estar manipulado → texto escapado, marca [9] inválida y, si la forma es mala, texto plano
    await page.evaluate(() => {
      const KEY = 'janus.preview.A.v1', st = JSON.parse(localStorage.getItem(KEY));
      for (const k of Object.keys(st.chats)) {
        const l = st.chats[k], i = l.map((m) => !!m.cited).lastIndexOf(true);
        if (i < 0) continue;
        const bad = JSON.parse(JSON.stringify(l[i]));
        bad.cited.text = 'Dato inventado [9] y <img src=x onerror="window.__xss=1"> más [1].';
        bad.cited.invalidMarkers = [9]; bad.cited.coverage = 0.5;
        l[i] = bad;
        l.push({ who: 'ja', t: 'Texto plano <b id="zz">no negrita</b> de respaldo', at: '00:00', cited: { text: 'x' } });
      }
      localStorage.setItem(KEY, JSON.stringify(st));
    });
    await page.reload(); await page.waitForTimeout(800);
    const inj = await page.evaluate(() => {
      const c = document.querySelector('#view .cit');
      return c ? { bad: c.querySelectorAll('.cm.bad').length, img: document.querySelectorAll('#view .cit img').length, text: c.querySelector('.cit-v').textContent, xss: !!window.__xss } : null;
    });
    ok('cita a fuente inexistente se marca (.cm.bad) y se informa', !!inj && inj.bad === 1 && /inexistentes: 9/.test(inj.text), JSON.stringify(inj));
    ok('el texto va escapado: sin <img> inyectada ni ejecución', !!inj && inj.img === 0 && !inj.xss, JSON.stringify(inj));
    const fb = await page.evaluate(() => ({ b: document.querySelectorAll('#view #zz').length, t: [...document.querySelectorAll('#view .bub')].some((e) => e.textContent.includes('Texto plano <b id="zz">no negrita</b> de respaldo')) }));
    ok('un bloque con forma inválida degrada a texto plano escapado (sin romper la Sala)', fb.b === 0 && fb.t, JSON.stringify(fb));

    // 7) Sin red: el bloque no hace peticiones
    ok('sin peticiones de red externas', reqs.length === 0, reqs.slice(0, 3).join(' '));
    ok('sin errores JS', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  console.log('\n' + (total - bad) + '/' + total + ' comprobaciones correctas' + (bad ? ' · ' + bad + ' FALLAN' : ''));
  await br.close();
  process.exit(bad ? 1 : 0);
})();
