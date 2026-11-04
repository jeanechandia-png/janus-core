'use strict';
/* ===== Adjuntos del teclado de Janus (host del LEGO janus-attach) =====
 * Botón «+» junto al teclado (hacer foto · subir foto · subir archivo · escanear QR), fichas de lo adjuntado, miniaturas en el
 * mensaje enviado y entrega al modelo. El módulo (lego/janus-attach) hace el trabajo; aquí solo se enchufa a los tres teclados
 * (teléfono A2, Sala y tablet A/B).
 * Qué se guarda: en el historial solo la miniatura y el nombre. Las fotos reducidas y el texto de los archivos viven en memoria
 * (ATT_MODEL) mientras la página está abierta; al recargar, el historial conserva la miniatura pero Janus ya no ve el contenido.
 * Qué sale de la página: nada hasta pulsar «enviar»; entonces va al modelo mediante la pasarela (JanusGateway) y a ningún otro sitio.
 * Los adjuntos son DATOS: el modelo recibe la orden de no obedecer instrucciones que vengan dentro de fotos, archivos o QR, y
 * la puerta de acciones sensibles (SENSITIVE) mira solo lo que Jean escribe, no el contenido adjunto.
 */
const ATT_MODEL = new WeakMap(); // mensaje → adjuntos completos del envío (blobs, texto); solo memoria
let ATT_LAST = null; // último «+» pulsado: hay varios en el DOM (teléfono + Sala) y el menú debe salir del que se ve
const attOk = () => typeof JanusAttach !== 'undefined';
document.addEventListener('pointerdown', (ev) => { const b = ev.target.closest && ev.target.closest('[data-act="attMenu"]'); if (b) ATT_LAST = b; }, true);

const attBtn = (cls) => attOk() ? '<span class="attp ' + (cls || '') + '"' + act('attMenu', '', 'Adjuntar: hacer foto, subir foto o archivo, escanear código QR') + ' aria-haspopup="menu">' + JanusAttach.svg('plus') + '</span>' : '';
const attSub = (x) => x.kind === 'image' ? 'foto · ' + JanusAttach.kb(x.size) : x.kind === 'qr' ? x.qr.label : x.kind === 'text' ? 'texto · ' + JanusAttach.kb(x.size) : JanusAttach.kb(x.size) + ' · solo nombre';
function attChipsInner() {
  if (!attOk()) return '';
  const it = JanusAttach.items(), n = JanusAttach.notice();
  return it.map((x) => '<span class="attch ' + x.kind + '" title="' + esc(x.name) + '">' + (x.kind === 'image' ? '<img src="' + x.thumb + '" alt="">' : '<span class="ic">' + JanusAttach.svg(x.kind === 'qr' ? 'qr' : 'file') + '</span>') +
    '<span class="t"><b>' + esc(x.name) + '</b><small>' + esc(attSub(x)) + '</small></span><span class="x"' + act('attDel', x.id, 'Quitar ' + x.name) + '>' + JanusAttach.svg('x') + '</span></span>').join('') +
    (n ? '<span class="attn ' + (n.kind === 'warn' ? 'warn' : '') + ' mono" role="status">' + esc(n.t) + '</span>' : '');
}
const attChips = () => '<div class="attc" data-att="chips" aria-live="polite">' + attChipsInner() + '</div>';
/** Actualiza las fichas en su sitio, sin redibujar el teclado (así no se pierde el foco ni lo que se está escribiendo). */
function attSync() { const h = attChipsInner(); document.querySelectorAll('[data-att="chips"]').forEach((el) => { el.innerHTML = h; }); }
if (attOk()) JanusAttach.onChange(attSync);

/** Miniaturas/fichas dentro del mensaje enviado (solo guarda miniatura y nombre). */
const attMsg = (m) => !m.att || !m.att.length ? '' : '<div class="matt">' + m.att.map((a) => a.k === 'image' && a.th ? '<img class="mth" src="' + a.th + '" alt="Foto adjunta: ' + esc(a.n) + '">' : '<span class="mchip">' + (attOk() ? JanusAttach.svg(a.k === 'qr' ? 'qr' : 'file') : '') + esc(a.n) + '</span>').join('') + '</div>';
const attBrief = (m) => m.att && m.att.length ? '📎 ' + m.att.length + (m.att.length === 1 ? ' adjunto' : ' adjuntos') + (m.t ? ' · ' : '') : '';

const ATT_ACTS = {
  attMenu: () => {
    if (!attOk()) return Promise.resolve();
    let a = ATT_LAST && document.contains(ATT_LAST) ? ATT_LAST : null;
    if (!a) a = Array.prototype.find.call(document.querySelectorAll('[data-act="attMenu"]'), (e) => e.getBoundingClientRect().width > 0) || null;
    JanusAttach.menu(a);
    return Promise.resolve(); // sin rerender: el panel flota fuera del escenario
  },
  attDel: (id) => { if (attOk()) JanusAttach.remove(id); return Promise.resolve(); }
};

/** Prepara lo que viaja al modelo con un envío: mensajes con el texto de los adjuntos + las fotos (solo las del turno actual). */
async function attModelParts(list) {
  const last = list[list.length - 1];
  const lim = attOk() && typeof JanusGateway !== 'undefined' ? await JanusGateway.imageLimits().catch(() => null) : null;
  const cur = last && ATT_MODEL.get(last), blobs = cur ? JanusAttach.images(cur) : [];
  const sendable = lim ? Math.min(lim.maxCount, blobs.length) : 0;
  const messages = list.slice(-14).filter((m) => m.t || (m.att && m.att.length)).map((m) => {
    const me = m.who === 'me', has = me && m.att && m.att.length, items = has ? ATT_MODEL.get(m) : null;
    let content = m.t || '';
    if (has && !m.t) content = '(Jean no escribió texto: solo envía los adjuntos. Dile brevemente qué ves o qué contienen y pregunta qué quiere hacer con ellos.)';
    if (items) content += JanusAttach.textFor(items, m === last ? { imagesSent: sendable } : { past: true });
    else if (has) content += '\n\n[Adjuntó: ' + m.att.map((a) => a.n).join(', ') + '. El contenido ya no está disponible.]';
    return { role: me ? 'user' : 'assistant', content };
  });
  return { messages, images: sendable ? blobs.slice(0, sendable) : [], asked: blobs.length };
}
/** Respuesta honesta cuando no hay modelo: dice qué llegó y qué no se puede hacer. */
function attOfflineNote(atts) {
  const q = atts.filter((x) => x.kind === 'qr');
  return 'Recibí ' + atts.length + (atts.length === 1 ? ' adjunto' : ' adjuntos') + ' (' + atts.map((x) => x.name).join(', ') + '), pero en esta vista sin modelo no puedo analizarlos.' +
    (q.length ? ' Del código QR, lo que dice es «' + q[0].text.slice(0, 160) + '»: es solo lo que declara el código, no está verificado y no lo he abierto.' : '') +
    ' Con el modelo conectado sí los reviso.';
}
