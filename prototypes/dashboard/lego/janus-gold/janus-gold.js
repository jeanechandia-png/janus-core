/* ===== Pieza LEGO: janus-gold v1.0.0 =====
 * Oro Janus 3D hiperrealista (derivado del wordmark aprobado de la PWA, rama janus/dashboard-20261014):
 * letras mayúsculas vectoriales (nítidas en 4K) con extrusión, bisel con luz especular real (SVG lighting),
 * línea de horizonte reflejada, reflejo en el suelo y barrido de luz. La luz sigue al dedo; al tocar se ilumina.
 * Sin dependencias. API:
 *   JanusGold.wordmark(text, { depth, reflection }) -> <span class="jg-wordmark-wrap">
 *   JanusGold.hydrate(root)  -> convierte cada [data-jg="TEXTO"] en wordmark
 *   JanusGold.bindLit(root)  -> estado iluminado al tocar en .go/.btn/.bb/... (delegado, una vez)
 */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const el = (tag, attrs, kids) => { const n = document.createElementNS(NS, tag); for (const k in (attrs || {})) n.setAttribute(k, String(attrs[k])); (kids || []).forEach((c) => n.append(c)); return n; };
  const stops = (l) => l.map((s) => el('stop', { offset: s[0], 'stop-color': s[1] }));
  const FONT = 'Cinzel, "Trajan Pro", Georgia, serif';
  let ctx;
  function measure(text, size, spacing) {
    try { ctx = ctx || document.createElement('canvas').getContext('2d'); ctx.font = '900 ' + size + 'px ' + FONT; return ctx.measureText(text).width + spacing * Math.max(0, text.length - 1); }
    catch (e) { return text.length * size * .82; }
  }
  function wordmark(text, opt) {
    const o = opt || {}, id = 'jgw' + (++uid), size = 212, spacing = o.spacing != null ? o.spacing : 26, depth = o.depth != null ? o.depth : 14, base = 214;
    const tw = measure(text, size, spacing), W = Math.ceil(tw + 60), H = o.reflection === false ? base + depth + 26 : 330;
    const ta = { x: W / 2, y: base, 'text-anchor': 'middle', 'font-family': FONT, 'font-weight': 900, 'font-size': size, 'letter-spacing': spacing };
    const txt = () => document.createTextNode(text);
    const light = el('fePointLight', { x: 180, y: -160, z: 260 });
    const defs = el('defs', {}, [
      el('linearGradient', { id: id + 'f', x1: 0, y1: 0, x2: 0, y2: 1 }, stops([['0', '#fffaf0'], ['.12', '#fde7a8'], ['.3', '#e6b75a'], ['.46', '#9a661f'], ['.5', '#5c3a0e'], ['.53', '#f7dc93'], ['.64', '#e3ae4f'], ['.82', '#b07a2c'], ['1', '#6e4512']])),
      el('linearGradient', { id: id + 's', x1: 0, y1: 0, x2: 0, y2: 1 }, stops([['0', '#8a5a1c'], ['.5', '#4a2e0b'], ['1', '#1d1204']])),
      el('linearGradient', { id: id + 'w', x1: 0, y1: 0, x2: 1, y2: 0 }, stops([['0', 'rgba(255,255,255,0)'], ['.42', 'rgba(255,248,225,0)'], ['.5', 'rgba(255,252,240,.95)'], ['.58', 'rgba(255,240,200,0)'], ['1', 'rgba(255,255,255,0)']])),
      el('linearGradient', { id: id + 'd', x1: 0, y1: 0, x2: 0, y2: 1 }, stops([['0', 'white'], ['.55', 'black']])),
      el('mask', { id: id + 'm', maskUnits: 'userSpaceOnUse', x: 0, y: base, width: W, height: 180 }, [el('rect', { x: 0, y: base + depth, width: W, height: 160, fill: 'url(#' + id + 'd)' })]),
      el('clipPath', { id: id + 'c' }, [el('text', ta, [txt()])]),
      el('filter', { id: id + 'b', x: '-5%', y: '-20%', width: '110%', height: '140%', 'color-interpolation-filters': 'sRGB' }, [
        el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 3.2, result: 'b' }),
        el('feSpecularLighting', { in: 'b', surfaceScale: 7, specularConstant: 1.25, specularExponent: 26, 'lighting-color': '#fff1c9', result: 's' }, [light]),
        el('feComposite', { in: 's', in2: 'SourceAlpha', operator: 'in', result: 'si' }),
        el('feComposite', { in: 'SourceGraphic', in2: 'si', operator: 'arithmetic', k1: 0, k2: 1, k3: .85, k4: 0 })
      ])
    ]);
    const ext = el('g', { 'aria-hidden': 'true' });
    for (let i = depth; i >= 1; i--) ext.append(el('text', Object.assign({}, ta, { y: base + i, fill: 'url(#' + id + 's)' }), [txt()]));
    const face = el('text', Object.assign({}, ta, { fill: 'url(#' + id + 'f)', filter: 'url(#' + id + 'b)', stroke: '#fff2c6', 'stroke-opacity': .35, 'stroke-width': 1.2 }), [txt()]);
    const sweep = el('g', { 'clip-path': 'url(#' + id + 'c)' }, [el('rect', { class: 'jg-sweep', x: -400, y: 0, width: 400, height: base + 20, fill: 'url(#' + id + 'w)' })]);
    const kids = [defs];
    if (o.reflection !== false) kids.push(el('g', { mask: 'url(#' + id + 'm)', opacity: .32, 'aria-hidden': 'true' }, [el('g', { transform: 'translate(0 ' + (2 * base + depth + 4) + ') scale(1 -1)' }, [el('text', Object.assign({}, ta, { fill: 'url(#' + id + 'f)' }), [txt()])])]));
    kids.push(ext, face, sweep);
    const svg = el('svg', { viewBox: '0 26 ' + W + ' ' + (H - 26), class: 'jg-wordmark', role: 'img', 'aria-label': text, preserveAspectRatio: 'xMinYMid meet' }, kids);
    svg.style.setProperty('--sw', W + 400 + 'px');
    const wrap = document.createElement('span');
    wrap.className = 'jg-wordmark-wrap';
    wrap.style.setProperty('--ar', (W / (H - 26)).toFixed(3));
    wrap.append(svg);
    const setLight = (x, y) => { light.setAttribute('x', String(Math.round(x * W))); light.setAttribute('y', String(Math.round(-120 + y * 200))); };
    wrap.addEventListener('pointermove', (e) => { const r = wrap.getBoundingClientRect(); if (r.width) setLight((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); });
    if (!reduce()) {
      let t0 = null;
      const idle = (t) => { if (!wrap.isConnected && t0 !== null) return; t0 = t0 == null ? t : t0; if (!wrap.dataset.lit) { const k = ((t - t0) / 9000) % 1; setLight(.15 + .7 * (.5 - .5 * Math.cos(k * 2 * Math.PI)), .15); } requestAnimationFrame(idle); };
      requestAnimationFrame(idle);
    }
    return wrap;
  }
  function hydrate(rootEl) {
    (rootEl || document).querySelectorAll('[data-jg]').forEach((n) => {
      if (n.firstChild && n.firstChild.classList && n.firstChild.classList.contains('jg-wordmark-wrap')) return;
      const w = wordmark(n.getAttribute('data-jg').toUpperCase(), { reflection: n.hasAttribute('data-jg-refl'), depth: +(n.getAttribute('data-jg-depth') || 14) });
      n.textContent = ''; n.append(w);
    });
  }
  // Iluminación al tocar: delegada, sobrevive a los re-render.
  const LIT = '.go,.btn,.btn2,.bb,.ibtn,.tb2,.sg,.sg2,.snd,.mic,.back,.nt,.chip,.jp,.pjp,.pjr,.stt,.ipj,.ini-mic,.jg-wordmark-wrap,[data-act]';
  let bound = false;
  function bindLit() {
    if (bound) return; bound = true;
    let cur = null, rel = 0;
    const on = (e) => { const t = e.target.closest && e.target.closest(LIT); if (!t) return; if (cur && cur !== t) delete cur.dataset.lit; clearTimeout(rel); cur = t; t.dataset.lit = 'true'; const r = t.getBoundingClientRect(); if (r.width) { t.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); t.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); } };
    const off = () => { clearTimeout(rel); rel = setTimeout(() => { if (cur) { delete cur.dataset.lit; cur = null; } }, 650); };
    document.addEventListener('pointerdown', on, { passive: true });
    document.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') on(e); }, { passive: true });
    document.addEventListener('pointerup', off, { passive: true });
    document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && cur && !cur.contains(e.relatedTarget)) off(); }, { passive: true });
  }
  root.JanusGold = { version: '1.0.0', wordmark, hydrate, bindLit };
})(typeof window !== 'undefined' ? window : globalThis);
