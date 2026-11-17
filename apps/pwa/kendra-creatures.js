/**
 * Criaturas de la app de la niña (módulo `companion`: Lumi, Bombo, Musgo, Nimbo).
 *
 * Ilustraciones PROPIAS, dibujadas con formas simples; no copian a ningún personaje existente ni a ninguna marca.
 * Son criaturas (zorrita-polilla, ajolote-nutria, piedrita de musgo, nubecita), NO robots: el robot es del dashboard del
 * Founder. Se construyen con createElementNS (nada de innerHTML) y no llevan texto variable.
 *
 * Animación y gestos van en kendra.css (parpadeo, flotar, antenas, branquias, luciérnaga, chispas, `is-cheer`).
 */
const NS = 'http://www.w3.org/2000/svg';
const INK = '#2a2140';
const BLUSH = '#ff8fa8';

function s(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  for (const kid of kids.flat()) if (kid) node.append(kid);
  return node;
}

/** Cara común: ojos con brillo (parpadean), mejillas, boca contenta y boca de fiesta (se alterna con la clase is-cheer). */
function face(cx, cy, { gap = 13, eye = 5.4, mouthY = 11 } = {}) {
  const eyeAt = (x) => s('g', { class: 'eye' },
    s('ellipse', { cx: x, cy, rx: eye, ry: eye * 1.25, fill: INK }),
    s('circle', { cx: x + eye * 0.35, cy: cy - eye * 0.45, r: eye * 0.38, fill: '#fff' }));
  return s('g', { class: 'face' },
    eyeAt(cx - gap), eyeAt(cx + gap),
    s('ellipse', { cx: cx - gap - 7, cy: cy + 9, rx: 5, ry: 3.2, fill: BLUSH, opacity: 0.55 }),
    s('ellipse', { cx: cx + gap + 7, cy: cy + 9, rx: 5, ry: 3.2, fill: BLUSH, opacity: 0.55 }),
    s('path', { class: 'mouth-happy', d: `M${cx - 6} ${cy + mouthY} q6 6 12 0`, fill: 'none', stroke: INK, 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
    s('g', { class: 'mouth-cheer' },
      s('path', { d: `M${cx - 8} ${cy + mouthY - 1} q8 15 16 0 z`, fill: '#7a2a3a' }),
      s('path', { d: `M${cx - 4} ${cy + mouthY + 5.5} q4 -3.5 8 0 q-4 4 -8 0 z`, fill: BLUSH })));
}

function spark(x, y, fill, cls = 'spark') {
  return s('path', {
    class: cls, fill, stroke: '#e0b13a', 'stroke-width': 0.6, 'stroke-linejoin': 'round',
    d: `M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8} Z`
  });
}

// ── Lumi: zorrita-polilla (orejas de zorra, antenas que brillan, alitas de polilla) ─────────────────────────────
function lumi({ primary, glow }) {
  return [
    s('ellipse', { cx: 22, cy: 72, rx: 15, ry: 25, fill: glow, opacity: 0.5, transform: 'rotate(-25 22 72)' }),
    s('ellipse', { cx: 98, cy: 72, rx: 15, ry: 25, fill: glow, opacity: 0.5, transform: 'rotate(25 98 72)' }),
    s('g', { class: 'tail wag' },
      s('path', { d: 'M82 100 C114 106 120 72 102 56 C101 74 94 86 78 88 Z', fill: primary }),
      s('path', { d: 'M102 56 C109 63 111 71 109 78 C104 72 102 66 102 56 Z', fill: '#fff', opacity: 0.75 })),
    s('ellipse', { cx: 60, cy: 90, rx: 26, ry: 22, fill: primary }),
    s('ellipse', { cx: 60, cy: 94, rx: 15, ry: 13, fill: '#fff', opacity: 0.6 }),
    s('ellipse', { cx: 46, cy: 110, rx: 9, ry: 5, fill: primary }),
    s('ellipse', { cx: 74, cy: 110, rx: 9, ry: 5, fill: primary }),
    s('path', { d: 'M30 46 L24 12 L54 30 Z', fill: primary }),
    s('path', { d: 'M33 39 L30 22 L46 31 Z', fill: '#f7b6d2' }),
    s('path', { d: 'M90 46 L96 12 L66 30 Z', fill: primary }),
    s('path', { d: 'M87 39 L90 22 L74 31 Z', fill: '#f7b6d2' }),
    s('g', { class: 'antenna antenna-l' },
      s('path', { d: 'M52 28 Q45 14 38 9', fill: 'none', stroke: primary, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      s('circle', { cx: 38, cy: 9, r: 4.6, fill: glow }), s('circle', { cx: 38, cy: 9, r: 8, fill: glow, opacity: 0.25 })),
    s('g', { class: 'antenna antenna-r' },
      s('path', { d: 'M68 28 Q75 14 82 9', fill: 'none', stroke: primary, 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
      s('circle', { cx: 82, cy: 9, r: 4.6, fill: glow }), s('circle', { cx: 82, cy: 9, r: 8, fill: glow, opacity: 0.25 })),
    s('ellipse', { cx: 60, cy: 56, rx: 34, ry: 30, fill: primary }),
    s('ellipse', { cx: 60, cy: 66, rx: 18, ry: 12, fill: '#fff', opacity: 0.5 }),
    face(60, 54, { gap: 14, eye: 5.4, mouthY: 12 }),
    s('ellipse', { cx: 60, cy: 60, rx: 2.8, ry: 2.1, fill: '#7a4a6a' })
  ];
}

// ── Bombo: ajolote-nutria (branquias de colores, sonrisa enorme, cola de remo) ─────────────────────────────────
function bombo({ primary, glow }) {
  const gillDark = '#2fc7b4';
  const gill = (cx, angle, ox) => s('ellipse', {
    cx, cy: 56, rx: 12, ry: 4.6, fill: glow, stroke: gillDark, 'stroke-width': 1, transform: `rotate(${angle} ${ox} 56)`
  });
  return [
    s('g', { class: 'gills gills-l' }, gill(14, -38, 26), gill(12, 0, 26), gill(14, 38, 26)),
    s('g', { class: 'gills gills-r' }, gill(106, 38, 94), gill(108, 0, 94), gill(106, -38, 94)),
    s('ellipse', { class: 'tail', cx: 98, cy: 98, rx: 15, ry: 8, fill: primary, transform: 'rotate(-20 98 98)' }),
    s('ellipse', { cx: 60, cy: 90, rx: 30, ry: 23, fill: primary }),
    s('ellipse', { cx: 60, cy: 95, rx: 18, ry: 13, fill: '#ffd6cc' }),
    s('ellipse', { cx: 33, cy: 96, rx: 7, ry: 5, fill: primary }),
    s('ellipse', { cx: 87, cy: 96, rx: 7, ry: 5, fill: primary }),
    s('ellipse', { cx: 44, cy: 112, rx: 11, ry: 6, fill: primary }),
    s('ellipse', { cx: 76, cy: 112, rx: 11, ry: 6, fill: primary }),
    s('ellipse', { cx: 60, cy: 56, rx: 38, ry: 30, fill: primary }),
    s('circle', { cx: 40, cy: 40, r: 2.6, fill: '#f27f6a', opacity: 0.6 }),
    s('circle', { cx: 82, cy: 38, r: 2.2, fill: '#f27f6a', opacity: 0.6 }),
    s('circle', { cx: 70, cy: 31, r: 1.8, fill: '#f27f6a', opacity: 0.6 }),
    face(60, 54, { gap: 16, eye: 5.8, mouthY: 10 })
  ];
}

// ── Musgo: piedrita de musgo (calmada, con musgo y una flor en la cabeza y una luciérnaga amiga) ────────────────
function musgo({ primary, glow }) {
  const stone = '#b9b6aa';
  const mossDark = '#6e9e3f';
  return [
    s('ellipse', { cx: 42, cy: 108, rx: 10, ry: 5, fill: '#9c998d' }),
    s('ellipse', { cx: 78, cy: 108, rx: 10, ry: 5, fill: '#9c998d' }),
    s('path', { d: 'M18 84 C16 52 36 34 60 34 C84 34 104 52 102 84 C101 100 86 108 60 108 C34 108 19 100 18 84 Z', fill: stone }),
    s('ellipse', { cx: 36, cy: 58, rx: 10, ry: 5, fill: '#d5d2c6', opacity: 0.7, transform: 'rotate(-30 36 58)' }),
    s('g', { class: 'moss' },
      s('circle', { cx: 38, cy: 42, r: 10, fill: primary }), s('circle', { cx: 52, cy: 34, r: 12, fill: primary }),
      s('circle', { cx: 68, cy: 34, r: 11, fill: primary }), s('circle', { cx: 82, cy: 42, r: 10, fill: primary }),
      s('circle', { cx: 60, cy: 42, r: 8, fill: mossDark, opacity: 0.55 }),
      s('circle', { cx: 46, cy: 30, r: 4, fill: '#b5db84' }), s('circle', { cx: 74, cy: 30, r: 3.4, fill: '#b5db84' })),
    s('g', { class: 'flower' },
      s('circle', { cx: 60, cy: 17, r: 3.2, fill: '#ffb8d2' }), s('circle', { cx: 65, cy: 22, r: 3.2, fill: '#ffb8d2' }),
      s('circle', { cx: 60, cy: 27, r: 3.2, fill: '#ffb8d2' }), s('circle', { cx: 55, cy: 22, r: 3.2, fill: '#ffb8d2' }),
      s('circle', { cx: 60, cy: 22, r: 2.8, fill: '#ffd27a' })),
    face(60, 72, { gap: 15, eye: 5.6, mouthY: 10 }),
    s('g', { class: 'firefly' },
      s('circle', { class: 'halo', cx: 100, cy: 36, r: 11, fill: glow, opacity: 0.35 }),
      s('ellipse', { cx: 96.5, cy: 32.5, rx: 4.5, ry: 2.4, fill: '#fff', opacity: 0.75, transform: 'rotate(-30 96.5 32.5)' }),
      s('ellipse', { cx: 103.5, cy: 32.5, rx: 4.5, ry: 2.4, fill: '#fff', opacity: 0.75, transform: 'rotate(30 103.5 32.5)' }),
      s('ellipse', { cx: 100, cy: 37, rx: 3.4, ry: 4.4, fill: glow }))
  ];
}

// ── Nimbo: nubecita con arcoíris y chispas ────────────────────────────────────────────────────────────────────
function nimbo({ primary, glow }) {
  return [
    s('path', { d: 'M22 62 A38 38 0 0 1 98 62', fill: 'none', stroke: '#ff9aa2', 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
    s('path', { d: 'M28 62 A32 32 0 0 1 92 62', fill: 'none', stroke: '#ffe08a', 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
    s('path', { d: 'M34 62 A26 26 0 0 1 86 62', fill: 'none', stroke: '#9ad9ff', 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
    s('g', { class: 'cloud', fill: primary },
      s('rect', { x: 22, y: 80, width: 82, height: 28, rx: 14 }),
      s('circle', { cx: 36, cy: 80, r: 20 }), s('circle', { cx: 58, cy: 64, r: 27 }),
      s('circle', { cx: 84, cy: 73, r: 22 }), s('circle', { cx: 98, cy: 90, r: 14 })),
    s('ellipse', { cx: 50, cy: 52, rx: 15, ry: 7, fill: '#fff', opacity: 0.55, transform: 'rotate(-18 50 52)' }),
    s('ellipse', { cx: 18, cy: 96, rx: 7, ry: 5, fill: primary }),
    s('ellipse', { cx: 104, cy: 96, rx: 7, ry: 5, fill: primary }),
    face(60, 80, { gap: 14, eye: 5.2, mouthY: 9 }),
    spark(14, 40, glow), spark(106, 30, glow, 'spark spark-b'), spark(96, 12, glow, 'spark spark-c')
  ];
}

const DRAW = { lumi, bombo, musgo, nimbo };
const DEFAULT_PALETTE = {
  lumi: { primary: '#C9B6E8', glow: '#FFD27A' },
  bombo: { primary: '#FF9E8A', glow: '#6FF2E0' },
  musgo: { primary: '#8FBF5A', glow: '#FFE07A' },
  nimbo: { primary: '#FFD9B8', glow: '#FFF1A8' }
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (value, fallback) => (typeof value === 'string' && HEX.test(value) ? value : fallback);

export const CREATURE_IDS = Object.keys(DRAW);

/** Devuelve el <svg> de una criatura. `id` desconocido → Lumi con la paleta dada (nunca un robot ni un hueco). */
export function creatureSvg(id, { primary, glow } = {}) {
  const key = Object.hasOwn(DRAW, id) ? id : 'lumi';
  const palette = DEFAULT_PALETTE[key];
  const parts = DRAW[key]({ primary: safeColor(primary, palette.primary), glow: safeColor(glow, palette.glow) });
  return s('svg', { class: 'creature-svg', viewBox: '0 0 120 120', 'aria-hidden': 'true', focusable: 'false', 'data-creature': key }, ...parts);
}
