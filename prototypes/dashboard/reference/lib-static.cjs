'use strict';
// Biblioteca común: datos de EJEMPLO, utilidades de gráficos y envoltorio de página de una sola pantalla.
const fs = require('fs');
const SCR = require('path').join(__dirname, '..');

const svgUri = (f) => 'data:image/svg+xml;base64,' + fs.readFileSync(SCR + '/assets/' + f).toString('base64');
async function loadImages() {
  const medal = fs.readFileSync(SCR + '/assets/medal.png');
  return {
    sun: svgUri('wx-sun.svg'), part: svgUri('wx-partly.svg'), cloud: svgUri('wx-cloud.svg'), rain: svgUri('wx-rain.svg'),
    medal: 'data:image/png;base64,' + medal.toString('base64')
  };
}

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const f1 = (n) => n.toFixed(1);
const smooth = (pts) => {
  let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
  }
  return d;
};
const polc = (cx, cy, deg, r) => { const a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
const arrowRot = (from) => 'transform:rotate(' + ((from + 180) % 360) + 'deg)';
const ARROW = '<svg class="ar" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 L12.5 13.5 L8 10.8 L3.5 13.5Z"/></svg>';
const arrowSvg = (from, cls) => '<svg class="' + (cls || 'ar') + '" viewBox="0 0 16 16" style="' + arrowRot(from) + '" aria-hidden="true"><path d="M8 1.5 L12.5 13.5 L8 10.8 L3.5 13.5Z"/></svg>';

// ---------------- DATOS DE EJEMPLO (no reales) ----------------
const wxRaw = [
  { h: '07:45', k: 'part', t: 10, r: 5, w: 16, d: 225 },
  { h: '09:00', k: 'part', t: 11, r: 10, w: 20, d: 225 },
  { h: '11:00', k: 'sun', t: 13, r: 5, w: 22, d: 225 },
  { h: '13:00', k: 'part', t: 14, r: 15, w: 24, d: 240 },
  { h: '15:00', k: 'cloud', t: 14, r: 40, w: 26, d: 240 },
  { h: '17:00', k: 'rain', t: 13, r: 70, w: 28, d: 250 },
  { h: '19:00', k: 'rain', t: 11, r: 60, w: 26, d: 250 },
  { h: '21:00', k: 'cloud', t: 10, r: 30, w: 20, d: 250 }
];
const now = { k: 'part', t: 10, feel: 7, w: 16, r: 5, d: 225 };
const tarde = { k: 'rain', t: 13, feel: 10, w: 28, g: 41, r: 70, d: 250 };

const agenda = [
  ['07:30', '🚴', 'Bici → oficina'], ['09:00', '📞', 'Llamada cliente'], ['11:00', '🎬', 'Producir Reel'],
  ['13:00', '🍽', 'Almuerzo'], ['15:30', '⏱', 'Salir (lluvia)'], ['16:15', '🤸', 'Llevar a __HIJA__'], ['20:00', '🛒', 'Compras']
];
const week = [['X', 21, '🏫🤸', 1], ['J', 22, '🏫', 0], ['V', 23, '🏫🤸', 0], ['S', 24, '🎨', 0], ['D', 25, '', 0], ['L', 26, '🏫🤸', 0], ['M', 27, '🏫🩺', 0]];
const mails = [
  { ini: 'P1', who: '__CONTACTO_FIRMA__', sj: 'Documento por firmar', age: '2 d', sev: 3 },
  { ini: '3K', who: '3 Kings Barbershop', sj: 'Ajustes del chatbot', age: '5 h', sev: 2 },
  { ini: 'C1', who: '__CLIENTE_IBA__', sj: 'IBA · actualización', age: '1 d', sev: 2 },
  { ini: 'HO', who: 'Hosting', sj: 'Renovación de dominio', age: '3 d', sev: 1 }
];
const follow = [
  { x: 'Propuesta Potensic', p: 80, due: 'vie' }, { x: 'Contrato 3 Kings', p: 40, due: 'lun' },
  { x: 'Revisar PR de Janus', p: 0, due: 'hoy' }, { x: 'Fotos Marketing 360', p: 60, due: 'mar' }
];
const reachVals = [4.1, 4.4, 4.0, 4.8, 5.2, 5.0, 5.9, 6.4, 6.1, 6.8, 7.5, 7.2, 8.1, 8.9, 8.4, 9.2, 10.1, 9.6, 10.4, 11.3, 12.8, 12.2, 13.1, 13.9, 13.4, 14.6, 15.8, 15.1, 16.4, 17.2];
const reachSum = reachVals.reduce((a, b) => a + b, 0) * 1000;
const reach = { total: Math.round(reachSum / 1000) + 'K', delta: Math.round((reachSum / 231000 - 1) * 100) + '%', vals: reachVals, avg: reachVals.reduce((a, b) => a + b, 0) / reachVals.length };
const sources = [
  { n: 'Patrocinios · Reels', e: '🎬', v: 1450, w: [280, 360, 400, 410] },
  { n: 'ChatBox SaaS', e: '🤖', v: 1380, w: [300, 330, 360, 390] },
  { n: 'Gumroad', e: '🛍', v: 920, w: [250, 210, 230, 230] },
  { n: 'Marketing 360', e: '🚁', v: 900, w: [150, 250, 250, 250] }
];
const revSum = sources.reduce((a, s) => a + s.v, 0);
const rev = { total: '€' + fmt(revSum), delta: Math.round((revSum / 4140 - 1) * 100) + '%', sum: revSum };
const kpis = [
  { e: '💶', k: 'Ingresos', v: '€' + fmt(revSum), d: rev.delta, s: [3, 3.4, 3.2, 3.8, 3.9, 4.1, 4.0, 4.3, 4.4, 4.5, 4.6, 4.65] },
  { e: '👁', k: 'Alcance', v: reach.total, d: reach.delta, s: reachVals.filter((_, i) => i % 3 === 0).concat([17.2, 16.4]).slice(0, 12) },
  { e: '❤', k: 'Interacción', v: '6,8%', d: '0,9 pt', s: [5.2, 5.6, 5.4, 5.9, 6.1, 6.0, 6.3, 6.4, 6.6, 6.5, 6.7, 6.8] },
  { e: '🤝', k: 'Clientes', v: '3', d: '1', s: [0.4, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3] },
  { e: '📥', k: 'Leads', v: '17', d: '5', s: [4, 5, 5, 7, 8, 8, 10, 11, 12, 14, 15, 17] }
];
const bots = [
  { n: 'IBA · __CLIENTE_IBA__', c: 128, up: 99.6, upT: '99,6', u: '⏳ 2 act.', warn: true, days: [14, 18, 17, 22, 19, 16, 22] },
  { n: 'ChatBox · 3 Kings', c: 41, up: 100, upT: '100', u: '★ 4,7', warn: false, days: [4, 5, 6, 8, 5, 6, 7] }
];
const tops = [
  { t: 'Dron · Marketing 360', v: '48K', vn: 48, m: '€620' },
  { t: 'Chatbot barberías', v: '31K', vn: 31, m: '€410' },
  { t: 'Test Atom 2', v: '23K', vn: 23, m: '€260' }
];
const funnel = [{ e: '📥', n: 17 }, { e: '📅', n: 6 }, { e: '✅', n: 3 }];
const janus = [{ e: '✅', n: 14 }, { e: '🔐', n: 2 }, { e: '🧩', n: 2 }];

// ---------------- Página de una sola pantalla ----------------
// El CSS se escribe en px para una pantalla de referencia de 1194x834 y se convierte a rem;
// la raíz escala con la pantalla (sin barras de desplazamiento).
const px2rem = (css) => css.replace(/(-?\d*\.?\d+)px/g, (_, n) => (parseFloat(n) / 16).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + 'rem');

function page({ title, head, css, body, bg, scheme }) {
  return '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n' +
    '<meta name="color-scheme" content="' + (scheme || 'dark') + '">\n' +
    '<title>' + esc(title) + '</title>\n' + head + '\n<style>\n' +
    'html{font-size:min(1.34vw,1.9185vh);-webkit-text-size-adjust:100%}\n' +
    'html,body{margin:0;height:100%;overflow:hidden;background:' + bg + '}\n' +
    '*{box-sizing:border-box}\n' +
    '.stage{width:100vw;height:100vh;height:100dvh;overflow:hidden;position:relative}\n' +
    '@media (max-aspect-ratio:1/1){.stage{height:69.85vw;top:calc((100dvh - 69.85vw) / 2)}}\n' +
    px2rem(css) + '\n</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
}

module.exports = { SCR, loadImages, esc, fmt, f1, smooth, polc, arrowRot, arrowSvg, ARROW, page, px2rem, D: { wxRaw, now, tarde, agenda, week, mails, follow, reach, sources, rev, kpis, bots, tops, funnel, janus } };
