'use strict';
/* ===== Solicitudes y clientes de los productos (centralización en JANUS, orden del Founder 23-nov-2026) =====
 * Mismo patrón que casos.js: los datos llegan solo de GET /api/products/feed, con la sesión del Founder y JANUS
 * encendido; nunca se incrustan en el build ni se guardan en el navegador. Sin sesión, la franja no existe.
 * Solo lectura: aquí no hay ningún botón que escriba en IBA o ChatBox.
 */
const SOLI = { data: null, loading: false, err: '', sel: '', at: 0, ok: false };
const soliCore = () => { try { const m = document.querySelector('meta[name="janus-runtime"]'); return !!(m && m.content === 'core' && sessionStorage.getItem('janus.founder.session')); } catch (e) { return false; } };
const soliHeaders = () => { const h = { 'content-type': 'application/json' }; try { const t = sessionStorage.getItem('janus.founder.session'); if (t) h.authorization = 'Bearer ' + t; } catch (e) { } return h; };
const soliWhen = (isoText) => { const d = new Date(isoText); if (!isoText || isNaN(d)) return '—'; try { return d.toLocaleString('es-ES', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return String(isoText).slice(0, 16).replace('T', ' '); } };
async function soliLoad(force) {
  if (!soliCore()) { SOLI.data = null; SOLI.ok = false; return; }
  if (SOLI.loading || (!force && SOLI.ok && Date.now() - SOLI.at < 60000)) return;
  SOLI.loading = true;
  try {
    const res = await fetch('/api/products/feed' + (force ? '?refresh=1' : ''), { headers: soliHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    SOLI.data = await res.json(); SOLI.ok = true; SOLI.err = '';
  } catch (e) { SOLI.err = 'No se pudieron leer los productos (' + e.message + ').'; }
  SOLI.loading = false; SOLI.at = Date.now(); rerender();
}
const SOLI_STATE = { live: ['conectado', 'g'], stale: ['sin actualizar', 'r'], pending: ['conectando', ''], needs_auth: ['falta el token', 'r'], not_configured: ['sin configurar en el producto', 'r'], not_connected: ['sin conectar', ''], source_unavailable: ['no responde', 'r'], invalid_source: ['respuesta no válida', 'r'], feed_invalid: ['respuesta no válida', 'r'] };
const soliProducts = () => (SOLI.data && SOLI.data.products) || [];
const soliNew = () => soliProducts().flatMap((p) => p.requests.filter((r) => r.status === 'new').map((r) => Object.assign({ product: p.name }, r)));
const soliContactHref = (c) => /@/.test(c) ? 'mailto:' + c : 'tel:' + String(c).replace(/[^+0-9]/g, '');
const soliRow = (r) => '<div class="cspr new"><span class="cspt">' + esc(r.product) + '</span><b>' + esc(r.name || 'Sin nombre') + '</b><em>' + esc(soliWhen(r.createdAt)) + '</em></div>';

/** Franja «SOLICITUDES» dentro de la tarjeta Prioridades (escritorio/tablet). Vacía si no hay solicitudes nuevas. */
function soliStrip() {
  void soliLoad(false);
  const fresh = soliNew(); if (!fresh.length) return '';
  return '<div class="cspb go"' + goAttr('solicitudes', 'Solicitudes') + '><div class="csph mono"><i class="cspd"></i>SOLICITUDES NUEVAS<span>' + fresh.length + '</span></div>' + fresh.slice(0, 2).map(soliRow).join('') + '</div>';
}
/** Tarjeta para el teléfono. */
function soliPhoneCard() {
  void soliLoad(false);
  const fresh = soliNew(); if (!fresh.length) return '';
  return '<section class="a2c cspa2 go"' + goAttr('solicitudes', 'Solicitudes') + '><div class="csph mono"><i class="cspd"></i>SOLICITUDES NUEVAS<span>' + fresh.length + '</span></div>' + fresh.slice(0, 3).map(soliRow).join('') + '</section>';
}
function vSolicitudes(M, X, sub) {
  void soliLoad(false);
  const products = soliProducts();
  if (!products.length) return frame('solicitudes', sub, M, '<div class="col3">' + panel('', '📨', 'Solicitudes de los productos', 'privado', '<div class="dim">' + (soliCore() ? (SOLI.err ? esc(SOLI.err) : 'Cargando…') : 'Las solicitudes son privadas: solo se muestran con JANUS encendido y tu sesión iniciada.') + '</div>') + '</div>');
  const sel = products.find((p) => p.productId === SOLI.sel) || products.find((p) => p.newRequests) || products[0];
  const left = panel('', '🏢', 'Productos', products.length + '',
    '<div class="rdl">' + products.map((p) => { const st = SOLI_STATE[p.state] || [p.state, '']; return '<div class="rdo' + (p.productId === sel.productId ? ' on' : '') + '"' + act('soliSel', p.productId, p.name) + '><div class="rdo1">' + pill(st[0], st[1]) + (p.newRequests ? pill(p.newRequests + ' nuevas', 'r') : '') + '</div><div class="rdo2"><b>' + esc(p.name) + '</b></div><div class="rdo3 mono">' + (p.customers ? p.customers.total + ' clientes · ' + p.customers.active + ' activos · ' + p.customers.trial + ' en prueba' : 'sin datos de clientes') + '</div></div>'; }).join('') + '</div>' +
    '<div class="note mono">Total: ' + ((SOLI.data && SOLI.data.customers) || 0) + ' clientes en tus productos.</div>');
  const st = SOLI_STATE[sel.state] || [sel.state, ''];
  const center = panel('', '📨', 'Solicitudes', esc(sel.name),
    '<div class="kv">' + [['🚦', 'Conexión', st[0]], ['🕒', 'Última lectura', soliWhen(sel.lastSuccess)], ['👥', 'Clientes', sel.customers ? String(sel.customers.total) : '—']].map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>' +
    (sel.requests.length ? sel.requests.map((r) => '<div class="rdf"><div class="rdf1"><b class="mono">' + soliWhen(r.createdAt) + '</b>' + (r.status === 'new' ? pill('nueva', 'r') : pill(r.status === 'read' ? 'leída' : r.status === 'handled' ? 'atendida' : 'cerrada', '')) + '</div><div class="rdt"><b>' + esc(r.name || 'Sin nombre') + '</b>' + (r.contact ? ' · <a href="' + esc(soliContactHref(r.contact)) + '">' + esc(r.contact) + '</a>' : '') + '</div><div class="rdt">' + esc(r.message) + '</div></div>').join('') : '<div class="dim">No hay solicitudes en este producto.</div>') +
    '<div class="rdb"><span class="btn"' + act('soliRefresh', sel.productId, 'Comprobar ahora') + '>↻ Comprobar ahora</span>' + (sel.openUrl ? '<a class="btn" href="' + esc(sel.openUrl) + '" target="_blank" rel="noopener noreferrer">Abrir ' + esc(sel.name) + '</a>' : '') + '</div>' +
    '<div class="note mono">JANUS solo lee: no responde ni cambia nada en el producto.</div>' + (SOLI.err ? '<div class="note mono rdw">' + esc(SOLI.err) + '</div>' : ''));
  return frame('solicitudes', sub, M, '<div class="col3">' + left + '</div><div class="col3">' + center + '</div>');
}
VIEWS.solicitudes = vSolicitudes;
TABS.push(['solicitudes', '📨', 'Solicitudes']);
const SOLI_ACTS = {
  soliSel: (id) => { SOLI.sel = id; SOLI.err = ''; },
  soliRefresh: () => soliLoad(true),
};
