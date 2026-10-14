// Oro Janus 3D: wordmark vectorial (nítido a cualquier resolución, también 4K)
// con extrusión, bisel con iluminación especular real (SVG lighting), reflejo
// en el suelo y barrido de luz. Al tocar, la luz sigue al dedo y la pieza se
// ilumina — misma línea que los CTA y el sello de Infinity ChatBox, en oro.
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  for (const child of children) node.append(child);
  return node;
}

function stops(list) {
  return list.map(([offset, color]) => svgEl('stop', { offset, 'stop-color': color }));
}

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Activa el estado "iluminado" al tacto y escribe la posición del dedo en
 * --mx/--my (0..100 %) para brillos locales, como en Infinity ChatBox.
 */
export function bindLight(element, { onMove } = {}) {
  let release;
  const update = (event) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    element.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    element.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    element.style.setProperty('--tx', (x - 0.5).toFixed(3));
    element.style.setProperty('--ty', (y - 0.5).toFixed(3));
    onMove?.(x, y);
  };
  const light = (event) => {
    clearTimeout(release);
    element.dataset.lit = 'true';
    update(event);
  };
  const dim = () => {
    clearTimeout(release);
    release = setTimeout(() => { delete element.dataset.lit; }, 650);
  };
  element.addEventListener('pointerenter', light);
  element.addEventListener('pointerdown', light);
  element.addEventListener('pointermove', (event) => { if (element.dataset.lit) update(event); });
  element.addEventListener('pointerleave', dim);
  element.addEventListener('pointerup', dim);
  element.addEventListener('pointercancel', dim);
  return element;
}

