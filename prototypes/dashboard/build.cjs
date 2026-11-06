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

const skinArg = process.argv.indexOf('--skin');
const SKIN = skinArg > 0 && process.argv[skinArg + 1] === 'b' ? 'b' : 'a';
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? process.argv[outArg + 1] : path.join(D, 'dist', SKIN === 'b' ? 'Janus-B-Platino-interactivo.html' : 'Janus-A-Obsidiana-interactivo.html');

const NAMES = Object.assign({ __HIJA__: 'Hija', __CLIENTE_IBA__: 'Cliente', __CONTACTO_FIRMA__: 'Proveedor', __EDAD_HIJA__: '8', __CIUDAD__: 'Ciudad', __CLIMA_LUGAR__: 'Ámsterdam', __LAT__: '52.37', __LON__: '4.90' }, has('local/names.json') ? JSON.parse(rd('local/names.json')) : {});
const realFile = has('local/real.js') ? 'local/real.js' : 'src/real.example.js';

const svg = (f) => 'data:image/svg+xml;base64,' + b64('assets/' + f);
const moon = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="m" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#FFF7DC"/><stop offset=".6" stop-color="#E9D9A8"/><stop offset="1" stop-color="#9C8650"/></radialGradient><mask id="k"><rect width="64" height="64" fill="#fff"/><circle cx="42" cy="22" r="20" fill="#000"/></mask></defs><circle cx="30" cy="34" r="22" fill="url(#m)" mask="url(#k)"/><circle cx="48" cy="44" r="1.6" fill="#FFF3C4"/><circle cx="52" cy="30" r="1.1" fill="#FFF3C4"/></svg>').toString('base64');
const IMG = { sun: svg('wx-sun.svg'), part: svg('wx-partly.svg'), cloud: svg('wx-cloud.svg'), rain: svg('wx-rain.svg'), moon, medal: 'data:image/png;base64,' + b64('assets/medal.png'), mic: 'data:image/webp;base64,' + b64('assets/mic-vintage.webp'), cLumi: 'data:image/jpeg;base64,' + b64('assets/creatures/lumi.jpg'), cBombo: 'data:image/jpeg;base64,' + b64('assets/creatures/bombo.jpg'), cMusgo: 'data:image/jpeg;base64,' + b64('assets/creatures/musgo.jpg'), cNimbo: 'data:image/jpeg;base64,' + b64('assets/creatures/nimbo.jpg') };

// Exact portraits and accessories cropped from founder-approved concept sheets.
// They are optionally bundled offline from assets/approved/*.webp; NEVER replaced
// with synthetic drawings or arbitrary generated placeholder graphics.
// The four existing audited creature JPEG portraits remain a safe fallback if
// a project checkout has not yet imported the approved WebP art package.
const approvedPortraits = ['lumi','bombo','musgo','nimbo'];
const approvedExpressions = Object.fromEntries(approvedPortraits.map((id) =>
  [id, [1,2,3].map((i) => 'expression-' + id + '-' + i)]));
const approvedAccessories = [
  ['out:capa-galaxia','capa-galaxia'],
  ['out:sudadera-estrella','sudadera-estrella'],
  ['out:chaqueta-lujo','chaqueta-lujo'],
  ['acc:cabeza:corona','corona-estelar'],
  ['acc:cara:gafas-redondas','gafas-glam'],
  ['acc:espalda:mochila','mochila'],
  ['acc:espalda:alas-hada','alas'],
  ['acc:cuello:bufanda','bufanda']
];
// SHA-256 blocks accidental replacement by visual approximations or older art.
const approvedHashes = JSON.parse(rd('assets/approved/INDEX.json')).required_assets;
const crypto = require('node:crypto');
const approvedImage = (name) => {
  const rel = 'assets/approved/' + name + '.webp';
  if (!has(rel)) return null;
  const bytes = fs.readFileSync(path.join(D, rel));
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (approvedHashes[name + '.webp'] !== actual) {
    throw new Error('El recurso ' + name + ' NO coincide con el arte aprobado (SHA-256). No se puede empaquetar.');
  }
  return 'data:image/webp;base64,' + bytes.toString('base64');
};
const APPROVED_ART = {
  version: '2026-11-06',
  originals: 'Diseños aprobados de Lumi, Bombo, Musgo y Nimbo; sin recreación',
  creatures: Object.fromEntries(approvedPortraits.map((id) => [id, approvedImage(id) || IMG['c' + id[0].toUpperCase() + id.slice(1)]])),
  accessories: Object.fromEntries(approvedAccessories.map(([key,name]) => [key, approvedImage(name)]).filter(([,v]) => !!v)),
  expressions: Object.fromEntries(Object.entries(approvedExpressions).map(([id,names]) =>
    [id,names.map(approvedImage)])),
  complete: approvedPortraits.every((id) => !!approvedImage(id)) &&
    approvedAccessories.every(([,name]) => !!approvedImage(name)) &&
    Object.values(approvedExpressions).flat().every((name) => !!approvedImage(name))
};

