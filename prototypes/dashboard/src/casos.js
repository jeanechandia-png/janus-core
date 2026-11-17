'use strict';
/* ===== Casos prioritarios del Founder (privados) =====
 * Este archivo NO contiene ningún caso. Los datos llegan solo de GET /api/cases, con la sesión del Founder, desde el
 * JANUS encendido; nunca se incrustan en el build ni se guardan en el navegador. Sin sesión, la tarjeta no existe.
 * JANUS solo lee el correo: aquí no hay ningún botón que envíe o responda nada.
 */
const CASOS = { list: [], meta: null, loading: false, err: '', sel: null, at: 0, ok: false };
const casosCore = () => { try { const m = document.querySelector('meta[name="janus-runtime"]'); return !!(m && m.content === 'core' && sessionStorage.getItem('janus.founder.session')); } catch (e) { return false; } };
const casosHeaders = () => { const h = { 'content-type': 'application/json' }; try { const t = sessionStorage.getItem('janus.founder.session'); if (t) h.authorization = 'Bearer ' + t; } catch (e) { } return h; };
const casosWhen = (isoText) => { const d = new Date(isoText); if (!isoText || isNaN(d)) return '—'; try { return d.toLocaleString('es-ES', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return String(isoText).slice(0, 16).replace('T', ' '); } };
async function casosLoad(force) {
  if (!casosCore()) { CASOS.list = []; CASOS.ok = false; return; }
  if (CASOS.loading || (!force && CASOS.ok && Date.now() - CASOS.at < 60000)) return;
  CASOS.loading = true;
  try {
    const res = await fetch('/api/cases', { headers: casosHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json(); CASOS.list = data.cases || []; CASOS.meta = data; CASOS.ok = true; CASOS.err = '';
  } catch (e) { CASOS.err = 'No se pudieron leer los casos (' + e.message + ').'; }
  CASOS.loading = false; CASOS.at = Date.now(); rerender();
}
async function casosSend(method, path, body) {
  try {
    const res = await fetch(path, { method, headers: casosHeaders(), body: JSON.stringify(body || {}), cache: 'no-store' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
    CASOS.err = ''; await casosLoad(true);
  } catch (e) { CASOS.err = e.message; rerender(); }
}
const CASO_MON = { active: ['Monitorización activa', 'g'], connection_pending: ['Conexión pendiente', ''], error: ['Error de conexión', 'r'] };
const CASO_SIG = { reply: 'respuesta', appointment: 'cita', deadline: 'plazo', documents: 'documentación', important: 'cambio importante' };
const casoOpen = () => CASOS.list.filter((c) => c.status !== 'closed');

/** Franja «CASOS PRIORITARIOS» dentro de la tarjeta Prioridades (escritorio/tablet). Vacía si no hay casos. */
function casosStrip() {
  void casosLoad(false);
  const open = casoOpen(); if (!open.length) return '';
  return '<div class="cspb go"' + goAttr('casos', 'Casos prioritarios') + '><div class="csph mono"><i class="cspd"></i>CASOS PRIORITARIOS<span>' + open.length + '</span></div>' +
    open.slice(0, 2).map((c) => '<div class="cspr' + (c.pendingAlerts ? ' new' : '') + '"><span class="cspt">' + (c.priority === 'high' ? 'ALTA' : 'NORMAL') + '</span><b>' + esc(c.title) + '</b><em>' + esc(c.pendingAlerts ? c.pendingAlerts + ' novedad' + (c.pendingAlerts > 1 ? 'es' : '') : c.statusLabel) + '</em></div>').join('') + '</div>';
}
/** Tarjeta para el teléfono. */
function casosPhoneCard() {
  void casosLoad(false);
  const open = casoOpen(); if (!open.length) return '';
  return '<section class="a2c cspa2 go"' + goAttr('casos', 'Casos prioritarios') + '><div class="csph mono"><i class="cspd"></i>CASOS PRIORITARIOS<span>' + open.length + '</span></div>' +
    open.slice(0, 3).map((c) => '<div class="cspr' + (c.pendingAlerts ? ' new' : '') + '"><span class="cspt">' + (c.priority === 'high' ? 'ALTA' : 'NORMAL') + '</span><b>' + esc(c.title) + '</b><em>' + esc(c.pendingAlerts ? c.pendingAlerts + ' novedad' + (c.pendingAlerts > 1 ? 'es' : '') : c.statusLabel) + '</em></div>').join('') + '</section>';
}
function vCasos(M, X, sub) {
  void casosLoad(false);
  const list = CASOS.list, sel = list.find((c) => c.id === CASOS.sel) || list[0];
  if (!sel) return frame('casos', sub, M, '<div class="col3">' + panel('', '🔒', 'Casos prioritarios', 'privado', '<div class="dim">' + (casosCore() ? (CASOS.err ? esc(CASOS.err) : 'No hay casos abiertos.') : 'Los casos son privados: solo se muestran con JANUS encendido y tu sesión iniciada.') + '</div>') + '</div>');
  const mon = CASO_MON[sel.monitoring.state] || CASO_MON.connection_pending;
  const left = panel('', '🔒', 'Casos prioritarios', list.length + '',
    '<div class="rdl">' + list.map((c) => '<div class="rdo' + (c.id === sel.id ? ' on' : '') + (c.status === 'closed' ? ' past' : '') + '"' + act('casoSel', c.id, c.title) + '><div class="rdo1">' + pill(c.priority === 'high' ? 'prioridad ALTA' : 'prioridad normal', c.priority === 'high' ? 'r' : '') + (c.pendingAlerts ? pill(c.pendingAlerts + ' novedades', 'r') : '') + '</div><div class="rdo2"><b>' + esc(c.title) + '</b></div><div class="rdo3 mono">' + esc(c.statusLabel) + '</div></div>').join('') + '</div>' +
    '<div class="note mono">Privado: solo tú. ' + (CASOS.meta && CASOS.meta.encryptedAtRest ? 'Guardado cifrado en JANUS.' : 'Atención: sin clave de bóveda, se guarda sin cifrar.') + '</div>');
  const alerts = (sel.alerts || []).filter((a) => !a.acknowledgedAt);
  const na = sel.nextAction;
  const center = panel('', '📌', 'Estado', esc(sel.category),
    '<div class="rdh"><b class="serif big2">' + esc(sel.title) + '</b></div>' +
    '<div class="kv">' + [['🚦', 'Estado', esc(sel.statusLabel)], ['🕒', 'Última actualización', casosWhen(sel.updatedAt)], ['📡', 'Vigilancia de Gmail', mon[0] + (sel.monitoring.lastCheckedAt ? ' · ' + casosWhen(sel.monitoring.lastCheckedAt) : '')], sel.thread ? ['👤', 'Destinataria', esc(sel.thread.counterpart.name || sel.thread.counterpart.email)] : null, sel.thread ? ['✉', 'Enviado', casosWhen(sel.thread.sentAt)] : null].filter(Boolean).map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>' +
    (sel.monitoring.state !== 'active' && sel.monitoring.detail ? '<div class="note mono rdw">' + esc(sel.monitoring.detail) + '</div>' : '') +
    (sel.thread ? '<div class="sb mono">Asunto</div><div class="rdt">' + esc(sel.thread.subject) + '</div>' : '') +
    (sel.context ? '<div class="sb mono">Contexto</div><div class="rdt">' + esc(sel.context) + '</div>' : '') +
    (alerts.length ? '<div class="sb mono">Alertas</div>' + alerts.map((a) => '<div class="rdi"><span class="bb s">⚠</span><span>' + esc(a.text) + ' · ' + casosWhen(a.at) + '</span><span class="btn"' + act('casoAck', sel.id + '|' + a.key, 'Marcar vista') + '>Visto</span></div>').join('') : '') +
    (na ? '<div class="sb mono">Próxima acción recomendada</div><div class="rdt">' + esc(na.text) + '</div><div class="rdb">' + (na.state === 'pending_approval' ? '<span class="btn"' + act('casoNext', sel.id + '|approved', 'Aprobar') + '>✔ Aprobar</span><span class="btn"' + act('casoNext', sel.id + '|dismissed', 'Descartar') + '>Descartar</span>' : na.state === 'approved' ? pill('aprobada por ti', 'g') + '<span class="btn"' + act('casoNext', sel.id + '|done', 'Marcar hecha') + '>Marcar hecha</span>' : pill(na.state === 'done' ? 'hecha' : 'descartada', '')) + '</div>' : '') +
    (sel.interpreter && sel.interpreter.ready ? '<div class="sb mono">Llamada con intérprete</div><div class="rdb"><span class="btn"' + act('casoInterp', sel.id, 'Abrir modo intérprete') + '>🎧 Modo intérprete ES ↔ NL</span></div><div class="note mono">JANUS ha estudiado el expediente (' + sel.interpreter.briefChars + ' caracteres' + (sel.interpreter.glossaryTerms ? ', ' + sel.interpreter.glossaryTerms + ' términos propios' : '') + '). Piloto de Infinity Connect.</div>' : '') +
    '<div class="rdb">' + (sel.gmailUrl ? '<a class="btn" href="' + esc(sel.gmailUrl) + '" target="_blank" rel="noopener noreferrer">✉ Abrir el correo en Gmail</a>' : '') + '<span class="btn"' + act('casoCheck', sel.id, 'Comprobar Gmail ahora') + '>↻ Comprobar ahora</span></div>' +
    '<div class="note mono">JANUS solo lee: no responde ni envía correos por ti.</div>' + (CASOS.err ? '<div class="note mono rdw">' + esc(CASOS.err) + '</div>' : ''));
  const right = panel('', '🧾', 'Historial', (sel.timeline || []).length + ' entradas',
    (sel.timeline || []).map((e) => '<div class="rdf"><div class="rdf1"><b class="mono">' + casosWhen(e.at) + '</b>' + (e.signals || []).filter((s) => s !== 'reply').map((s) => pill(CASO_SIG[s] || s, 'r')).join('') + '</div><div class="rdt">' + esc(e.summary) + (e.from ? ' · ' + esc(e.from) : '') + '</div>' +
      (e.original ? '<div class="rdt dim">«' + esc(e.original) + '»</div>' + (e.translation ? '<div class="rdt">ES: ' + esc(e.translation) + '</div>' : '<div class="rdb"><span class="btn"' + act('casoTr', sel.id + '|' + e.id, 'Traducir al español') + '>Traducir al español</span></div>') : '') + '</div>').join('') +
    '<div class="rdb"><input class="csin" id="caso-note" type="text" maxlength="500" placeholder="Añadir una nota al historial" aria-label="Nota"><span class="btn"' + act('casoNote', sel.id, 'Guardar nota') + '>Guardar</span></div>');
  return frame('casos', sub, M, '<div class="col3">' + left + '</div><div class="col3">' + center + '</div><div class="col3">' + right + '</div>');
}
VIEWS.casos = vCasos;
TABS.push(['casos', '🔒', 'Casos']);
const CASOS_ACTS = {
  casoSel: (id) => { CASOS.sel = id; CASOS.err = ''; },
  casoCheck: (id) => casosSend('POST', '/api/cases/' + encodeURIComponent(id) + '/check', {}),
  casoNext: (arg) => { const p = String(arg).split('|'); return casosSend('PUT', '/api/cases/' + encodeURIComponent(p[0]) + '/next-action', { decision: p[1] }); },
  casoAck: (arg) => { const i = String(arg).indexOf('|'); return casosSend('POST', '/api/cases/' + encodeURIComponent(String(arg).slice(0, i)) + '/alerts', { key: String(arg).slice(i + 1) }); },
  casoTr: (arg) => { const p = String(arg).split('|'); return casosSend('POST', '/api/cases/' + encodeURIComponent(p[0]) + '/translate', { eventId: p[1] }); },
  casoInterp: (id) => { if (window.JanusInterpreter) JanusInterpreter.open({ endpoint: '/api/cases/' + encodeURIComponent(id) + '/interpret', noticeEndpoint: '/api/interpreter/notice', headers: casosHeaders, title: (CASOS.list.find((c) => c.id === id) || {}).title || 'Caso', clientLang: 'es', otherLang: 'nl', counterpartRole: 'Dutch police officer', labels: { client: 'Yo', other: 'Agente' } }); },
  casoNote: (id) => { const el = document.getElementById('caso-note'); const text = el ? el.value.trim() : ''; if (!text) return; return casosSend('POST', '/api/cases/' + encodeURIComponent(id) + '/notes', { text }); },
};
