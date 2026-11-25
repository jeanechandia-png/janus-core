'use strict';
/* ===== Sin internet: qué funciona, qué no, y qué está pendiente de enviar =====
 * Monta la pieza LEGO lego/janus-offline (copias locales + bandeja de salida en el navegador) y enseña el veredicto
 * de packages/modules/offline-kit que calcula el Núcleo (GET /api/offline/status). Nada es de ejemplo.
 */
const OFFL = { data: null, savedAt: null, loading: false, err: '', at: 0, local: [], browser: { online: true, pending: 0, review: 0, lastSavedAt: null } };
const offlCore = () => { try { const m = document.querySelector('meta[name="janus-runtime"]'); return !!(m && m.content === 'core' && sessionStorage.getItem('janus.founder.session')); } catch (e) { return false; } };
const offlHeaders = () => { const h = { 'content-type': 'application/json' }; try { const t = sessionStorage.getItem('janus.founder.session'); if (t) h.authorization = 'Bearer ' + t; } catch (e) { } return h; };
const offlHM = (iso) => { try { return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); } catch (e) { return ''; } };
/* Lecturas que se guardan en el aparato y cambios que pueden esperar a que vuelva la conexión. */
function offlInstall() {
  if (!window.JanusOffline || !offlCore() || OFFL.installed) return;
  OFFL.installed = true;
  JanusOffline.install({
    namespace: 'janus:founder',
    read: ['/api/books', '/api/tax/nl', '/api/cases', '/api/radar', '/api/offline/status', '/api/work/team/presence'],
    write: [{ match: '/api/books/entries', method: 'POST', kind: 'books.entry', summary: (b) => 'Cuentas: ' + ((b && b.description) || 'movimiento') }],
    headers: offlHeaders,
    onChange: (state) => { const synced = state.pending < OFFL.browser.pending || (state.online && !OFFL.browser.online); OFFL.browser = state;
      // Tras sincronizar, las vistas vuelven a pedir datos en vivo en vez de enseñar su copia de hace un momento.
      if (synced) { OFFL.at = 0; try { CUENTAS.at = 0; } catch (e) { } }
      JanusOffline.pending().then((list) => { OFFL.local = list; rerender(); }); },
  }).catch(() => { OFFL.installed = false; });
}
try { offlInstall(); } catch (e) { }
async function offlLoad(force) {
  offlInstall();
  if (!offlCore()) { OFFL.data = null; return; }
  if (OFFL.loading || (!force && OFFL.data && Date.now() - OFFL.at < 30000)) return;
  OFFL.loading = true;
  try {
    const res = await fetch('/api/offline/status', { headers: offlHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 403 ? 'solo el Founder' : 'HTTP ' + res.status);
    OFFL.savedAt = res.headers.get('x-janus-offline') === 'cache' ? res.headers.get('x-janus-saved-at') : null;
    OFFL.data = await res.json(); OFFL.err = '';
  } catch (e) { OFFL.err = 'No se pudo hablar con JANUS (' + e.message + ').'; }
  if (window.JanusOffline) { try { OFFL.local = await JanusOffline.pending(); OFFL.browser = JanusOffline.state(); } catch (e) { } }
  OFFL.loading = false; OFFL.at = Date.now(); rerender();
}
const OFFL_ICON = { works: '✔', degraded: '◐', unavailable: '✗' };
const offlRow = (c) => '<div class="rdi"><span class="bb s ofl-' + c.status + '">' + OFFL_ICON[c.status] + '</span><span><b>' + esc(c.label) + '</b><br><span class="dim">' + esc(c.detail) + '</span></span></div>';

function vOffline(M, X, sub) {
  void offlLoad(false);
  const D = OFFL.data, B = OFFL.browser;
  const reach = !D ? 'none' : OFFL.savedAt ? 'cache' : 'live';
  const top = '<div class="cutop">' + (OFFL.savedAt ? '<div class="note mono rdw">⚠ No se llega a JANUS ahora mismo. Se muestra lo último guardado en este aparato (' + offlHM(OFFL.savedAt) + ').</div>' : '') +
    (OFFL.err && !D ? '<div class="note mono rdw">⚠ ' + esc(OFFL.err) + '</div>' : '') + '</div>';
  if (!D) return frame('offline', sub, M, top + '<div class="col3">' + panel('', '🔌', ft('Sin internet'), '', '<div class="rdt">' + (offlCore() ? 'Consultando a JANUS…' : 'JANUS no está encendido. Esta pantalla enseña, con datos reales, qué funciona sin internet y qué queda pendiente de enviar.') + '</div>') + '</div>');
  const C = D.connectivity, W = D.withoutInternet;
  const state = reach === 'cache' ? ['Sin conexión con JANUS', 'r'] : C.state === 'offline' ? ['JANUS sin internet', 'r'] : C.state === 'online' ? ['Con internet', 'g'] : [C.probing ? 'Comprobando…' : 'No usa servicios externos', ''];
  const now = panel('', '🔌', ft('Ahora mismo'), '', '<div class="rdi"><span class="bb s">📡</span><span><b>' + state[0] + '</b>' + (C.lastProbeAt ? '<br><span class="dim">Última comprobación: ' + offlHM(C.lastProbeAt) + '</span>' : '') + '</span>' + pill(state[0], state[1]) + '</div>' +
    '<div class="sb mono">Recursos propios en el aparato</div>' +
    [['local_model', 'Modelo de IA propio'], ['local_stt', 'Reconocimiento de voz propio'], ['local_tts', 'Voz propia']].map((r) => '<div class="rdi"><span class="bb s ofl-' + (D.resources[r[0]] ? 'works' : 'unavailable') + '">' + (D.resources[r[0]] ? '✔' : '✗') + '</span><span>' + r[1] + '</span>' + pill(D.resources[r[0]] ? 'instalado' : 'no instalado', D.resources[r[0]] ? 'g' : '') + '</div>').join('') +
    '<div class="note mono">Con un modelo de IA propio en el aparato, JANUS conversa y hace de intérprete sin internet. Hoy ' + (D.resources.local_model ? 'está instalado.' : 'no está instalado: sin internet responde sin IA.') + '</div>' +
    '<div class="rdb"><span class="btn"' + act('offlProbe', '', 'Comprobar ahora') + '>Comprobar ahora</span></div>');
  const list = panel('', '📋', ft('Si se va internet'), W.works.length + ' ✔ · ' + W.degraded.length + ' ◐ · ' + W.unavailable.length + ' ✗',
    '<div class="sb mono">Sigue funcionando</div>' + W.works.map(offlRow).join('') + (W.degraded.length ? '<div class="sb mono">Funciona a medias</div>' + W.degraded.map(offlRow).join('') : '') + (W.unavailable.length ? '<div class="sb mono">Necesita internet</div>' + W.unavailable.map(offlRow).join('') : ''));
  const srv = D.outbox.review || [];
  const item = (i, where) => '<div class="rdf"><div class="rdf1"><b>' + esc(i.summary) + '</b>' + pill(i.state === 'queued' ? 'en espera' : 'decide tú', i.state === 'queued' ? '' : 'r') + '</div><div class="rdt dim mono">' + offlHM(i.createdAt) + (i.lastError ? ' · ' + esc(i.lastError) : '') + '</div>' +
    (i.state !== 'queued' ? '<div class="rdb"><span class="btn sm"' + act('offlSend', where + ':' + i.id, 'Enviar ahora') + '>Enviar ahora</span><span class="btn sm"' + act('offlDrop', where + ':' + i.id, 'Descartar') + '>Descartar</span></div>' : '') + '</div>';
  const box = panel('', '📤', ft('Pendiente de enviar'), String(OFFL.local.length + srv.length),
    '<div class="sb mono">Desde este aparato</div>' + (OFFL.local.length ? OFFL.local.map((i) => item({ ...i, state: i.state === 'review' ? 'needs_review' : 'queued' }, 'b')).join('') : '<div class="dim">Nada pendiente.</div>') +
    '<div class="sb mono">En JANUS</div>' + (srv.length ? srv.map((i) => item(i, 's')).join('') : '<div class="dim">Nada pendiente.</div>') +
    '<div class="note mono">Lo que anotas sin conexión se guarda aquí y sale solo al volver. Lo delicado, o lo que lleva más de un día esperando, te pide confirmación antes.</div>' +
    (B.lastSavedAt ? '<div class="note mono">Última copia guardada en este aparato: ' + offlHM(B.lastSavedAt) + '</div>' : ''));
  return frame('offline', sub, M, top + '<div class="col3">' + now + '</div><div class="col3">' + list + '</div><div class="col3">' + box + '</div>');
}
VIEWS.offline = vOffline;
TABS.push(['offline', '🔌', 'Sin red']);
const OFFL_ACTS = {
  offlProbe: async () => { try { const res = await fetch('/api/offline/probe', { method: 'POST', headers: offlHeaders(), body: '{}', cache: 'no-store' }); if (res.ok) { OFFL.data = await res.json(); OFFL.savedAt = null; OFFL.err = ''; } } catch (e) { } if (window.JanusOffline) { try { await JanusOffline.drain(); } catch (e) { } } OFFL.at = 0; await offlLoad(true); },
  offlSend: (ref) => offlDecide(ref, 'send'),
  offlDrop: (ref) => offlDecide(ref, 'discard'),
};
async function offlDecide(ref, decision) {
  const where = ref.slice(0, 1), id = ref.slice(2);
  try {
    if (where === 'b' && window.JanusOffline) await JanusOffline.decide(id, decision);
    else await fetch('/api/offline/outbox/' + encodeURIComponent(id) + '/decision', { method: 'POST', headers: offlHeaders(), body: JSON.stringify({ decision }), cache: 'no-store' });
  } catch (e) { }
  await offlLoad(true);
}
