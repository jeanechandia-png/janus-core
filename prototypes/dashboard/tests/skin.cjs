/* Pruebas de la piel B · Platino (y de que A no cambia).
 *   node build.cjs && node build.cjs --skin b && node tests/skin.cjs
 * Variables: PLAYWRIGHT_MODULE, CHROME_PATH, SHARP_MODULE (opcional: sin ella se omite la auditoría de contraste),
 *            DASH_A (HTML de A), DASH_B (HTML de B). */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let sharp = null; try { sharp = require(process.env.SHARP_MODULE || 'sharp'); } catch (e) { /* sin auditoría de contraste */ }
const FA = path.resolve(process.env.DASH_A || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const FB = path.resolve(process.env.DASH_B || path.join(__dirname, '../dist/Janus-B-Platino-interactivo.html'));
const ROUTES = ['clima', 'dia', 'familia', 'prioridades', 'trabajo/janus', 'janus', 'ingresos', 'alcance', 'chatbots', 'contenido', 'clientes', 'correo', 'ofertas', 'casa', 'companero', 'datos'];
const TABLET = { width: 1194, height: 834 }, PHONE = { width: 430, height: 932 };

let ok = 0, bad = 0; const fail = [];
const check = (name, cond, extra) => { if (cond) { ok++; console.log('  ✓ ' + name); } else { bad++; fail.push(name); console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); } };

const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const parseRgb = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(',').map(Number); return { rgb: p.slice(0, 3), a: p[3] === undefined ? 1 : p[3] }; };

async function open(br, file, q, size, hash) {
  const phone = size.width < 600;
  const ctx = await br.newContext({ viewport: size, hasTouch: phone, isMobile: phone });
  const reqs = []; const errs = [];
  // Única red permitida por diseño: Open-Meteo (clima en vivo, pública y sin clave). Se aborta (modo «ejemplo») y no cuenta; cualquier otro host sí.
  await ctx.route('**/*', (r) => { const u = r.request().url(); if (/^https:\/\/(api|geocoding-api)\.open-meteo\.com\//.test(u)) return r.abort(); if (!/^(file|data|blob|about):/.test(u)) { reqs.push(u); return r.abort(); } return r.continue(); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto('file://' + file + (q || '') + (hash || '')); await page.waitForTimeout(900);
  return { ctx, page, reqs, errs };
}

/* Contraste: texto visible frente al fondo REAL (captura con el texto oculto). Devuelve {n, bajo3, bajo45, lista}. */
async function contrast(page, size) {
  const items = await page.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim(); if (!t) continue;
      const el = n.parentElement; if (!el || /SCRIPT|STYLE|TEXTAREA|OPTION/.test(el.tagName)) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      if (/rgba\(0, 0, 0, 0\)/.test(cs.webkitTextFillColor || '')) continue;      // texto con degradado: se revisa a ojo
      if (/^[\p{Extended_Pictographic}\s‍️]+$/u.test(t)) continue;       // emoji
      const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
      if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) continue;
      const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2)));
      if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;  // tapado por otra capa
      let op = 1, e = el; while (e && e !== document.body) { op *= +getComputedStyle(e).opacity; e = e.parentElement; }
      out.push({ t: t.slice(0, 26), x: b.left, y: b.top, w: b.width, h: b.height, color: cs.color, op, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight || 400, av: !!el.closest('.pl-av') });
    }
    return out;
  });
  await page.addStyleTag({ content: '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important}' });
  const { data, info } = await sharp(await page.screenshot()).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const sx = info.width / size.width, sy = info.height / size.height; const lista = [];
  for (const it of items) {
    const c = parseRgb(it.color); if (!c) continue;
    const px = []; for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { const X = Math.min(info.width - 1, Math.max(0, Math.round((it.x + it.w * (i + 0.5) / 5) * sx))), Y = Math.min(info.height - 1, Math.max(0, Math.round((it.y + it.h * (j + 0.5) / 3) * sy))); const k = (Y * info.width + X) * 4; px.push([data[k], data[k + 1], data[k + 2]]); }
    const bg = [0, 1, 2].map((ch) => px.map((p) => p[ch]).sort((a, b) => a - b)[Math.floor(px.length / 2)]);
    const a = c.a * it.op, fg = c.rgb.map((v, i) => v * a + bg[i] * (1 - a));
    const r = ratio(fg, bg), sym = /^[^\p{L}\p{N}]+$/u.test(it.t), large = it.fs >= 24 || (it.fs >= 18.66 && it.fw >= 700);
    lista.push({ t: it.t, r: +r.toFixed(2), need: (large || sym) ? 3 : 4.5, av: it.av, fs: it.fs });
  }
  return { n: lista.length, bajo3: lista.filter((x) => x.r < 3 && !x.av), bajo45: lista.filter((x) => x.r < x.need && !x.av), av: lista.filter((x) => x.av && x.r < x.need).length };
}

