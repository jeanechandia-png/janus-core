'use strict';
// Uso: node test.cjs [offline|live] [WxH,...]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(process.env.DASH_FILE || path.join(__dirname, '../dist/Janus-A-Obsidiana-interactivo.html'));
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, '../dist/shots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const mode = process.argv[2] || 'offline';
const sizes = (process.argv[3] || '1194x834').split(',').map((s) => s.split('x').map(Number));
const ROUTES = ['', 'inicio', 'trabajo', 'trabajo/chatbox', 'clima', 'clima/h17', 'dia', 'familia', 'prioridades', 'janus', 'ingresos', 'alcance', 'chatbots', 'contenido', 'clientes', 'datos'];
function mockMeteo() {
  const today = '2026-10-21', H = { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], precipitation: [], weather_code: [], wind_speed_10m: [], wind_direction_10m: [], wind_gusts_10m: [], relative_humidity_2m: [], uv_index: [], visibility: [], cloud_cover: [], is_day: [] };
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const dt = new Date(Date.UTC(2026, 9, 21 + d)); const ds = dt.toISOString().slice(0, 10);
    H.time.push(ds + 'T' + String(h).padStart(2, '0') + ':00'); H.temperature_2m.push(8 + 5 * Math.sin((h - 9) / 24 * 6.28)); H.apparent_temperature.push(5 + 5 * Math.sin((h - 9) / 24 * 6.28));
    const r = h >= 16 && h <= 19 ? 75 : 10; H.precipitation_probability.push(r); H.precipitation.push(r > 50 ? 1.2 : 0); H.weather_code.push(r > 50 ? 61 : 2); H.wind_speed_10m.push(14 + h / 2); H.wind_direction_10m.push(230); H.wind_gusts_10m.push(24 + h); H.relative_humidity_2m.push(80); H.uv_index.push(h > 9 && h < 15 ? 2.5 : 0); H.visibility.push(20000); H.cloud_cover.push(60); H.is_day.push(h >= 8 && h < 19 ? 1 : 0);
  }
  const Dd = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [], wind_speed_10m_max: [], sunrise: [], sunset: [] };
  for (let d = 0; d < 7; d++) { const ds = new Date(Date.UTC(2026, 9, 21 + d)).toISOString().slice(0, 10); Dd.time.push(ds); Dd.weather_code.push(61); Dd.temperature_2m_max.push(13); Dd.temperature_2m_min.push(4); Dd.precipitation_probability_max.push(75); Dd.wind_speed_10m_max.push(26); Dd.sunrise.push(ds + 'T08:20'); Dd.sunset.push(ds + 'T18:31'); }
  return { current: { time: today + 'T21:45', temperature_2m: 7.4, apparent_temperature: 4.1, weather_code: 3, wind_speed_10m: 18, wind_direction_10m: 240, wind_gusts_10m: 33, is_day: 0 }, hourly: H, daily: Dd };
}
(async () => {
  const br = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
  let bad = 0;
  for (const [w, h] of sizes) {
    const ctx = await br.newContext({ viewport: { width: w, height: h } });
    await ctx.route('**/api.open-meteo.com/**', (r) => mode === 'live' ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(mockMeteo()) }) : r.abort());
    await ctx.route('**/fonts.g*/**', (r) => r.abort());
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    await page.goto(FILE); await page.waitForTimeout(400);
    for (const r of ROUTES) {
      await page.evaluate((x) => { location.hash = x ? '#' + x : '#'; }, r); await page.waitForTimeout(450);
      await page.evaluate(() => document.getAnimations().filter((a) => a.effect.getTiming().iterations !== Infinity).forEach((a) => a.finish()));
      const info = await page.evaluate(() => {
        const de = document.documentElement, root = document.getElementById('view').hidden ? document.getElementById('dash') : document.getElementById('view');
        const clipped = [], inner = [];
        root.querySelectorAll('*').forEach((el) => {
          if (el.closest('svg') && el.tagName !== 'svg') return;
          const cs = getComputedStyle(el); if (!el.clientHeight) return;
          if ((cs.overflow === 'hidden' || cs.overflowY === 'hidden') && el.scrollHeight > el.clientHeight + 2) clipped.push(el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ').slice(0, 2).join('.') : '') + ' ' + el.scrollHeight + '>' + el.clientHeight);
          if ((cs.overflowY === 'auto') && el.scrollHeight > el.clientHeight + 2) inner.push(el.className + ' ' + el.scrollHeight + '>' + el.clientHeight);
          if ((cs.overflow === 'hidden') && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 2) clipped.push('H ' + el.tagName + '.' + (typeof el.className === 'string' ? el.className.split(' ')[0] : '') + ' ' + el.scrollWidth + '>' + el.clientWidth);
        });
        return { sh: de.scrollHeight, ch: de.clientHeight, sw: de.scrollWidth, cw: de.clientWidth, clipped: clipped.slice(0, 6), inner: inner.slice(0, 4), title: document.title };
      });
      const phone = w <= 760 || h <= 500;
      const vw = await page.evaluate(() => { const v = document.getElementById('view'); return v.hidden ? 0 : v.scrollWidth - v.clientWidth; });
      const ok = phone ? (info.sw <= info.cw + 1 && vw <= 1) : (info.sh <= info.ch + 1 && info.sw <= info.cw + 1 && !info.clipped.length);
      if (phone) info.clipped = vw > 1 ? ['vista desborda ' + vw] : [];
      if (!ok) bad++;
      console.log(w + 'x' + h, (r || 'dashboard').padEnd(12), ok ? 'OK ' : 'FALLA', info.clipped.join(' ; '), info.inner.length ? 'SCROLL-INTERNO: ' + info.inner.join(' ; ') : '');
      if (w === sizes[0][0] || phone) await page.screenshot({ path: SHOTS + '/' + mode + (phone ? '-tel' + w : '') + '-' + (r || 'dashboard').replace('/', '_') + '.png', fullPage: phone });
    }
    if (errs.length) { bad++; console.log('ERRORES JS:', errs.join(' | ')); }
    await ctx.close();
  }
  await br.close();
  console.log(bad ? 'FALLOS: ' + bad : 'TODO OK');
})().catch((e) => { console.error(e); process.exit(1); });