// No generated stand-ins become canonical by compiling: visual + integrity gate.
const approvedModels = require('./tools/verified-creature-glb.cjs').collect();
if (approvedModels.errors.length)
  throw new Error('GLB rechazado: ' + JSON.stringify(approvedModels.errors));
const APPROVED_GLBS = approvedModels.models;
if (process.argv.includes('--require-approved-3d') && !approvedModels.complete)
  throw new Error('FALTAN GLB HIPERREALISTAS VALIDADOS: ' +
    Object.keys(APPROVED_GLBS).length + '/4. No declarar el producto terminado.');

const files = ['src/skin-map.js', 'src/lib.js', 'src/icons.js', 'src/weather.js', 'src/data.js', realFile, 'src/dash.js', 'src/dash-b.js', 'src/phone.js', 'src/phonev.js', 'src/platform-finops.js', 'src/views.js', 'vendor/deal-radar.js', 'vendor/mail-hub.js', 'vendor/cited-answer.js', 'src/ofertas.js', 'vendor/companion.js', 'lego/janus-cartoon-voice/janus-cartoon-voice.js', 'lego/janus-original-art/janus-original-art.js', 'lego/janus-family-guide/janus-child-safety.js', 'lego/janus-family-guide/janus-child-conversation.js', 'src/companero.js', 'lego/janus-presence/janus-presence.js', 'src/avatar.js', 'vendor/home-scenes.js', 'src/casa.js', 'src/briefing.js', 'vendor/drone-weather.js', 'vendor/three-r160.min.js', 'vendor/gltf-kit.js', 'lego/janus-fur-wind/janus-fur-wind.js', 'lego/janus-nexo-3d/janus-nexo-3d.js', 'lego/janus-3d/janus-3d.js', 'lego/janus-creatures-3d/janus-creatures-3d.js', 'lego/janus-face-3d/janus-face-3d.js', 'lego/janus-creature-slot/janus-creature-slot.js', 'lego/janus-creature-slot/janus-approved-glb-bootstrap.js', 'lego/janus-model-gateway/janus-model-gateway.js', 'vendor/jsqr.js', 'lego/janus-attach/janus-attach.js', 'src/adjuntos.js', 'lego/janus-stage-3d/janus-stage-3d.js', 'lego/janus-edge-companion/janus-edge-companion.js', 'src/phonea2.js', 'src/clima2.js', 'lego/janus-activity/janus-activity.js', 'lego/janus-gold/janus-gold.js', 'src/projects.js', 'src/sala.js', 'src/depth.js', 'src/app.js'];

