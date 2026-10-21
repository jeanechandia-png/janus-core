'use strict';
/* ===== Router, render y eventos ===== */
const $root = document.getElementById('app');
let ROUTE = { v: '', sub: '' };
function parseHash() { const h = decodeURIComponent((location.hash || '').replace(/^#\/?/, '')); const i = h.indexOf('/'); return i < 0 ? { v: h, sub: '' } : { v: h.slice(0, i), sub: h.slice(i + 1) }; }
function render() {
  const M = model(), X = derived(M);
  const dash = document.getElementById('dash'), view = document.getElementById('view');
  dash.innerHTML = renderDash(M, X);
  if (ROUTE.v && VIEWS[ROUTE.v]) { view.innerHTML = VIEWS[ROUTE.v](M, X, ROUTE.sub); view.hidden = false; dash.setAttribute('aria-hidden', 'true'); document.title = 'Janus · ' + TABS.find((t) => t[0] === ROUTE.v)[2]; }
  else { view.hidden = true; view.innerHTML = ''; dash.removeAttribute('aria-hidden'); document.title = 'Janus · Obsidiana'; }
}
function rerender() { render(); }
function go(r) { const target = r ? '#' + r : '#'; if (location.hash === target || (!r && (location.hash === '' || location.hash === '#'))) { onRoute(); return; } location.hash = target; }
function onRoute() { ROUTE = parseHash(); if (!ROUTE.v || !VIEWS[ROUTE.v]) ROUTE = { v: '', sub: '' }; render(); }
window.addEventListener('hashchange', onRoute);
window.addEventListener('popstate', onRoute);

const field = (name) => { const el = document.querySelector('#view [data-f="' + name + '"]'); return el ? el.value.trim() : ''; };
const ACTS = {
  clH: (a) => { const M = model(); if (String(a)[0] === 'a') UI.clH = +String(a).slice(1); else UI.clH = clamp((UI.clH == null ? M.raw.nowIdx : UI.clH) + (+a), 0, M.raw.hourly.length - 1); UI.clDay = Math.floor(UI.clH / 24); ROUTE.sub = ''; },
  clDay: (a) => { UI.clDay = +a; UI.clH = UI.clDay * 24 + 8; ROUTE.sub = ''; },
  clMetric: (a) => { UI.clMetric = a; },
  dDay: (a) => { UI.dDay = +a; UI.dSel = null; ROUTE.sub = ''; },
  dSel: (a) => { UI.dSel = a; ROUTE.sub = ''; },
  evDone: (a) => { ST.done[a] = !ST.done[a]; saveState(); },
  evAdd: () => { const t = field('evT'), h = field('evH'); if (!t || !/^\d\d:\d\d$/.test(h)) return; const id = 'loc' + Date.now(); ST.localEv.push({ id, day: UI.dDay, h, t, e: '📌', amb: field('evA') || 'p', dur: 30, where: '', note: 'Añadido en este dispositivo' }); UI.dSel = id; saveState(); },
  evDel: (a) => { ST.localEv = ST.localEv.filter((x) => x.id !== a); UI.dSel = null; saveState(); },
  kDay: (a) => { UI.kDay = +a; ROUTE.sub = ''; },
  lleva: (a) => { ST.lleva[a] = !ST.lleva[a]; saveState(); },
  mFilter: (a) => { UI.mFilter = +a; },
  mSel: (a) => { UI.mSel = a; ROUTE.sub = ''; },
  mail: (a) => { const [id, k] = a.split('|'); const m = ST.mail[id] = ST.mail[id] || {}; m[k] = !m[k]; saveState(); },
  fp: (a) => { const [id, d] = a.split('|'); const f = ST.follow[id] = ST.follow[id] || {}; const base = (DATA.follow.concat(ST.newFollow).find((x) => x.id === id) || { p: 0 }).p; f.p = clamp((f.p != null ? f.p : base) + (+d), 0, 100); if (f.p === 100) f.done = true; saveState(); },
  fdone: (a) => { const f = ST.follow[a] = ST.follow[a] || {}; f.done = !f.done; saveState(); },
  fAdd: () => { const t = field('fT'); if (!t) return; ST.newFollow.push({ id: 'nf' + Date.now(), x: t, p: 0, due: field('fD') || 'hoy', steps: [] }); saveState(); },
  appr: (a) => { const [id, v] = a.split('|'); if (v) ST.appr[id] = v; else delete ST.appr[id]; saveState(); },
  iPer: (a) => { UI.iPer = +a; }, iSel: (a) => { UI.iSel = UI.iSel === a ? null : a; ROUTE.sub = ''; },
  aPer: (a) => { UI.aPer = +a; },
  upd: (a) => { ST.upd[a] = !ST.upd[a]; saveState(); },
  cSort: (a) => { UI.cSort = a; }, cSel: (a) => { UI.cSel = a; ROUTE.sub = ''; },
  clCat: (a) => { UI.clCat = a; UI.clSel = 0; ROUTE.sub = ''; }, clSel: (a) => { UI.clSel = +a; },
  mode: (a) => { ST.settings.mode = a; saveState(); if (a === 'vivo') refreshWeather(); },
  wxReload: () => { refreshWeather(); },
  geoSearch: async () => { const q = field('geoQ'); if (!q) return; UI.geoMsg = 'Buscando…'; rerender(); try { UI.geo = await geocode(q); UI.geoMsg = UI.geo.length ? 'Toca un resultado' : 'Sin resultados'; } catch (e) { UI.geo = []; UI.geoMsg = 'No se pudo buscar (sin conexión)'; } rerender(); },
  geoPick: (a) => { const g = UI.geo[+a]; if (!g) return; Object.assign(ST.settings, { lat: g.lat, lon: g.lon, place: g.name, placeSrc: 'elegida', mode: 'vivo' }); UI.geo = []; UI.geoMsg = ''; saveState(); refreshWeather(); },
  geoMe: () => { if (!navigator.geolocation) { UI.geoMsg = 'Este navegador no da ubicación'; return; } UI.geoMsg = 'Pidiendo permiso…'; navigator.geolocation.getCurrentPosition((p) => { Object.assign(ST.settings, { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), place: 'Mi ubicación', placeSrc: 'GPS', mode: 'vivo' }); UI.geoMsg = ''; saveState(); refreshWeather(); }, (e) => { UI.geoMsg = 'Ubicación no disponible: ' + e.message; rerender(); }, { timeout: 10000, maximumAge: 600000 }); },
  reset: () => { resetState(); Object.assign(UI, { clDay: null, clH: null, dSel: null, mSel: 'm0', iSel: null }); refreshWeather(); }
};
async function refreshWeather() { if (ST.settings.mode !== 'vivo') { rerender(); return; } WX.status = 'loading'; rerender(); await loadLiveWeather(); rerender(); }

function trigger(el) {
  if (el.hasAttribute('data-act')) { const fn = ACTS[el.getAttribute('data-act')]; if (fn) { const r = fn(el.getAttribute('data-arg')); if (!(r && r.then)) rerender(); } return true; }
  if (el.hasAttribute('data-go')) { go(el.getAttribute('data-go')); return true; }
  return false;
}
$root.addEventListener('click', (ev) => {
  if (ev.target.closest('input,select,textarea,a[href]')) return;
  const el = ev.target.closest('[data-act],[data-go]');
  if (el && $root.contains(el)) { ev.preventDefault(); trigger(el); return; }
  const ro = ev.target.closest('[data-ro]'); if (ro) showRo(ro);
});
function showRo(el) { const box = el.closest('.cd'); if (!box) return; const t = box.querySelector('.ro'); if (t) t.textContent = el.getAttribute('data-ro'); box.querySelectorAll('[data-ro].on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); }
$root.addEventListener('pointerover', (ev) => { const ro = ev.target.closest('[data-ro]'); if (ro && ev.pointerType === 'mouse') showRo(ro); });
$root.addEventListener('keydown', (ev) => {
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[data-act],[data-go]')) { ev.preventDefault(); trigger(ev.target); }
  if (ev.key === 'Enter' && ev.target.matches('[data-f="geoQ"]')) ACTS.geoSearch();
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && ROUTE.v) go(''); });
const UNIT = { rainBad: '%', windBad: ' km/h', feelCold: '°', feelGlove: '°' };
$root.addEventListener('input', (ev) => { const k = ev.target.getAttribute('data-set'); if (!k || ev.target.type !== 'range') return; ST.settings[k] = +ev.target.value; const o = document.querySelector('[data-out="' + k + '"]'); if (o) o.textContent = ev.target.value + (UNIT[k] || ''); });
$root.addEventListener('change', (ev) => {
  const k = ev.target.getAttribute('data-set'); if (!k) return;
  let v = ev.target.value;
  if (ev.target.type === 'range' || ev.target.type === 'number') { v = +v; if (k === 'goal') v = clamp(v || 5000, 100, 1e7); }
  else if (ev.target.type === 'time' && !/^\d\d:\d\d$/.test(v)) return;
  ST.settings[k] = v;
  if (k === 'rainBad') ST.settings.rainWarn = Math.max(10, v - 20);
  if (k === 'windBad') ST.settings.windWarn = Math.max(8, v - 8);
  saveState(); rerender();
});
/* Reloj: en vivo se refresca cada 15 min el clima; el reloj de pantalla cada minuto */
loadState();
ROUTE = parseHash(); if (!VIEWS[ROUTE.v]) ROUTE = { v: '', sub: '' };
render();
if (ST.settings.mode === 'vivo') refreshWeather();
setInterval(() => { if (ST.settings.mode === 'vivo' && WX.live) { WX.live.nowMin += 1; if (WX.live.nowMin >= 1440) { WX.live.nowMin -= 1440; } WX.live.nowIdx = clamp(Math.floor(WX.live.nowIdx / 24) * 24 + Math.floor(WX.live.nowMin / 60), 0, WX.live.hourly.length - 1); if (!document.querySelector('#view input:focus,#view select:focus')) rerender(); } }, 60000);
setInterval(() => { if (ST.settings.mode === 'vivo') refreshWeather(); }, 15 * 60000);
