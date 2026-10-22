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
    '</defs></svg>';
  document.body.appendChild(d);
}
function decorate(viewId) {
  ensureDefs();
  const dash = document.getElementById('dash'), view = document.getElementById('view');
  iconize(view.hidden ? dash : view);
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