const GA = 'lego/janus-gold/assets/pulido/', gw = (f) => 'data:image/webp;base64,' + b64(GA + f);
const GLY = JSON.parse(rd(GA + 'glyphs.json')).chars;
const GOLD = { wm: gw('janus.webp'), i: {}, g: {} };
for (const f of fs.readdirSync(path.join(D, GA))) if (/^i-.*\.webp$/.test(f)) GOLD.i[f.slice(2, -5)] = gw(f);
[...GLY].forEach((ch, i) => { GOLD.g[ch] = gw('g' + i + '.webp'); });
GOLD.o = {}; for (const f of fs.readdirSync(path.join(D, 'lego/janus-gold/assets/obj'))) if (f.endsWith('.webp')) GOLD.o[f.slice(0, -5)] = 'data:image/webp;base64,' + b64('lego/janus-gold/assets/obj/' + f);
const MARBLE = "url(\"data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="430" height="1100"><filter id="m"><feTurbulence type="fractalNoise" baseFrequency=".004 .012" numOctaves="5" seed="7"/><feColorMatrix values="0 0 0 0 .62  0 0 0 0 .5  0 0 0 0 .34  0 0 0 -2.6 1.55"/></filter><rect width="100%" height="100%" fill="#0a0908"/><rect width="100%" height="100%" filter="url(#m)" opacity=".55"/></svg>') + "\")";
let js = 'const BUILD_SKIN=' + JSON.stringify(SKIN) + ';\nconst IMG=' + JSON.stringify(IMG) + ';\nconst APPROVED_ART=' + JSON.stringify(APPROVED_ART) + ';\nconst APPROVED_ART_HASHES=' + JSON.stringify(approvedHashes) + ';\nconst APPROVED_GLBS=' + JSON.stringify(APPROVED_GLBS) + ';\nconst GOLD=' + JSON.stringify(GOLD) + ';\n' + files.map(rd).join('\n');
const FONTS = [['Cinzel', 700, 'cinzel-latin-700'], ['Cinzel', 900, 'cinzel-latin-900'], ['Bodoni Moda', 500, 'bodoni-moda-latin-500'], ['Bodoni Moda', 700, 'bodoni-moda-latin-700'], ['Instrument Sans', 400, 'instrument-sans-latin-400'], ['Instrument Sans', 500, 'instrument-sans-latin-500'], ['Instrument Sans', 600, 'instrument-sans-latin-600'], ['IBM Plex Mono', 400, 'ibm-plex-mono-latin-400'], ['IBM Plex Mono', 500, 'ibm-plex-mono-latin-500'], ['IBM Plex Mono', 600, 'ibm-plex-mono-latin-600'],
  // Piel B · Platino
  ['Sora', 600, 'sora-latin-600'], ['Sora', 700, 'sora-latin-700'], ['Manrope', 400, 'manrope-latin-400'], ['Manrope', 500, 'manrope-latin-500'], ['Manrope', 600, 'manrope-latin-600'], ['Manrope', 700, 'manrope-latin-700'], ['DM Mono', 400, 'dm-mono-latin-400'], ['DM Mono', 500, 'dm-mono-latin-500']];
// Tipografías incrustadas (OFL): nítidas y idénticas en cualquier dispositivo, también sin conexión.
const fontCss = FONTS.map(([f, w, file]) => "@font-face{font-family:'" + f + "';font-style:normal;font-weight:" + w + ";font-display:block;src:url(data:font/woff2;base64," + b64('assets/fonts/' + file + '-normal.woff2') + ") format('woff2')}").join('\n');
let css = rd('src/base.css') + rd('src/views.css') + rd('src/depth.css') + rd('lego/janus-activity/janus-activity.css') + rd('src/sala.css') + rd('lego/janus-gold/janus-gold.css') + rd('src/premium.css') + rd('src/phone.css') + rd('src/phonev.css') + rd('src/companero.css') + rd('src/companero-stage.css') + rd('src/phonea2.css') + rd('lego/janus-3d/janus-3d.css') + rd('src/adjuntos.css') + rd('lego/janus-attach/janus-attach.css') + rd('src/platform-finops.css');
// Piel B · Platino: el CSS de A se traduce de paleta (misma fuente de verdad) y se añade el diseño propio del dashboard B.
const SkinMap = require('./tools/skin-map.cjs');
const A_FILES = ['src/base.css', 'src/views.css', 'src/depth.css', 'lego/janus-activity/janus-activity.css', 'src/sala.css', 'lego/janus-gold/janus-gold.css', 'src/premium.css', 'src/phone.css', 'src/phonev.css', 'src/companero.css', 'src/phonea2.css', 'lego/janus-3d/janus-3d.css', 'src/adjuntos.css'];
css += rd('src/skin.css');
const cssB = A_FILES.map((f) => SkinMap.mapCss(rd(f))).join('\n');
css = ':root{--marble:' + MARBLE + '}\n' + css + '\n' + cssB + '\n' + rd('src/dash-b.css') + '\n' + rd('src/companero-stage.css') + '\n' + rd('lego/janus-presence/janus-presence.css') + '\n' + rd('lego/janus-edge-companion/janus-edge-companion.css');
for (const [k, v] of Object.entries(NAMES)) { js = js.split(k).join(v); css = css.split(k).join(v); }