(async () => {
  const br = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });

  console.log('\n[1] Selector A/B y persistencia');
  { const { ctx, page, errs } = await open(br, FA, '', TABLET);
    check('A por defecto: raíz .stage.a y título «Obsidiana»', await page.evaluate(() => !!document.querySelector('.stage.a') && /Obsidiana/.test(document.title)));
    check('A: no hay elementos de B (clases pl-)', await page.evaluate(() => !document.querySelector('[class*="pl-"]')));
    check('A: el selector está en la cabecera', await page.evaluate(() => !!document.querySelector('.hd [data-act=skin][data-arg=b]')));
    await page.click('.hd [data-act=skin][data-arg=b]'); await page.waitForTimeout(400);
    check('pulsar B cambia a .stage.b y título «Platino»', await page.evaluate(() => !!document.querySelector('.stage.b') && /Platino/.test(document.title)));
    check('B: dashboard propio (pl-) con selector', await page.evaluate(() => !!document.querySelector('.pl-hd [data-act=skin][data-arg=a]') && !!document.querySelector('.pl-b3')));
    await page.reload(); await page.waitForTimeout(600);
    check('la piel B persiste tras recargar', await page.evaluate(() => !!document.querySelector('.stage.b')));
    await page.click('.pl-hd [data-act=skin][data-arg=a]'); await page.waitForTimeout(400);
    check('volver a A funciona', await page.evaluate(() => !!document.querySelector('.stage.a') && !document.querySelector('[class*="pl-"]')));
    await page.goto('file://' + FA + '?skin=b'); await page.waitForTimeout(500);
    check('?skin=b fuerza B', await page.evaluate(() => !!document.querySelector('.stage.b')));
    await page.goto('file://' + FA + '?skin=a'); await page.waitForTimeout(500);
    check('?skin=a fuerza A', await page.evaluate(() => !!document.querySelector('.stage.a')));
    check('sin errores JS', errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close(); }

  console.log('\n[2] Fichero B (build --skin b)');
  { const { ctx, page, errs, reqs } = await open(br, FB, '', TABLET);
    check('arranca en B sin parámetro', await page.evaluate(() => !!document.querySelector('.stage.b') && /Platino/.test(document.title)));
    check('puede pasar a A desde su selector', await (async () => { await page.click('.pl-hd [data-act=skin][data-arg=a]'); await page.waitForTimeout(300); return page.evaluate(() => !!document.querySelector('.stage.a')); })());
    check('sin peticiones de red salvo Open-Meteo (clima en vivo)', reqs.length === 0, reqs.slice(0, 2).join(' '));
    check('sin errores JS', errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close(); }

  console.log('\n[3] Dashboard B en tablet: una pantalla, sin recortes, todo navega');
  { const { ctx, page, errs } = await open(br, FA, '?skin=b', TABLET);
    const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth }));
    check('sin scroll vertical ni horizontal', m.sh <= m.ih + 1 && m.sw <= m.iw + 1, JSON.stringify(m));
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.pl-cd')].filter((c) => c.scrollWidth > c.clientWidth + 2 || c.scrollHeight > c.clientHeight + 2).map((c) => (c.querySelector('.pl-lb') || {}).textContent));
    check('ninguna tarjeta con contenido recortado', clipped.length === 0, clipped.join(', '));
    const cortados = await page.evaluate(() => [...document.querySelectorAll('.pl-lb .pl-mt')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim().slice(0, 18)));
    check('ninguna cabecera de tarjeta con el texto cortado (…)', cortados.length === 0, cortados.join(' | '));
    const routes = await page.evaluate(() => [...new Set([...document.querySelectorAll('.stage [data-go]')].map((e) => e.getAttribute('data-go')))]);
    check('el dashboard B expone ≥ 14 rutas distintas', routes.length >= 14, String(routes.length));
    const rutasKo = [];
    for (const r of routes) {
      await page.goto('file://' + FA + '?skin=b'); await page.waitForTimeout(250);
      await page.evaluate((rt) => { document.querySelector('.stage [data-go="' + rt + '"]').click(); }, r); await page.waitForTimeout(250);
      const h = await page.evaluate(() => location.hash);
      if (h !== '#' + r) rutasKo.push(r + '→' + h);
    }
    check('cada zona toca-y-abre su detalle (' + routes.length + ' rutas)', rutasKo.length === 0, rutasKo.slice(0, 4).join(' '));
    check('sin errores JS', errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close(); }

  console.log('\n[4] Dashboard B en móvil');
  { const { ctx, page, errs } = await open(br, FA, '?skin=b', PHONE);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, a2: !!document.querySelector('.a2c'), sk: !!document.querySelector('.a2sk[data-act=skin]') }));
    check('sin desbordamiento horizontal', m.sw <= m.iw + 1, JSON.stringify(m));
    check('diseño de móvil (A2) con el botón A/B', m.a2 && m.sk);
    await page.click('.a2sk[data-act=skin]'); await page.waitForTimeout(400);
    check('el botón del móvil cambia a A y vuelve', await page.evaluate(() => !!document.querySelector('.stage.a')));
    await page.click('.a2sk[data-act=skin]'); await page.waitForTimeout(400);
    check('…y de nuevo a B', await page.evaluate(() => !!document.querySelector('.stage.b')));
    check('sin errores JS', errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close(); }

  console.log('\n[5] Todas las vistas de detalle abren en B (tablet y móvil) sin errores');
  for (const [nom, size] of [['tablet', TABLET], ['móvil', PHONE]]) {
    const { ctx, page, errs } = await open(br, FA, '?skin=b', size); const ko = [];
    for (const r of ROUTES) {
      await page.goto('about:blank'); await page.goto('file://' + FA + '?skin=b#' + r); await page.waitForTimeout(450);
      const st = await page.evaluate(() => { const v = document.querySelector('#view'); const cs = v && getComputedStyle(v); return { on: !!v && cs.display !== 'none' && v.textContent.trim().length > 20, b: !!document.querySelector('.stage.b'), sw: document.documentElement.scrollWidth - innerWidth }; });
      if (!st.on || !st.b || st.sw > 1) ko.push(r + (st.sw > 1 ? ' (desborda ' + st.sw + 'px)' : ''));
    }
    check(nom + ': ' + ROUTES.length + ' vistas abren en B, sin desborde horizontal', ko.length === 0, ko.join(', '));
    check(nom + ': sin errores JS', errs.length === 0, errs.slice(0, 2).join(' | ')); await ctx.close();
  }

  console.log('\n[5b] Iconos de B: todos 3D (medallones de platino + zafiro), ninguno de trazo plano ni de oro');
  for (const [nom, size] of [['tablet', TABLET], ['móvil', PHONE]]) {
    const { ctx, page } = await open(br, FA, '?skin=b', size); const planos = [], oro = [], rotos = [], chicos = []; let n3d = 0;
    for (const r of [''].concat(ROUTES)) {
      await page.goto('about:blank'); await page.goto('file://' + FA + '?skin=b' + (r ? '#' + r : '')); await page.waitForTimeout(500);
      const res = await page.evaluate(() => {
        const st = document.querySelector('.stage'); const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
        const im = [...st.querySelectorAll('img.pt3')].filter(vis);
        return {
          planos: [...st.querySelectorAll('svg.ji')].filter(vis).map((e) => e.getAttribute('data-e')),
          oro: [...st.querySelectorAll('img.ji3,.a2i:not(.pt3)')].filter(vis).length,
          rotos: im.filter((i) => !i.complete || !i.naturalWidth).length,
          chicos: im.filter((i) => i.getBoundingClientRect().width < 13.5).length, n: im.length
        };
      });
      res.planos.forEach((e) => planos.push((r || 'inicio') + ':' + e)); if (res.oro) oro.push((r || 'inicio') + ' ×' + res.oro); if (res.rotos) rotos.push(r || 'inicio'); if (res.chicos) chicos.push((r || 'inicio') + ' ×' + res.chicos); n3d += res.n;
    }
    check(nom + ': ' + n3d + ' iconos 3D visibles y todos cargados', n3d > 40 && rotos.length === 0, rotos.join(', ') || String(n3d));
    check(nom + ': ningún icono de trazo plano', planos.length === 0, [...new Set(planos)].slice(0, 8).join(' '));
    check(nom + ': ningún objeto de oro de A sin traducir', oro.length === 0, oro.join(', '));
    check(nom + ': ningún icono 3D menor de 14 px', chicos.length === 0, chicos.join(', '));
    await ctx.close();
  }

  console.log('\n[6] Contraste de texto en B (WCAG: ≥ 4,5:1; ≥ 3:1 en texto grande y símbolos)');
  if (!sharp) console.log('  – omitido (falta «sharp»; SHARP_MODULE)');
  else {
    const reporte = [];
    for (const [nom, size] of [['tablet', TABLET], ['móvil', PHONE]]) {
      let n = 0, b3 = [], b45 = [], av = 0;
      for (const r of [''].concat(ROUTES)) {
        let res = null;
        for (let intento = 0; intento < 2; intento++) {           // la captura puede pillar una transición: se repite una vez
          const { ctx, page } = await open(br, FA, '?skin=b', size, r ? '#' + r : ''); await page.waitForTimeout(500);
          res = await contrast(page, size); await ctx.close();
          if (!res.bajo3.some((x) => x.r <= 1.05)) break;
        }
        n += res.n; b3 = b3.concat(res.bajo3.map((x) => (r || 'inicio') + ':' + x.t + ' ' + x.r)); b45 = b45.concat(res.bajo45); av += res.av;
      }
      check(nom + ': ningún texto por debajo de 3:1 (' + n + ' textos revisados)', b3.length === 0, b3.slice(0, 5).join(' | '));
      const pct = n ? (100 * b45.length / n) : 0;
      check(nom + ': menos del 3 % por debajo de 4,5:1 (' + b45.length + ' de ' + n + ' = ' + pct.toFixed(1) + ' %)', pct < 3, b45.slice(0, 5).map((x) => x.t + ' ' + x.r).join(' | '));
      reporte.push(nom + ' ' + b45.length + '/' + n + (av ? ' (+' + av + ' iniciales sobre esfera 3D, revisadas a ojo)' : ''));
    }
    console.log('  · bajo 4,5:1 → ' + reporte.join(' · '));
  }

  await br.close();
  console.log('\n' + (bad ? 'FALLAN ' + bad + ' de ' + (ok + bad) + ': ' + fail.join(' | ') : ok + '/' + ok + ' comprobaciones correctas'));
  process.exit(bad ? 1 : 0);
})();
