'use strict';
// Ensambla el dashboard A (Obsidiana) en un único HTML autónomo.
// Uso: node build.cjs [--out ruta.html]
// Datos personales: si existen local/real.js y local/names.json se usan; si no, ejemplo público.
const fs = require('fs');
const path = require('path');
const D = __dirname;
const rd = (p) => fs.readFileSync(path.join(D, p), 'utf8');
const has = (p) => fs.existsSync(path.join(D, p));
const b64 = (p) => fs.readFileSync(path.join(D, p)).toString('base64');
const px2rem = (css) => css.replace(/(-?\d*\.?\d+)px/g, (_, n) => (parseFloat(n) / 16).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + 'rem');
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? process.argv[outArg + 1] : path.join(D, 'dist', 'Janus-A-Obsidiana-interactivo.html');

const NAMES = Object.assign({ __HIJA__: 'Hija', __CLIENTE_IBA__: 'Cliente', __CONTACTO_FIRMA__: 'Proveedor', __EDAD_HIJA__: '8', __CIUDAD__: 'Ciudad', __CLIMA_LUGAR__: 'Ámsterdam', __LAT__: '52.37', __LON__: '4.90' }, has('local/names.json') ? JSON.parse(rd('local/names.json')) : {});
const realFile = has('local/real.js') ? 'local/real.js' : 'src/real.example.js';

const svg = (f) => 'data:image/svg+xml;base64,' + b64('assets/' + f);
const moon = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="m" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF7DC"/><stop offset=".6" stop-color="#E9D9A8"/><stop offset="1" stop-color="#9C8650"/></radialGradient><mask id="k"><rect width="64" height="64" fill="#fff"/><circle cx="42" cy="22" r="20" fill="#000"/></mask></defs><circle cx="30" cy="34" r="22" fill="url(#m)" mask="url(#k)"/><circle cx="48" cy="44" r="1.6" fill="#FFF3C4"/><circle cx="52" cy="30" r="1.1" fill="#FFF3C4"/></svg>').toString('base64');
const IMG = { sun: svg('wx-sun.svg'), part: svg('wx-partly.svg'), cloud: svg('wx-cloud.svg'), rain: svg('wx-rain.svg'), moon, medal: 'data:image/png;base64,' + b64('assets/medal.png'), mic: 'data:image/webp;base64,' + b64('assets/mic-vintage.webp'), cLumi: 'data:image/jpeg;base64,' + b64('assets/creatures/lumi.jpg'), cBombo: 'data:image/jpeg;base64,' + b64('assets/creatures/bombo.jpg'), cMusgo: 'data:image/jpeg;base64,' + b64('assets/creatures/musgo.jpg'), cNimbo: 'data:image/jpeg;base64,' + b64('assets/creatures/nimbo.jpg') };

const files = ['src/lib.js', 'src/icons.js', 'src/weather.js', 'src/data.js', realFile, 'src/dash.js', 'src/phone.js', 'src/phonev.js', 'src/views.js', 'vendor/deal-radar.js', 'vendor/mail-hub.js', 'src/ofertas.js', 'vendor/companion.js', 'src/companero.js', 'vendor/home-scenes.js', 'src/casa.js', 'src/briefing.js', 'vendor/drone-weather.js', 'vendor/three-r160.min.js', 'lego/janus-3d/janus-3d.js', 'src/phonea2.js', 'src/clima2.js', 'lego/janus-activity/janus-activity.js', 'lego/janus-gold/janus-gold.js', 'src/projects.js', 'src/sala.js', 'src/depth.js', 'src/app.js'];