// Fallback de primera pintura: Quick Look/visor de iPhone y lectores de HTML no
// ejecutan de forma fiable el JS embebido. Nunca entregar una pantalla negra.
// El fallback es una VISTA PREVIA estática; no se confunde con la app interactiva.
const fallbackBrand = 'data:image/webp;base64,' + b64('lego/janus-gold/assets/pulido/janus.webp');
const previewPalette = SKIN === 'b' ? 'platinum' : 'obsidian';
const previewName = SKIN === 'b' ? 'Platino B' : 'Obsidiana A';
const fallback = '<div id="janus-static-preview" class="janus-static ' + previewPalette + '">' +
  '<div class="js-phone">' +
  '<div class="js-strap"><b>JANUS</b><span>' + previewName + '</span><strong>● VISTA PREVIA</strong></div>' +
  '<div class="js-hero"><div class="js-avatar"><img src="' + fallbackBrand + '" alt="Identidad de Janus"></div>' +
  '<div><small>ASISTENTE PERSONAL</small><h1>Hola, Jean.</h1><p>Tu espacio de trabajo, proyectos y vida personal, en un mismo lugar.</p></div></div>' +
  '<div class="js-actions"><span>✉ Correo</span><span>▤ Ofertas</span><span>✓ Tareas</span><span>☀ Clima</span></div>' +
  '<div class="js-hdr">MI ESPACIO <small>Acceso a los módulos</small></div>' +
  '<div class="js-stack"><div><strong>◷</strong><b>Mi día</b><small>Agenda personal y laboral</small></div>' +
  '<div><strong>▣</strong><b>Proyectos</b><small>Trabajo y seguimiento</small></div>' +
  '<div><strong>✧</strong><b>Janus · Nexo</b><small>Asistente operativo</small></div>' +
  '<div><strong>★</strong><b>Kendra</b><small>Su mundo y sus criaturas</small></div></div>' +
  '<div class="js-note"><b>Vista previa del archivo</b><p>El visor de archivos del iPhone puede bloquear JavaScript y WebGL. Esta imagen de la interfaz es estática; para usar los controles se necesita abrir la versión web de JANUS en Safari.</p></div>' +
  '<div class="js-footer">INFINITY SEED GROUP · LOCAL FIRST</div>' +
  '</div></div>';
