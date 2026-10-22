'use strict';
// Genera src/icons.js: sustituye emojis por iconos vectoriales (Lucide, licencia ISC) grabados en oro.
// Uso: LUCIDE_DIR=<node_modules/lucide-static/icons> node tools/gen-icons.cjs
const fs = require('fs'), path = require('path');
const DIR = process.env.LUCIDE_DIR || path.join(__dirname, '../node_modules/lucide-static/icons');
const MAP = {
  '🚴': 'bike', '🤖': 'bot', '💧': 'droplet', '💦': 'droplets', '🏠': 'house', '🤸': 'dumbbell', '👁': 'eye', '🏢': 'building-2', '🏫': 'school',
  '💶': 'euro', '💨': 'wind', '📍': 'map-pin', '🎬': 'clapperboard', '🤝': 'handshake', '👧': 'baby', '✉': 'mail', '✅': 'circle-check',
  '🗓': 'calendar-days', '📅': 'calendar', '⏱': 'timer', '🔐': 'lock', '❤': 'heart', '🎯': 'target', '⚙': 'settings', '📈': 'chart-line',
  '🔎': 'search', '📌': 'pin', '📊': 'chart-column', '⏳': 'hourglass', '🧩': 'puzzle', '📥': 'inbox', '🌟': 'sparkles', '🌡': 'thermometer',
  '🧥': 'shirt', '📝': 'notebook-pen', '☔': 'umbrella', '🩺': 'stethoscope', '💾': 'save', '🧭': 'compass', '📱': 'smartphone',
  '💬': 'message-circle', '🌐': 'globe', '🎨': 'palette', '☝': 'pointer', '🕐': 'clock', '⚡': 'zap', '☀': 'sun', '☁': 'cloud', '🧤': 'hand',
  '🌦': 'cloud-sun', '🚦': 'traffic-cone', '⚠': 'triangle-alert', '🏃': 'footprints', '🌿': 'leaf', '🧠': 'brain', '🧪': 'flask-conical',
  '🛡': 'shield', '🏆': 'trophy', '🚁': 'plane-takeoff', '🛈': 'info', '🎚': 'sliders-horizontal', '🗑': 'trash-2', '🏖': 'umbrella',
  '📖': 'book-open', '🔌': 'plug', '✋': 'hand', '📜': 'scroll', '💻': 'laptop', '🧾': 'receipt', '⚖': 'scale', '➕': 'plus', '👥': 'users',
  '🙋': 'hand-helping', '📡': 'radio', '🔖': 'bookmark', '🏁': 'flag', '⚑': 'flag', '📩': 'mail-plus', '⏭': 'skip-forward', '☎': 'phone', '📞': 'phone',
  '🆕': 'sparkles', '🍽': 'utensils', '🛒': 'shopping-cart', '✂': 'scissors', '🎒': 'backpack', '👟': 'footprints', '🍎': 'apple', '🚌': 'bus',
  '📚': 'graduation-cap', '🎄': 'tree-pine', '⛷': 'mountain-snow', '🏊': 'waves', '🔁': 'repeat', '🐙': 'github', '📧': 'mail', '🔗': 'link',
  '📘': 'book', '🎵': 'music', '🛟': 'life-buoy', '📄': 'file-text', '🧊': 'snowflake', '🕶': 'glasses', '🧣': 'snowflake', '🔦': 'flashlight',
  '🛍': 'shopping-bag', '🥧': 'chart-pie', '🦷': 'smile', '🐝': 'bug', '↺': 'rotate-ccw', '↻': 'rotate-cw', '🖐': 'hand', '👨‍👩‍👧': 'users', '🔻': 'filter', '➡': 'arrow-right', '🔺': 'triangle', '🎙': 'mic', '📁': 'folder', '⌨': 'keyboard', '🏷': 'tag', '➤': 'send-horizontal'
};
const out = {};
for (const [e, n] of Object.entries(MAP)) {
  const svg = fs.readFileSync(path.join(DIR, n + '.svg'), 'utf8');
  out[e] = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/\s*\n\s*/g, '').trim();
}
const keys = Object.keys(out).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const js = `'use strict';
/* ===== Iconos vectoriales (Lucide, ISC) — generado por tools/gen-icons.cjs, no editar a mano ===== */
const ICONS = ${JSON.stringify(out)};
const ICON_RE = new RegExp('(' + ${JSON.stringify(keys.join('|'))} + ')\\\\uFE0F?', 'g');
const iconSvg = (e) => '<svg class="ji" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[e] + '</svg>';
// Recorre los nodos de texto y cambia cada emoji conocido por su icono (los desconocidos se quedan).
function iconize(root) {
  if (!root) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA|text|tspan|title)$/.test(n.parentNode.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const hits = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { ICON_RE.lastIndex = 0; if (ICON_RE.test(n.nodeValue)) hits.push(n); }
  hits.forEach((n) => {
    const span = document.createElement('span'); span.className = 'jiw';
    span.innerHTML = esc(n.nodeValue).replace(ICON_RE, (m, e) => iconSvg(e));
    const p = n.parentNode; if (span.childNodes.length === 1 && span.firstChild.nodeName === 'svg') p.replaceChild(span.firstChild, n);
    else p.replaceChild(span, n);
  });
}
`;
fs.writeFileSync(path.join(__dirname, '../src/icons.js'), js);
console.log('icons.js', Object.keys(out).length, 'iconos', (js.length / 1024).toFixed(0) + ' KB');
