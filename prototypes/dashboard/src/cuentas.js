'use strict';
/* ===== Cuentas de la empresa: estado de resultados, balance y preparación fiscal (Países Bajos) =====
 * Pestaña del dashboard para las piezas LEGO packages/modules/company-books y packages/modules/nl-tax-prep.
 * Solo con el Núcleo encendido y la sesión del Founder: datos reales de GET /api/books y GET /api/tax/nl.
 * Sin Núcleo NO se muestran cifras de ejemplo: las cuentas de una empresa o son reales o no se enseñan.
 */
const CUENTAS = { data: null, tax: null, loading: false, err: '', msg: '', at: 0, tab: 'informes', year: null, period: 'anio', form: { kind: 'income', amount: '', vat: '21', category: '', date: '', description: '', verified: false, hours: '', starter: false } };
const cuentasCore = () => { try { const m = document.querySelector('meta[name="janus-runtime"]'); return !!(m && m.content === 'core' && sessionStorage.getItem('janus.founder.session')); } catch (e) { return false; } };
const cuentasHeaders = () => { const h = { 'content-type': 'application/json' }; try { const t = sessionStorage.getItem('janus.founder.session'); if (t) h.authorization = 'Bearer ' + t; } catch (e) { } return h; };
const eur = (minor) => { const n = Number(minor) || 0, a = Math.abs(n), s = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(a % 100).padStart(2, '0'); return (n < 0 ? '−' : '') + '€ ' + s; };
const cuentasToday = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
function cuentasRange() {
  const today = cuentasToday(), y = CUENTAS.year || Number(today.slice(0, 4)), cur = y === Number(today.slice(0, 4));
  if (CUENTAS.period === 'mes' && cur) return { from: today.slice(0, 8) + '01', to: today };
  if (CUENTAS.period === 'trim' && cur) { const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3); return { from: y + '-' + String(q * 3 + 1).padStart(2, '0') + '-01', to: today }; }
  return { from: y + '-01-01', to: cur ? today : y + '-12-31' };
}
async function cuentasLoad(force) {
  if (!cuentasCore()) { CUENTAS.data = null; return; }
  if (CUENTAS.loading || (!force && CUENTAS.data && Date.now() - CUENTAS.at < 60000)) return;
  CUENTAS.loading = true;
  try {
    const r = cuentasRange(), y = Number(r.from.slice(0, 4)), F = CUENTAS.form;
    const res = await fetch('/api/books?from=' + r.from + '&to=' + r.to, { headers: cuentasHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(res.status === 403 ? 'solo el Founder puede ver las cuentas' : 'HTTP ' + res.status);
    CUENTAS.savedAt = res.headers.get('x-janus-offline') === 'cache' ? res.headers.get('x-janus-saved-at') : null;
    CUENTAS.data = await res.json();
    const q = '/api/tax/nl?year=' + y + (F.hours !== '' ? '&hours=' + encodeURIComponent(F.hours) : '') + (F.starter ? '&starter=1' : '');
    const tr = await fetch(q, { headers: cuentasHeaders(), cache: 'no-store' });
    CUENTAS.tax = tr.ok ? await tr.json() : null; CUENTAS.err = '';
  } catch (e) { CUENTAS.err = 'No se pudieron leer las cuentas (' + e.message + ').'; }
  CUENTAS.loading = false; CUENTAS.at = Date.now(); rerender();
}
async function cuentasSend(method, path, body) {
  if (!cuentasCore()) { CUENTAS.err = 'JANUS no está encendido: no se puede guardar.'; return false; }
  try {
    const res = await fetch(path, { method, headers: cuentasHeaders(), body: JSON.stringify(body || {}), cache: 'no-store' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
    CUENTAS.queued = !!out.queued;
    CUENTAS.err = ''; await cuentasLoad(true); return true;
  } catch (e) { CUENTAS.err = e.message; CUENTAS.msg = ''; return false; }
}
/* Los campos del formulario viven en CUENTAS.form para que un repintado no borre lo escrito. */
document.addEventListener('input', (ev) => { const k = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-cf'); if (k) CUENTAS.form[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; });
document.addEventListener('change', (ev) => { const k = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-cf'); if (k) { CUENTAS.form[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value; if (k === 'kind') rerender(); } });

const cuRow = (name, amount, cls) => '<div class="cur ' + (cls || '') + '"><span>' + name + '</span><b class="mono">' + eur(amount) + '</b></div>';
const cuSec = (s, sign) => (s.lines.length ? '<div class="sb mono">' + esc(s.label) + '</div>' + s.lines.map((l) => cuRow(esc(l.name), l.amountMinor * (sign || 1))).join('') : '');
const cuEvidence = (ev) => '<div class="note mono' + (ev.unverifiedEntries ? ' rdw' : '') + '">' + ev.entries + ' asiento(s)' + (ev.unverifiedEntries ? ' · ⚠ ' + ev.unverifiedEntries + ' sin justificante: cifras no respaldadas del todo' : ev.entries ? ' · todos con justificante' : '') + '</div>';
const CU_VAT_KINDS = { income: 1, expense: 1, invoice_issued: 1, invoice_received: 1, asset_purchase: 1 };
const CU_CAT = { income: 'income', invoice_issued: 'income', expense: 'expense', invoice_received: 'expense' };

function vCuentas(M, X, sub) {
  void cuentasLoad(false);
  const D = CUENTAS.data, F = CUENTAS.form, today = cuentasToday(), thisYear = Number(today.slice(0, 4));
  const head = '<div class="cutop"><div class="cuh">' + seg('cuTab', CUENTAS.tab, [['informes', '📊 Resultados y balance'], ['anotar', '✍ Anotar'], ['impuestos', '🇳🇱 Belastingdienst']]) +
    seg('cuPeriod', CUENTAS.period, [['mes', 'Este mes'], ['trim', 'Trimestre'], ['anio', 'Año']]) + seg('cuYear', CUENTAS.year || thisYear, [[thisYear - 1, String(thisYear - 1)], [thisYear, String(thisYear)]]) + '</div>' +
    (CUENTAS.savedAt ? '<div class="note mono rdw">⚠ Sin conexión con JANUS: cifras guardadas en este aparato el ' + esc(new Date(CUENTAS.savedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })) + '. Lo anotado después no aparece hasta volver.</div>' : '') +
    (CUENTAS.err ? '<div class="note mono rdw">⚠ ' + esc(CUENTAS.err) + '</div>' : '') + (CUENTAS.msg ? '<div class="note mono okc">' + esc(CUENTAS.msg) + '</div>' : '') + '</div>';
  if (!D) {
    return frame('cuentas', sub, M, head + '<div class="col3">' + panel('', '💼', ft('Cuentas de la empresa'), '', '<div class="rdt">' + (cuentasCore() ? 'Leyendo las cuentas…' : 'JANUS no está encendido. Las cuentas de la empresa se guardan dentro de JANUS, cifradas, y solo las ve el Founder.') + '</div><div class="note mono">' + esc(ft("Aquí no se muestran cifras de ejemplo: el balance y el estado de resultados o son reales o no se enseñan.")) + '</div>') + '</div>');
  }
  const R = D.incomeStatement, B = D.balanceSheet;
  let body = '';
  if (CUENTAS.tab === 'informes') {
    const pl = panel('', '📈', ft('Estado de resultados'), R.from.slice(8) + '/' + R.from.slice(5, 7) + ' → ' + R.to.slice(8) + '/' + R.to.slice(5, 7) + '/' + R.to.slice(0, 4),
      cuSec(R.revenue) + cuRow('Ventas', R.revenue.totalMinor, 'tot') + cuSec(R.directCosts, -1) + cuRow('Margen bruto', R.grossProfitMinor, 'tot') +
      cuSec(R.operatingExpenses, -1) + cuSec(R.depreciation, -1) + cuRow('Resultado de la actividad', R.operatingResultMinor, 'tot') +
      cuSec(R.otherIncome) + cuSec(R.financial, -1) + cuSec(R.incomeTax, -1) +
      cuRow(R.netResultMinor >= 0 ? 'BENEFICIO del periodo' : 'PÉRDIDA del periodo', R.netResultMinor, 'big ' + (R.netResultMinor >= 0 ? 'pos' : 'neg')) +
      (R.netMarginBasisPoints != null ? '<div class="note mono">Margen neto: ' + (R.netMarginBasisPoints / 100).toFixed(1).replace('.', ',') + ' % de las ventas</div>' : '') + cuEvidence(R.evidence));
    const side = (title, sections, total) => '<div class="sb mono cut">' + title + '</div>' + sections.map((s) => (s.totalMinor || s.lines.length ? cuRow('<b>' + esc(s.label) + '</b>', s.totalMinor, 'sub') + s.lines.filter(() => s.lines.length > 1 || s.key !== 'result').map((l) => cuRow('· ' + esc(l.name), l.amountMinor, 'dimr')).join('') : '')).join('') + cuRow('Total', total, 'tot');
    const bs = panel('', '⚖', ft('Balance'), 'a ' + B.asOf.slice(8) + '/' + B.asOf.slice(5, 7) + '/' + B.asOf.slice(0, 4),
      side('Lo que la empresa TIENE (activo)', B.assets, B.totalAssetsMinor) + side('Lo que la empresa DEBE (pasivo)', B.liabilities, B.totalLiabilitiesMinor) + side('Lo que es de los socios (patrimonio)', B.equity, B.totalEquityMinor) +
      '<div class="note mono ' + (B.balanced ? 'okc' : 'rdw') + '">' + (B.balanced ? '✔ Cuadra: activo = pasivo + patrimonio' : '⚠ NO cuadra: diferencia de ' + eur(B.differenceMinor) + '. Revise los asientos.') + '</div>' + cuEvidence(B.evidence));
    const info = panel('', '🛈', ft('Cómo leerlo'), '', '<div class="rdt"><b>' + esc(ft("Estado de resultados:")) + '</b>' + esc(ft(" lo que se vendió menos lo que costó, en el periodo elegido. Dice si se gana o se pierde.")) + '</div><div class="rdt"><b>' + esc(ft("Balance:")) + '</b>' + esc(ft(" una foto de un día concreto: lo que la empresa tiene, lo que debe y lo que queda para los socios.")) + '</div><div class="rdt dim">' + esc(ft("Las cifras salen solo de los asientos anotados en JANUS. Lo que no se anota, no existe aquí.")) + '</div>' +
      '<div class="rdb"><span class="btn"' + act('cuCsv', '', 'Descargar el diario') + '>' + esc(ft("⬇ Diario para el contable (CSV)")) + '</span></div>' +
      '<div class="note mono">' + D.totalEntries + ' asiento(s) en total · ' + (D.sealedAtRest ? 'guardados cifrados' : '⚠ sin clave de cifrado: guardados en claro') + ' · solo Founder</div>');
    body = '<div class="col3">' + pl + '</div><div class="col3">' + bs + '</div><div class="col3">' + info + '</div>';
  } else if (CUENTAS.tab === 'anotar') {
    const kinds = Object.keys(D.quickKinds), catType = CU_CAT[F.kind];
    const cats = catType ? D.accounts.filter((a) => a.type === catType && !a.archived) : [];
    const form = panel('', '✍', ft('Anotar un movimiento'), '', '<div class="cuf">' +
      '<label>' + esc(ft("Qué ha pasado")) + '<select class="csin" data-cf="kind">' + kinds.map((k) => '<option value="' + k + '"' + (k === F.kind ? ' selected' : '') + '>' + esc(D.quickKinds[k]) + '</option>').join('') + '</select></label>' +
      '<label>' + esc(ft("Importe total (con IVA)")) + '<input class="csin" data-cf="amount" inputmode="decimal" placeholder="1.234,56" value="' + esc(F.amount) + '"></label>' +
      (CU_VAT_KINDS[F.kind] ? '<label>' + esc(ft("IVA incluido")) + '<select class="csin" data-cf="vat">' + [['21', '21 %'], ['9', '9 %'], ['0', 'Sin IVA']].map((o) => '<option value="' + o[0] + '"' + (o[0] === String(F.vat) ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></label>' : '') +
      (cats.length ? '<label>Tipo de ' + (catType === 'income' ? 'ingreso' : 'gasto') + '<select class="csin" data-cf="category"><option value="">' + esc(ft("(general)")) + '</option>' + cats.map((a) => '<option value="' + a.code + '"' + (a.code === F.category ? ' selected' : '') + '>' + esc(a.name) + '</option>').join('') + '</select></label>' : '') +
      '<label>' + esc(ft("Fecha")) + '<input class="csin" data-cf="date" type="date" max="' + today + '" value="' + esc(F.date || today) + '"></label>' +
      '<label>' + esc(ft("Descripción")) + '<input class="csin" data-cf="description" maxlength="240" placeholder="Cliente, factura, concepto…" value="' + esc(F.description) + '"></label>' +
      '<label class="cuc"><input type="checkbox" data-cf="verified"' + (F.verified ? ' checked' : '') + '>' + esc(ft(" Tengo el justificante (factura o extracto)")) + '</label></div>' +
      '<div class="rdb"><span class="btn"' + act('cuPost', '', 'Guardar el movimiento') + '>' + esc(ft("Guardar")) + '</span></div>' +
      '<div class="note mono">' + esc(ft("JANUS convierte esto en un asiento de partida doble. Un error no se borra: se anula y queda el rastro.")) + '</div>');
    const journal = panel('', '📒', ft('Últimos asientos'), D.totalEntries + '', (D.entries.length ? D.entries.slice(0, 30).map((e) => { const total = e.lines.reduce((s, l) => s + l.debitMinor, 0); return '<div class="rdf' + (e.reversed || e.reverses ? ' past' : '') + '"><div class="rdf1"><b class="mono">' + e.date.slice(8) + '/' + e.date.slice(5, 7) + '</b><span class="mono">' + eur(total) + '</span>' + (e.reverses ? pill('anulación') : e.reversed ? pill('anulado') : pill(e.verified ? 'con justificante' : 'sin justificante', e.verified ? 'g' : '')) + '</div><div class="rdt">' + esc(e.description) + '</div><div class="rdt dim mono">' + e.lines.map((l) => (l.debitMinor ? 'Debe ' : 'Haber ') + l.account + ' ' + eur(l.debitMinor || l.creditMinor)).join(' · ') + '</div>' + (!e.reversed && !e.reverses ? '<div class="rdb"><span class="btn sm"' + act('cuReverse', e.id, 'Anular este asiento') + '>' + esc(ft("Anular")) + '</span></div>' : '') + '</div>'; }).join('') : '<div class="dim">' + esc(ft("Todavía no hay asientos.")) + '</div>'));
    body = '<div class="col3">' + form + '</div><div class="col3 wide2">' + journal + '</div>';
  } else {
    const T = CUENTAS.tax, W = T && T.worksheet, C = (T && T.company) || D.company;
    const company = panel('cucomp', '🏢', ft('Forma jurídica'), C.confirmed ? 'confirmada' : 'POR CONFIRMAR',
      '<div class="rdt">' + esc(ft("De esto depende qué impuesto paga la empresa. JANUS no lo presupone.")) + '</div>' + seg('cuLegal', C.confirmed ? C.legalForm : '', [['eenmanszaak', 'Autónomo (eenmanszaak)'], ['vof', 'Sociedad vof'], ['bv', 'bv'], ['unregistered', 'Sin registrar']]) +
      '<div class="cuf"><label>' + esc(ft("Horas dedicadas a la empresa en el año")) + '<input class="csin" data-cf="hours" inputmode="numeric" placeholder="p. ej. 1400" value="' + esc(F.hours) + '"></label><label class="cuc"><input type="checkbox" data-cf="starter"' + (F.starter ? ' checked' : '') + '>' + esc(ft(" Empresa nueva (cumplo las condiciones de «starter»)")) + '</label></div><div class="rdb"><span class="btn"' + act('cuTaxRun', '', 'Recalcular') + '>' + esc(ft("Recalcular")) + '</span></div>');
    const srcs = (c) => (c && c.sources.length ? '<div class="cus mono">' + (c.confidence === 'verified' ? '✔ ' : '⚠ una sola fuente · ') + c.sources.map((s) => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.publisher) + '</a>').join(' · ') + '</div>' : '');
    const sheet = !T ? panel('', '🧮', ft('Hoja de trabajo'), '', '<div class="dim">Sin datos.</div>') : !W ? panel('', '🧮', ft('Hoja de trabajo ') + T.year, '', '<div class="rdt rdw">' + esc(T.reason || 'Sin reglas para ese año.') + '</div>') :
      panel('', '🧮', ft('Hoja de trabajo ') + W.year, T.partialYear ? 'año en curso · hasta ' + T.through.slice(8) + '/' + T.through.slice(5, 7) : 'año completo',
        W.lines.map((l) => '<div class="cuw' + (l.key === 'total' || l.key === 'vpb' ? ' big' : '') + '">' + cuRow(esc(l.label) + (l.dutch ? ' <i class="dim">' + esc(l.dutch) + '</i>' : ''), l.amountMinor, l.basis === 'estimate' ? 'est' : '') + (l.note ? '<div class="cus mono">' + esc(l.note) + '</div>' : '') + srcs(l.citation) + '</div>').join('') +
        (W.estimatedTaxMinor == null ? '<div class="note mono rdw">' + esc(ft("Sin cálculo de impuesto hasta confirmar la forma jurídica.")) + '</div>' : '') +
        W.warnings.map((w) => '<div class="note mono rdw">⚠ ' + esc(w) + '</div>').join('') + '<div class="note mono">' + esc(W.disclaimer) + '</div>');
    const vat = T && T.vat ? panel('', '🧾', ft('IVA (btw) por trimestre'), String(T.year), T.vat.map((q) => '<div class="rdf"><div class="rdf1"><b class="serif">T' + q.quarter + '</b><span class="mono">' + (q.dueDate ? 'presentar antes del ' + q.dueDate.slice(8) + '/' + q.dueDate.slice(5, 7) + '/' + q.dueDate.slice(0, 4) : '') + '</span></div>' + cuRow('Ventas sin IVA', q.turnoverMinor, 'dimr') + cuRow('IVA cobrado a clientes', q.vatChargedMinor, 'dimr') + cuRow('IVA pagado en compras', -q.vatPaidMinor, 'dimr') + cuRow(q.balanceMinor >= 0 ? 'A pagar' : 'A devolver', Math.abs(q.balanceMinor), 'tot') + '</div>').join('') + '<div class="note mono">' + esc(ft("Resumen de sus asientos; no separa por tipo de IVA ni rellena las casillas oficiales.")) + '</div>') : '';
    const aux = W ? panel('', '📅', ft('Plazos y preparación'), 'reglas revisadas el ' + W.pack.checkedAt.slice(8) + '/' + W.pack.checkedAt.slice(5, 7) + '/' + W.pack.checkedAt.slice(0, 4),
      W.deadlines.map((d) => '<div class="rdi"><span class="bb s">📅</span><span>' + esc(d.label) + '</span>' + pill((d.approximate ? '≈ ' : '') + d.date.slice(8) + '/' + d.date.slice(5, 7) + '/' + d.date.slice(0, 4) + (d.daysLeft >= 0 ? ' · ' + d.daysLeft + ' d' : ' · pasado'), d.daysLeft >= 0 && d.daysLeft <= 21 ? 'r' : '') + '</div>').join('') +
      '<div class="sb mono">' + esc(ft("Lo que pide la declaración")) + '</div>' + W.checklist.map((c) => '<div class="rdi"><span class="bb s">' + (c.ready === true ? '✔' : c.ready === false ? '✗' : '?') + '</span><span>' + esc(c.item) + (c.dutch ? ' · ' + esc(c.dutch) : '') + '</span></div>').join('') +
      W.announced.map((a) => '<div class="note mono">Anunciado para ' + a.year + ': ' + esc(a.text) + '</div>').join('') +
      '<div class="note mono' + (W.pack.stale ? ' rdw' : '') + '">' + W.pack.verified + ' cifras con ≥ 2 fuentes · ' + W.pack.singleSource + ' con una sola' + (W.pack.stale ? ' · ⚠ reglas por revisar (hace ' + W.pack.ageDays + ' días)' : '') + '</div>') : '';
    body = '<div class="col3">' + company + aux + '</div><div class="col3">' + sheet + '</div><div class="col3">' + vat + '</div>';
  }
  return frame('cuentas', sub, M, head + body);
}
VIEWS.cuentas = vCuentas;
TABS.push(['cuentas', '💼', 'Cuentas']);
const CUENTAS_ACTS = {
  cuTab: (t) => { CUENTAS.tab = t; CUENTAS.msg = ''; CUENTAS.err = ''; },
  cuPeriod: (p) => { CUENTAS.period = p; return cuentasLoad(true); },
  cuYear: (y) => { CUENTAS.year = Number(y); if (CUENTAS.year !== Number(cuentasToday().slice(0, 4))) CUENTAS.period = 'anio'; return cuentasLoad(true); },
  cuTaxRun: () => cuentasLoad(true),
  cuLegal: (form) => cuentasSend('PUT', '/api/books/company', { legalForm: form }).then(rerender),
  cuPost: async () => {
    const F = CUENTAS.form;
    if (!String(F.amount).trim() || !String(F.description).trim()) { CUENTAS.err = 'Faltan el importe y la descripción.'; CUENTAS.msg = ''; return; }
    const okSent = await cuentasSend('POST', '/api/books/entries', { kind: F.kind, amount: String(F.amount).trim(), vatPercent: CU_VAT_KINDS[F.kind] ? Number(F.vat) : 0, category: CU_CAT[F.kind] ? F.category : '', date: F.date || cuentasToday(), description: F.description, verified: !!F.verified });
    if (okSent) { CUENTAS.msg = (CUENTAS.queued ? 'Sin conexión: anotado en este aparato; se enviará a JANUS al volver. ' : 'Guardado: ') + F.description; F.amount = ''; F.description = ''; F.verified = false; }
    rerender();
  },
  cuReverse: async (id) => { if (await cuentasSend('POST', '/api/books/entries/' + encodeURIComponent(id) + '/reverse', {})) CUENTAS.msg = 'Asiento anulado (queda el rastro).'; rerender(); },
  /* La descarga necesita la sesión en la cabecera: se pide con fetch y se entrega como archivo. */
  cuCsv: async () => {
    try { const res = await fetch('/api/books/journal.csv', { headers: cuentasHeaders(), cache: 'no-store' }); if (!res.ok) throw new Error('HTTP ' + res.status); const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = 'diario-' + cuentasToday() + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500); }
    catch (e) { CUENTAS.err = 'No se pudo descargar el diario (' + e.message + ').'; rerender(); }
  },
};
