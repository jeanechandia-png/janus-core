'use strict';
/* ===== Utilidades comunes ===== */
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (n, d) => Number(n).toFixed(d === undefined ? 1 : d).replace('.', ',');
const f1 = (n) => n.toFixed(1);
const rem = (px) => (px / 16).toFixed(3) + 'rem';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pad2 = (n) => String(n).padStart(2, '0');
const hmToMin = (s) => { const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
const minToHm = (m) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60); };
const smooth = (pts) => {
  if (!pts.length) return '';
  let d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ' C' + f1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + f1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]);
  }
  return d;
};
const polc = (cx, cy, deg, r) => { const a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
const arrowSvg = (from, cls) => '<svg class="' + (cls || 'ar') + '" viewBox="0 0 16 16" style="transform:rotate(' + ((from + 180) % 360) + 'deg)" aria-hidden="true"><path d="M8 1.5 L12.5 13.5 L8 10.8 L3.5 13.5Z"/></svg>';
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const compassTxt = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
function prng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const WD = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'], WDL = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/* Fechas sin zona horaria: {y,m,d} → índice de día absoluto */
const dayNum = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / 864e5);
const fromDayNum = (n) => { const dt = new Date(n * 864e5); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), wd: dt.getUTCDay() }; };
const dateLabel = (n) => { const o = fromDayNum(n); return WD[o.wd] + ' ' + o.d + ' ' + MO[o.m - 1].toUpperCase(); };
const dateShort = (n) => { const o = fromDayNum(n); return WDL[o.wd] + ' ' + o.d; };
const dateMid = (n) => { const o = fromDayNum(n); return WD[o.wd].toLowerCase() + ' ' + o.d; };

/* ===== Estado local (solo este dispositivo) ===== */
const STORE_KEY = 'janus.preview.A.v1';
const DEFAULT_ST = {
  settings: { ida: '07:30', vuelta: '17:00', rainBad: 50, rainWarn: 30, windBad: 30, windWarn: 22, feelCold: 14, feelGlove: 9, mode: 'vivo', lat: 51.98, lon: 5.91, place: 'Arnhem', placeSrc: 'por defecto', goal: 5000 },
  done: {}, lleva: {}, mail: {}, follow: {}, appr: {}, upd: {}, localEv: [], newFollow: [], kcheck: {}
};
let ST = JSON.parse(JSON.stringify(DEFAULT_ST));
let storeOk = true;
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const o = JSON.parse(raw); ST = Object.assign({}, ST, o); ST.settings = Object.assign({}, DEFAULT_ST.settings, o.settings || {}); }
  } catch (e) { storeOk = false; }
}
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(ST)); } catch (e) { storeOk = false; } }
function resetState() { ST = JSON.parse(JSON.stringify(DEFAULT_ST)); try { localStorage.removeItem(STORE_KEY); } catch (e) { /* sin almacenamiento */ } }