const GA = 'lego/janus-gold/assets/pulido/', gw = (f) => 'data:image/webp;base64,' + b64(GA + f);
const GLY = JSON.parse(rd(GA + 'glyphs.json')).chars;
const GOLD = { wm: gw('janus.webp'), i: {}, g: {} };
for (const f of fs.readdirSync(path.join(D, GA))) if (/^i-.*\.webp$/.test(f)) GOLD.i[f.slice(2, -5)] = gw(f);
[...GLY].forEach((ch, i) => { GOLD.g[ch] = gw('g' + i + '.webp'); });
GOLD.o = {}; for (const f of fs.readdirSync(path.join(D, 'lego/janus-gold/assets/obj'))) if (f.endsWith('.webp')) GOLD.o[f.slice(0, -5)] = 'data:image/webp;base64,' + b64('lego/janus-gold/assets/obj/' + f);
const MARBLE = "url(\"data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="430" height="1100"><filter id="m"><feTurbulence type="fractalNoise" baseFrequency=".004 .012" numOctaves="5" seed="7"/><feColorMatrix values="0 0 0 0 .62  0 0 0 0 .5  0 0 0 0 .34  0 0 0 -2.6 1.55"/></filter><rect width="100%" height="100%" fill="#0a0908"/><rect width="100%" height="100%" filter="url(#m)" opacity=".55"/></svg>') + "\")";
let js = 'const IMG=' + JSON.stringify(IMG) + ';\nconst GOLD=' + JSON.stringify(GOLD) + ';\n' + files.map(rd).join('\n');
const FONTS = [['Cinzel', 700, 'cinzel-latin-700'], ['Cinzel', 900, 'cinzel-latin-900'], ['Bodoni Moda', 500, 'bodoni-moda-latin-500'], ['Bodoni Moda', 700, 'bodoni-moda-latin-700'], ['Instrument Sans', 400, 'instrument-sans-latin-400'], ['Instrument Sans', 500, 'instrument-sans-latin-500'], ['Instrument Sans', 600, 'instrument-sans-latin-600'], ['IBM Plex Mono', 400, 'ibm-plex-mono-latin-400'], ['IBM Plex Mono', 500, 'ibm-plex-mono-latin-500'], ['IBM Plex Mono', 600, 'ibm-plex-mono-latin-600']];
// Tipografías incrustadas (OFL): nítidas y idénticas en cualquier dispositivo, también sin conexión.
const fontCss = FONTS.map(([f, w, file]) => "@font-face{font-family:'" + f + "';font-style:normal;font-weight:" + w + ";font-display:block;src:url(data:font/woff2;base64," + b64('assets/fonts/' + file + '-normal.woff2') + ") format('woff2')}").join('\n');
let css = rd('src/base.css') + rd('src/views.css') + rd('src/depth.css') + rd('lego/janus-activity/janus-activity.css') + rd('src/sala.css') + rd('lego/janus-gold/janus-gold.css') + rd('src/premium.css') + rd('src/phone.css') + rd('src/phonev.css') + rd('src/companero.css') + rd('src/phonea2.css') + rd('lego/janus-3d/janus-3d.css');
css = ':root{--marble:' + MARBLE + '}\n' + css;
for (const [k, v] of Object.entries(NAMES)) { js = js.split(k).join(v); css = css.split(k).join(v); }

const head = '';
const body = '<div class="stage a" id="app"><div id="dash" style="display:contents"></div><div id="view" hidden></div></div>\n<script>\n(function(){\n' + js + '\n})();\n</script>';
const html = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="color-scheme" content="dark">\n<title>' + esc('Janus · Obsidiana') + '</title>\n' + head + '\n<style>\n' + fontCss + '\n' +
  'html{font-size:min(1.34vw,1.9185vh);-webkit-text-size-adjust:100%}\n' +
  'html,body{margin:0;height:100%;overflow:hidden;background:#07070a}\n*{box-sizing:border-box}\n' +
  '.stage{width:100vw;height:100vh;height:100dvh;overflow:hidden;position:relative}\n' +
  '@media (max-aspect-ratio:1/1){.stage{height:69.85vw;top:calc((100dvh - 69.85vw) / 2)}}\n' +
  px2rem(css) + '\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log('ok', OUT, (html.length / 1024).toFixed(0) + ' KB', '· datos:', realFile, '· nombres:', has('local/names.json') ? 'local' : 'genéricos');
// Variante para vista previa navegable alojada (Artifact): sin esqueleto propio.
const artArg = process.argv.indexOf('--artifact');
if (artArg > 0) {
  const art = html.replace(/^<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^\n]*\n/, '').replace('</head>\n<body>\n', '').replace('\n</body>\n</html>\n', '\n');
  fs.writeFileSync(process.argv[artArg + 1], art);
  console.log('artifact', process.argv[artArg + 1], (art.length / 1024).toFixed(0) + ' KB');
}
