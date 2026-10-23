'use strict';
/* Genera los medallones 3D «Platino» (platino pulido + esmalte zafiro, símbolo Lucide macizo en relieve) en lego/janus-platino/assets/obj.
 *   node tools/platino3d/run.cjs [icono1,icono2,…|all] [carpeta de salida] [px]
 * Requisitos (ver README.md): servidor HTTP en :8765 sirviendo esta carpeta y nm/ -> node_modules con three@0.160.0, clipper-lib, lucide-static.
 * Variables: PLAYWRIGHT_MODULE, SHARP_MODULE, CHROME_PATH, SS (supermuestreo, 3), Q (calidad WebP, 84), EXTRA (iconos Lucide extra separados por coma). */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const LUC = path.join(__dirname, 'nm/lucide-static/icons');
// «all» = todos los iconos que usa el dashboard (tools/gen-icons.cjs) + los objetos 3D de A (EMO_OBJ) + EXTRA.
function allNames() {
  const src = fs.readFileSync(path.join(__dirname, '../gen-icons.cjs'), 'utf8');
  const MAP = eval('(' + src.match(/const MAP = (\{[\s\S]*?\n\});/)[1] + ')');
  const obj = fs.readdirSync(path.join(__dirname, '../../lego/janus-gold/assets/obj')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5));
  return [...new Set(Object.values(MAP).concat(Object.keys(DOTS), obj, (process.env.EXTRA || '').split(',').filter(Boolean)))];
}
// Puntos de estado (🔴🟠🔵🟢🟡): cabujón de color en canto de platino, sin símbolo.
const DOTS = {
  'dot-red': ['#ff9a9a', '#e8323d', '#b01220', '#5c0610'], 'dot-orange': ['#ffc885', '#f58a1f', '#c4560a', '#6b2a02'],
  'dot-blue': ['#6e9bff', '#2a55e6', '#1233b4', '#091a63'], 'dot-green': ['#86f2bb', '#1fb96f', '#0c8248', '#04391f'],
  'dot-yellow': ['#fff3a8', '#f6c71a', '#c18f08', '#6b4a02']
};
const arg = process.argv[2] || 'all';
const names = arg === 'all' ? allNames() : arg.split(',');
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '../../lego/janus-platino/assets/obj')), PX = +(process.argv[4] || 256), SS = +(process.env.SS || 3);
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:8765/render.html'); await p.waitForFunction(() => window.R && window.R.ready, null, { timeout: 30000 });
  for (const n of names) {
    const dot = DOTS[n], f = path.join(LUC, n + '.svg'); if (!dot && !fs.existsSync(f)) { console.log('FALTA', n); continue; }
    const t0 = Date.now(), url = await p.evaluate((a) => window.R.medal(a), dot ? { colors: dot, dome: 2.4, size: PX * SS } : { svg: fs.readFileSync(f, 'utf8'), size: PX * SS });
    await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(PX, PX, { kernel: 'lanczos3' }).webp({ quality: +(process.env.Q || 84), alphaQuality: 100, effort: 5 }).toFile(path.join(outDir, n + '.webp'));
    console.log('ok', n, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  if (errs.length) console.log('ERR', errs.slice(0, 3).join(' | '));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
