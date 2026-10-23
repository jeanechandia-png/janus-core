'use strict';
/* ===== Capa 3D: iconos grabados, profundidad, inclinación con el dedo/ratón y entrada escalonada ===== */
let LAST_VIEW = null;
function ensureDefs() {
  if (document.getElementById('jdefs')) return;
  const d = document.createElement('div');
  d.id = 'jdefs'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = '<svg width="0" height="0" style="position:absolute"><defs>' +
    '<linearGradient id="jg" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22"><stop offset="0" stop-color="#FFF6DA"/><stop offset=".45" stop-color="#F0CD86"/><stop offset="1" stop-color="#A8752A"/></linearGradient>' +
    '<linearGradient id="jgi" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9DCC0"/></linearGradient>' +
    // Metal: el trazo del icono se convierte en relieve de oro con luz especular y sombra de contacto.
    '<filter id="jmetal" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation=".6" result="b"/>' +
    '<feSpecularLighting in="b" surfaceScale="3.2" specularConstant="1.5" specularExponent="20" lighting-color="#fff4d6" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting>' +
    '<feComposite in="s" in2="SourceAlpha" operator="in" result="si"/>' +
    '<feComposite in="SourceGraphic" in2="si" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="lit"/>' +
    '<feOffset in="SourceAlpha" dy="1.1" result="o"/><feGaussianBlur in="o" stdDeviation=".5" result="ob"/>' +
    '<feFlood flood-color="#000" flood-opacity=".9"/><feComposite in2="ob" operator="in" result="sh"/>' +
    '<feMerge><feMergeNode in="sh"/><feMergeNode in="lit"/></feMerge></filter>' +
    '</defs></svg>';
  document.body.appendChild(d);
}
function decorate(viewId) {
  ensureDefs();
  const dash = document.getElementById('dash'), view = document.getElementById('view');
  iconize(view.hidden ? dash : view);
  if (skinNow() !== 'b') goldify(view.hidden ? dash : view); // el oro 3D es la piel A; B usa sus propios botones zafiro
  const isNew = viewId !== LAST_VIEW;
  LAST_VIEW = viewId;
  const host = view.hidden ? dash : view;
  host.querySelectorAll('.cd').forEach((c, i) => c.style.setProperty('--i', i));
  // La entrada en profundidad solo se reproduce al cambiar de vista, nunca en cada re-render.
  clearTimeout(decorate.t);
  if (isNew) { host.classList.remove('enter'); void host.offsetWidth; host.classList.add('enter'); decorate.t = setTimeout(() => host.classList.remove('enter'), 1400); }
  else host.classList.remove('enter');
}
// Inclinación 3D: el panel bajo el puntero gira unos grados y un reflejo sigue al dedo.
const TILT = { el: null, raf: 0, x: 0, y: 0 };
const REDUCED = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
function tiltReset(el) { if (!el) return; el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); el.classList.remove('tilt'); }
function tiltFrame() {
  TILT.raf = 0; const el = TILT.el; if (!el) return;
  const r = el.getBoundingClientRect(); if (!r.width) return;
  const px = clamp((TILT.x - r.left) / r.width, 0, 1), py = clamp((TILT.y - r.top) / r.height, 0, 1);
  const k = el.closest('#view') ? 3.2 : 1.6;
  el.style.setProperty('--rx', ((.5 - py) * k).toFixed(2) + 'deg');
  el.style.setProperty('--ry', ((px - .5) * k).toFixed(2) + 'deg');
  el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
  el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  el.classList.add('tilt');
}
if (!REDUCED) {
  document.addEventListener('pointermove', (ev) => {
    const el = ev.target.closest && ev.target.closest('#app .cd');
    if (el !== TILT.el) { tiltReset(TILT.el); TILT.el = el; }
    if (!el) return;
    TILT.x = ev.clientX; TILT.y = ev.clientY;
    if (!TILT.raf) TILT.raf = requestAnimationFrame(tiltFrame);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { tiltReset(TILT.el); TILT.el = null; });
  document.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'mouse') { tiltReset(TILT.el); TILT.el = null; } });
}

/* Oro 3D: asigna la anatomía de la pieza LEGO janus-gold a los elementos del dashboard */
const GOLD_MAP = [
  ['jg-cta', '.back,.ibtn.gold,.snd,.btn:not(.ghost),.seg .sg.on,.apb .btn:first-child'],
  ['jg-row', '.ibtn:not(.gold),.btn.ghost,.btn2,.sg2,.chip,.jp,.pjp,.stt,.ipj,.nt,.mini,.demo'],
  ['jg-coin', '.bb']
];
function goldify(host) {
  GOLD_MAP.forEach(([cls, sel]) => host.querySelectorAll(sel).forEach((n, i) => { n.classList.add(cls); if (!n.style.getPropertyValue('--gd')) n.style.setProperty('--gd', ((i * 0.37) % 6).toFixed(2) + 's'); }));
  JanusGold.hydrate(host);
  JanusGold.bindLit();
}
// Las letras 3D se miden con Cinzel: al terminar de cargar la tipografía se vuelve a pintar una vez.
try { if (document.fonts && document.fonts.load) document.fonts.load('900 40px Cinzel').then(() => setTimeout(() => { try { rerender(); } catch (e) { } }, 0)); } catch (e) { }
