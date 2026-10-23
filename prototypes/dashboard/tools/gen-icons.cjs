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
// Solo piel B: emojis sin trazo vectorial (en A se quedan tal cual). El valor es el nombre del medallón 3D en lego/janus-platino/assets/obj.
const PT_ONLY = {"🦊":"paw-print","📲":"smartphone-nfc","📷":"camera","💡":"lightbulb","✈":"plane","🎢":"ferris-wheel","🏨":"hotel","🚆":"train-front","🧮":"calculator","🔊":"volume-2","🔴":"dot-red","🟠":"dot-orange","🔵":"dot-blue","🟢":"dot-green","🟡":"dot-yellow"};
const out = {};
for (const [e, n] of Object.entries(MAP)) {
  const svg = fs.readFileSync(path.join(DIR, n + '.svg'), 'utf8');
  out[e] = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).replace(/\s*\n\s*/g, '').trim();
}
const keys = Object.keys(out).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const keysB = Object.keys(Object.assign({}, out, PT_ONLY)).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const js = `'use strict';
/* ===== Iconos vectoriales (Lucide, ISC) — generado por tools/gen-icons.cjs, no editar a mano ===== */
const ICONS = ${JSON.stringify(out)};
const ICON_RE = new RegExp('(' + ${JSON.stringify(keys.join('|'))} + ')\\\\uFE0F?', 'g');
// Iconos de OBJETO 3D hiperrealista (oro pulido + obsidiana, lego/janus-gold/assets/obj). Si no hay objeto, cae al trazo vectorial.
const EMO_OBJ = {'🚴':'bike','🤖':'bot','👁':'eye','🏫':'school','📚':'school','🎓':'school','💶':'euro','🎬':'clapperboard','🤝':'handshake','✉':'mail','📧':'mail','📩':'mail','🗓':'calendar-days','📅':'calendar-days','🔐':'lock','🎯':'target','📥':'inbox','🌟':'sparkles','🆕':'sparkles','🩺':'stethoscope','☔':'umbrella','🏖':'umbrella','⚙':'settings','☀':'sun','🛒':'shopping-cart','🛍':'shopping-cart','🎙':'mic','📁':'folder','🏷':'tag','❤':'heart','🤸':'dumbbell','🏃':'dumbbell','✈':'plane'};
// Piel B (Platino): TODOS los iconos son medallones 3D de platino + zafiro (lego/janus-platino/assets/obj, nombre = icono Lucide); el trazo vectorial solo queda como respaldo si falta el medallón.
const ICON_RE_B = new RegExp('(' + ${JSON.stringify(keysB.join('|'))} + ')\\\\uFE0F?', 'g');
const PT_ONLY = ${JSON.stringify(PT_ONLY)};
const EMO_PT = ${JSON.stringify(Object.assign({}, MAP, PT_ONLY))};
const ptSrc = (e) => (typeof GOLD !== 'undefined' && GOLD.p && GOLD.p[EMO_PT[e]]) || '';
const iconSvg = (e) => {
  const b = typeof skinNow === 'function' && skinNow() === 'b';
  if (!b && PT_ONLY[e]) return e;
  if (b && ptSrc(e)) return '<img class="pt3" data-e="' + e + '" src="' + ptSrc(e) + '" alt="" aria-hidden="true">';
  if (!b && typeof GOLD !== 'undefined' && GOLD.o && GOLD.o[EMO_OBJ[e]]) return '<img class="ji ji3" src="' + GOLD.o[EMO_OBJ[e]] + '" alt="" aria-hidden="true">';
  if (!ICONS[e]) return e;
  return '<svg class="ji" data-e="' + e + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[e] + '</svg>';
};
// Recorre los nodos de texto y cambia cada emoji conocido por su icono (los desconocidos se quedan).
function iconize(root) {
  if (!root) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentNode && /^(SCRIPT|STYLE|OPTION|TEXTAREA|text|tspan|title)$/.test(n.parentNode.nodeName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const RE = typeof skinNow === 'function' && skinNow() === 'b' ? ICON_RE_B : ICON_RE;
  const hits = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { RE.lastIndex = 0; if (RE.test(n.nodeValue)) hits.push(n); }
  hits.forEach((n) => {
    const span = document.createElement('span'); span.className = 'jiw';
    span.innerHTML = esc(n.nodeValue).replace(RE, (m, e) => iconSvg(e));
    const p = n.parentNode; if (span.childNodes.length === 1 && span.firstChild.nodeName === 'svg') p.replaceChild(span.firstChild, n);
    else p.replaceChild(span, n);
  });
}
`;
fs.writeFileSync(path.join(__dirname, '../src/icons.js'), js);
console.log('icons.js', Object.keys(out).length, 'iconos', (js.length / 1024).toFixed(0) + ' KB');