export function createWordmark(text = 'JANUS') {
  const id = `jg${++uid}`;
  const W = 1000;
  const baseline = 214;
  const depth = 14;
  const fontSize = 212;
  const textAttrs = {
    x: W / 2,
    y: baseline,
    'text-anchor': 'middle',
    'font-family': 'Cinzel, "Trajan Pro", Georgia, serif',
    'font-weight': 900,
    'font-size': fontSize,
    'letter-spacing': 26,
  };

  const light = svgEl('fePointLight', { x: 180, y: -160, z: 260 });
  const defs = svgEl('defs', {}, [
    // Oro pulido: brillo superior, línea de horizonte reflejada y base profunda.
    svgEl('linearGradient', { id: `${id}-face`, x1: 0, y1: 0, x2: 0, y2: 1 }, stops([
      ['0', '#fffaf0'], ['.12', '#fde7a8'], ['.3', '#e6b75a'], ['.46', '#9a661f'],
      ['.5', '#5c3a0e'], ['.53', '#f7dc93'], ['.64', '#e3ae4f'], ['.82', '#b07a2c'], ['1', '#6e4512'],
    ])),
    svgEl('linearGradient', { id: `${id}-side`, x1: 0, y1: 0, x2: 0, y2: 1 }, stops([
      ['0', '#8a5a1c'], ['.5', '#4a2e0b'], ['1', '#1d1204'],
    ])),
    svgEl('linearGradient', { id: `${id}-sweep`, x1: 0, y1: 0, x2: 1, y2: 0 }, stops([
      ['0', 'rgba(255,255,255,0)'], ['.42', 'rgba(255,248,225,0)'], ['.5', 'rgba(255,252,240,.95)'],
      ['.58', 'rgba(255,240,200,0)'], ['1', 'rgba(255,255,255,0)'],
    ])),
    svgEl('linearGradient', { id: `${id}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }, stops([
      ['0', 'white'], ['.55', 'black'],
    ])),
    svgEl('mask', { id: `${id}-reflmask`, maskUnits: 'userSpaceOnUse', x: 0, y: baseline, width: W, height: 180 }, [
      svgEl('rect', { x: 0, y: baseline + depth, width: W, height: 160, fill: `url(#${id}-fade)` }),
    ]),
    svgEl('clipPath', { id: `${id}-clip` }, [svgEl('text', textAttrs, [document.createTextNode(text)])]),
    // Bisel con luz especular: el alfa difuminado actúa como relieve.
    svgEl('filter', { id: `${id}-bevel`, x: '-5%', y: '-20%', width: '110%', height: '140%', 'color-interpolation-filters': 'sRGB' }, [
      svgEl('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 3.2, result: 'b' }),
      svgEl('feSpecularLighting', { in: 'b', surfaceScale: 7, specularConstant: 1.25, specularExponent: 26, 'lighting-color': '#fff1c9', result: 's' }, [light]),
      svgEl('feComposite', { in: 's', in2: 'SourceAlpha', operator: 'in', result: 'si' }),
      svgEl('feComposite', { in: 'SourceGraphic', in2: 'si', operator: 'arithmetic', k1: 0, k2: 1, k3: .85, k4: 0 }),
    ]),
  ]);

  const extrusion = svgEl('g', { 'aria-hidden': 'true' });
  for (let i = depth; i >= 1; i -= 1) {
    extrusion.append(svgEl('text', { ...textAttrs, y: baseline + i, fill: `url(#${id}-side)` }, [document.createTextNode(text)]));
  }
  const face = svgEl('text', { ...textAttrs, fill: `url(#${id}-face)`, filter: `url(#${id}-bevel)`, stroke: '#fff2c6', 'stroke-opacity': .35, 'stroke-width': 1.2 }, [document.createTextNode(text)]);
  const sweep = svgEl('g', { 'clip-path': `url(#${id}-clip)`, class: 'jg-sweep-clip' }, [
    svgEl('rect', { class: 'jg-sweep', x: -400, y: 0, width: 400, height: baseline + 20, fill: `url(#${id}-sweep)` }),
  ]);
  const reflection = svgEl('g', { mask: `url(#${id}-reflmask)`, opacity: .32, 'aria-hidden': 'true' }, [
    svgEl('g', { transform: `translate(0 ${2 * baseline + depth + 4}) scale(1 -1)` }, [
      svgEl('text', { ...textAttrs, fill: `url(#${id}-face)` }, [document.createTextNode(text)]),
    ]),
  ]);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} 330`, class: 'jg-wordmark', role: 'img', 'aria-label': text }, [
    defs, reflection, extrusion, face, sweep,
  ]);

  const wrap = document.createElement('span');
  wrap.className = 'jg-wordmark-wrap';
  wrap.append(svg);

  // La luz especular sigue al dedo; en reposo recorre lentamente la pieza.
  const setLight = (x, y) => {
    light.setAttribute('x', String(Math.round(x * W)));
    light.setAttribute('y', String(Math.round(-120 + y * 200)));
  };
  bindLight(wrap, { onMove: setLight });
  if (!reduceMotion()) {
    let start;
    const idle = (time) => {
      start ??= time;
      if (!wrap.isConnected) return;
      if (!wrap.dataset.lit) {
        const t = ((time - start) / 9000) % 1;
        setLight(0.15 + 0.7 * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI)), 0.15);
      }
      requestAnimationFrame(idle);
    };
    requestAnimationFrame(idle);
  }
  return wrap;
}

/** Medallón oficial en alta resolución (derivado del master aprobado de 2048 px). */
export function createMedal({ solo = false } = {}) {
  const medal = document.createElement('figure');
  medal.className = `jd-medal${solo ? ' jd-medal-solo' : ''}`;
  medal.setAttribute('aria-hidden', 'true');
  const img = document.createElement('img');
  img.src = '/icons/janus-medal-1024.webp';
  img.alt = '';
  img.width = 1024;
  img.height = 1024;
  img.decoding = 'async';
  img.addEventListener('error', () => { img.src = '/icons/janus-icon-512.png'; }, { once: true });
  const halo = document.createElement('span');
  halo.className = 'jd-medal-halo';
  const axis = document.createElement('span');
  axis.className = 'jd-medal-axis';
  const sheen = document.createElement('span');
  sheen.className = 'jd-medal-sheen';
  const glint = document.createElement('span');
  glint.className = 'jd-medal-glint';
  medal.append(halo, img, sheen, glint, axis);
  return bindLight(medal);
}
