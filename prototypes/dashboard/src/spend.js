'use strict';
/**
 * LEGO surface of JANUS Core's verified expense registry. No simulated charges.
 * The only permitted source of live data is /api/spend on the same authenticated origin.
 */
const SPEND = { state: 'unverified', report: null, checkedAt: '', error: '', loading: false };
TABS.push(['consumos', '💳', 'Consumos']);
VIEWS.consumos = vSpend;

function spendLink() {
  const report = SPEND.report;
  const alerts = SPEND.state === 'ready' && report ? report.alerts : 0;
  const text = SPEND.state === 'ready' && report
    ? (alerts > 0 ? '⚠ ' + alerts + ' alerta' + (alerts > 1 ? 's' : '') : '💳 Consumos')
    : '💳 Consumo · sin verificar';
  return '<span class="spend-quick go mono" data-go="consumos" role="link" tabindex="0" title="Consumos y proveedores">' + esc(text) + '</span>';
}
function spendBadge(provider) {
  if (!provider || provider.state !== 'verified') return '<span class="spend-unknown">NO VERIFICADO</span>';
  const labels = { normal:'Normal', watch:'Vigilar', high:'Alto', critical:'Crítico', unknown:'Sin referencia' };
  return '<span class="spend-alert spend-' + esc(provider.alert) + '">' + esc(labels[provider.alert] || 'Sin referencia') + '</span>';
}
function spendNumber(n) { return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('es-ES') : '—'; }
function spendMoney(n) {
  return typeof n === 'number' && Number.isFinite(n)
    ? new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(n)
    : 'POR CONFIRMAR';
}
function spendChart(points) {
  if (!Array.isArray(points) || !points.length)
    return '<p class="spend-empty">No hay observaciones históricas verificadas. La gráfica se irá construyendo con lecturas reales, sin inventar meses anteriores.</p>';
  const valid = points.filter(p => Number.isFinite(p.used) && Number.isFinite(p.limit) && p.used >= 0 && p.limit >= 0);
  if (!valid.length) return '<p class="spend-empty">Todavía no hay muestras válidas.</p>';
  const max = Math.max(1, ...valid.map(p => Math.max(p.used, p.limit)));
  const positions = valid.map((p,i) => {
    const x = 28 + i * 632 / Math.max(valid.length-1, 1);
    const usedY = 195 - p.used / max * 170;
    const limitY = 195 - p.limit / max * 170;
    return { x, usedY, limitY, p };
  });
  const coords = (key) => positions.map(a => a.x.toFixed(1) + ',' + a[key].toFixed(1)).join(' ');
  const dots = positions.map(a => '<circle cx="' + a.x.toFixed(1) + '" cy="' + a.usedY.toFixed(1) + '" r="4.5" fill="#d5aa61"><title>' +
    esc(a.p.date + ': ' + spendNumber(a.p.used) + ' / ' + spendNumber(a.p.limit)) + '</title></circle>').join('');
  const from = valid[0].date, to = valid[valid.length - 1].date;
  return '<div class="spend-chart-wrap"><svg class="spend-chart" viewBox="0 0 690 220" role="img" aria-label="Consumo y límite por fecha observada">' +
    '<path d="M28 25V195H660" fill="none" stroke="#777" stroke-width="1"/>' +
    '<polyline points="' + coords('limitY') + '" fill="none" stroke="#86b6ff" stroke-width="2" stroke-dasharray="7 5"/>' +
    '<polyline points="' + coords('usedY') + '" fill="none" stroke="#d5aa61" stroke-width="3"/>' + dots +
    '</svg><div class="spend-legend mono"><span>● Consumo</span><span>— Límite reportado</span></div>' +
    '<div class="spend-legend mono"><span>' + esc(from) + '</span><span>' + esc(to) + '</span></div></div>';
}
function vSpend(M, _X, sub) {
  const ready = SPEND.state === 'ready' && SPEND.report;
  const providers = ready && Array.isArray(SPEND.report.providers) ? SPEND.report.providers : [];
  const selected = providers.find(p => p.id === sub) || null;
  const head = '<section class="cd spend-section"><div class="lb mono"><span class="bb">💳</span>Control de consumo<span class="mt">JANUS CORE</span></div>' +
    '<div class="pb"><p>Resumen de uso y gasto de servicios de InfinitySeed. Sin datos verificados, un coste nunca se presenta como 0 €.</p>' +
    '<div class="spend-top"><div><small>Coste total del mes</small><strong>' + spendMoney(ready ? SPEND.report.totalCostEUR : null) + '</strong></div>' +
    '<div><small>Proveedores verificados</small><strong>' + (ready ? spendNumber(SPEND.report.verifiedProviders) : '—') + '</strong></div>' +
    '<div><small>Alertas verificadas</small><strong>' + (ready ? spendNumber(SPEND.report.alerts) : '—') + '</strong></div></div>' +
    (SPEND.state === 'auth_required'
      ? '<p class="spend-empty">Accede como Founder desde «Identificarme» en la app JANUS. La información privada no se consulta sin autenticación.</p>'
      : SPEND.state === 'loading'
        ? '<p class="spend-empty">Consultando los datos del servidor JANUS…</p>'
        : SPEND.state !== 'ready'
          ? '<p class="spend-empty">Sin lecturas en directo. Estado: ' + esc(SPEND.state) + '. ' + esc(SPEND.error) + '</p>'
          : '<p class="spend-caption">Última consulta al núcleo: ' + esc(SPEND.checkedAt) + '. El coste global no se puede sumar mientras falten fuentes de facturación.</p>') +
    '<span class="btn spend-refresh" data-act="spendRefresh" role="button" tabindex="0">↻ Consultar ahora</span></div></section>';
  const rows = providers.length ? providers.map(p => {
    const unit = p.state === 'verified' ? spendNumber(p.used) + ' / ' + spendNumber(p.limit) + ' ' + esc(p.unit || '') : 'Sin conexión verificable';
    return '<span class="spend-provider go" data-go="consumos/' + esc(p.id) + '" role="link" tabindex="0">' +
      '<b>' + esc(p.name) + '</b>' + spendBadge(p) + '<span class="spend-provider-usage">' + unit + '</span><span aria-hidden="true">›</span></span>';
  }).join('') : '<p class="spend-empty">Identifícate y consulta al núcleo para ver los proveedores.</p>';
  const index = '<section class="cd spend-section"><div class="lb mono"><span class="bb">🗂</span>Proveedores<span class="mt">Selecciona para ver gráficas</span></div>' +
    '<div class="pb"><div class="spend-providers">' + rows + '</div></div></section>';
  let detail = '';
  if (selected) {
    const measured = selected.state === 'verified';
    const pct = measured && typeof selected.percent === 'number' ? selected.percent.toLocaleString('es-ES') + ' %' : '—';
    detail = '<section class="cd spend-section" aria-label="Detalle de proveedor"><div class="lb mono"><span class="bb">📈</span>' + esc(selected.name) + '<span class="mt">' + spendBadge(selected) + '</span></div><div class="pb">' +
      '<div class="spend-top"><div><small>Uso del periodo actual</small><strong>' + (measured ? spendNumber(selected.used) : '—') + '</strong></div>' +
      '<div><small>Límite declarado</small><strong>' + (measured ? spendNumber(selected.limit) : '—') + '</strong></div>' +
      '<div><small>Porcentaje consumido</small><strong>' + pct + '</strong></div>' +
      '<div><small>Coste total (EUR)</small><strong>' + spendMoney(selected.totalCostEUR) + '</strong></div></div>' +
      (measured ? '<p class="spend-caption">Unidad: ' + esc(selected.unit || 'no declarada') + '. Próximo reinicio: ' + esc(selected.resetAt || 'sin fecha verificada') +
        '. Excedente habilitado: ' + (selected.overageEnabled === null ? 'sin verificar' : selected.overageEnabled ? 'sí — revisar límite en proveedor' : 'no') +
        '. Excedentes EUR reportados: ' + spendMoney(selected.overageEUR) + '.</p>' : '<p class="spend-empty">' + esc(selected.note) + '</p>') +
      '<div class="sb mono">Histórico de observaciones reales (hasta 90 días)</div>' + spendChart(selected.history) +
      '<p class="spend-caption">Fuente: ' + esc(selected.source || 'No conectada') + '. Las gráficas no representan facturación en EUR y no se reconstruyen meses pasados.</p>' +
      '</div></section>';
  }
  return frame('consumos', sub, M, head + index + detail);
}
async function loadSpendData(force) {
  if (SPEND.loading) return;
  if (!/^https?:$/.test(location.protocol)) {
    SPEND.state = 'unverified'; SPEND.error = 'El HTML local no da acceso a la contabilidad privada.'; return;
  }
  const token = (() => { try { return sessionStorage.getItem('janus.founder.session'); } catch (_) { return null; } })();
  if (!token) {
    SPEND.state = 'auth_required'; SPEND.report = null; SPEND.error = '';
    if (typeof rerender === 'function') rerender();
    return;
  }
  if (!force && SPEND.state === 'ready' && Date.now() - SPEND.lastLoad < 15 * 60000) return;
  SPEND.loading = true; SPEND.state = 'loading'; SPEND.error = '';
  if (typeof rerender === 'function') rerender();
  try {
    const response = await fetch(location.origin + '/api/spend', {
      method:'GET', headers:{ authorization:'Bearer ' + token },
      credentials:'omit', cache:'no-store', redirect:'error',
    });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Sesión no autorizada. Vuelve a identificarte.' : 'JANUS CORE respondió HTTP ' + response.status);
    const body = await response.json();
    if (!body.ok || !body.report || !Array.isArray(body.report.providers)) throw new Error('Respuesta de gasto no verificable');
    SPEND.report = body.report; SPEND.checkedAt = String(body.collectedAt || 'sin fecha'); SPEND.state = 'ready'; SPEND.lastLoad = Date.now();
  } catch (error) {
    SPEND.state = 'unavailable'; SPEND.report = null; SPEND.error = String(error && error.message || error).slice(0, 160);
  } finally {
    SPEND.loading = false;
    if (typeof rerender === 'function') rerender();
  }
}