const fallbackCss = `
/* JS ausente o restringido: primera pintura real en Quick Look y modo documento. */
#janus-static-preview{display:block;position:relative;z-index:1;min-height:100dvh}
html.janus-ready #janus-static-preview{display:none!important}
html:not(.janus-ready),html:not(.janus-ready) body{height:auto!important;min-height:100%!important;overflow:auto!important}
html:not(.janus-ready) .stage{display:none!important}
.janus-static{--js-bg:#0d0c14;--js-surface:#1c1a28;--js-text:#faf5eb;--js-mute:#c3b8a5;--js-line:#776145;--js-accent:#e8c37a;
  min-height:100dvh;background:var(--js-bg);color:var(--js-text);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Instrument Sans',sans-serif}
.janus-static.platinum{--js-bg:#eef1f8;--js-surface:#fff;--js-text:#212d4f;--js-mute:#586a8d;--js-line:#d5def3;--js-accent:#2c5bdf}
.janus-static .js-phone{width:min(100%,490px);padding:env(safe-area-inset-top,12px) 14px 18px;margin:0 auto}
.janus-static .js-strap{display:flex;align-items:center;gap:10px;padding:12px 2px 14px;font-size:12px;border-bottom:1px solid var(--js-line)}
.janus-static .js-strap>b{font-family:Georgia,serif;letter-spacing:.17em;font-size:19px}
.janus-static .js-strap>span{color:var(--js-mute);font-size:11px}
.janus-static .js-strap strong{margin-left:auto;background:var(--js-accent);color:var(--js-bg);font-size:9px;padding:5px 7px;border-radius:12px;white-space:nowrap}
.janus-static .js-hero{display:flex;align-items:center;gap:13px;background:var(--js-surface);border:1px solid var(--js-line);border-radius:22px;padding:17px 12px;margin:14px 0}
.janus-static .js-avatar{flex:0 0 34%;max-width:135px;min-width:90px;display:grid;place-items:center;aspect-ratio:1;background:radial-gradient(circle,#a89c8d44,#0003);border-radius:20px;overflow:hidden}
.janus-static .js-avatar img{width:100%;height:100%;object-fit:contain}
.janus-static .js-hero small{color:var(--js-mute);font-size:9px;letter-spacing:.15em;font-weight:700}
.janus-static .js-hero h1{font-family:Georgia,serif;font-size:clamp(24px,7vw,39px);line-height:1.03;margin:7px 0;color:var(--js-accent)}
.janus-static .js-hero p{font-size:12px;line-height:1.4;margin:0;color:var(--js-mute)}
.janus-static .js-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:11px 0}
.janus-static .js-actions span{padding:13px 2px;text-align:center;background:var(--js-surface);border:1px solid var(--js-line);border-radius:12px;font-size:11px}
.janus-static .js-hdr{padding:15px 2px 8px;font-weight:700;font-size:12px;letter-spacing:.11em}
.janus-static .js-hdr small{float:right;font-weight:400;letter-spacing:0;color:var(--js-mute)}
.janus-static .js-stack{display:grid;gap:9px}
.janus-static .js-stack>div{display:grid;grid-template-columns:44px 1fr;column-gap:10px;align-items:center;padding:11px 13px;border-radius:14px;border:1px solid var(--js-line);background:var(--js-surface)}
.janus-static .js-stack strong{grid-row:span 2;font-size:26px;color:var(--js-accent);text-align:center}
.janus-static .js-stack b{font-size:15px}
.janus-static .js-stack small{font-size:11px;color:var(--js-mute)}
.janus-static .js-note{margin:15px 0;padding:14px;border:1px solid var(--js-line);border-radius:14px;background:var(--js-surface);font-size:13px;line-height:1.45}
.janus-static .js-note b{color:var(--js-accent)}
.janus-static .js-note p{margin:6px 0 0;color:var(--js-mute)}
.janus-static .js-footer{text-align:center;font-size:9px;color:var(--js-mute);padding:10px 0;letter-spacing:.12em}
`;
const head = '';
const body = fallback + '<div class="stage a" id="app"><div id="dash" style="display:contents"></div><div id="view" hidden></div></div>\n<script>\n(function(){\n' + js +
  '\n})();\n</script>\n<script>(function(){try{var a=document.querySelector("#dash"),b=document.querySelector("#view");if((a&&a.textContent.trim().length>30)||(b&&b.textContent.trim().length>30))document.documentElement.classList.add("janus-ready");}catch(e){}})();</script>';
const html = '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n' +
  '<meta name="color-scheme" content="dark">\n<title>' + esc(SKIN === 'b' ? 'Janus · Platino' : 'Janus · Obsidiana') + '</title>\n' + head + '\n<style>\n' + fontCss + '\n' +
  'html{font-size:min(1.34vw,1.9185vh);-webkit-text-size-adjust:100%}\n' +
  'html,body{margin:0;height:100%;overflow:hidden;background:#07070a}\n*{box-sizing:border-box}\n' +
  '.stage{width:100vw;height:100vh;height:100dvh;overflow:hidden;position:relative}\n' +
  '@media (max-aspect-ratio:1/1){.stage{height:69.85vw;top:calc((100dvh - 69.85vw) / 2)}}\n' +
  px2rem(css) + '\n' + fallbackCss + '\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log('ok', OUT, (html.length / 1024).toFixed(0) + ' KB', '· datos:', realFile, '· nombres:', has('local/names.json') ? 'local' : 'genéricos');
console.log('MODELOS 3D APROBADOS:',Object.keys(APPROVED_GLBS).length+'/4; acabado 3D final:',approvedModels.complete?'VERIFICADO':'PENDIENTE');
// Variante para vista previa navegable alojada (Artifact): sin esqueleto propio.
const artArg = process.argv.indexOf('--artifact');
if (artArg > 0) {
  const art = html.replace(/^<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^\n]*\n/, '').replace('</head>\n<body>\n', '').replace('\n</body>\n</html>\n', '\n');
  fs.writeFileSync(process.argv[artArg + 1], art);
  console.log('artifact', process.argv[artArg + 1], (art.length / 1024).toFixed(0) + ' KB');
}
