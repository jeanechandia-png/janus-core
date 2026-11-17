'use strict';
/* ===== Radar de oportunidades (incidencia JANUS-OPPORTUNITY-20261110) =====
 * Pestaña del dashboard para packages/core/src/opportunity-radar.ts.
 * Con el Núcleo y la sesión del CEO: datos reales de GET /api/radar y acciones guardadas en JANUS.
 * Sin Núcleo (vista previa): muestra el REGISTRO INICIAL de la incidencia, marcado como tal; nada se guarda.
 * Los cupos son datos DECLARADOS: JANUS no lee los contadores de ninguna cuenta.
 */
const RADAR = { data: null, src: 'registro', loading: false, err: '', sel: null, at: 0 };
const radarCore = () => { try { const m = document.querySelector('meta[name="janus-runtime"]'); return !!(m && m.content === 'core' && sessionStorage.getItem('janus.founder.session')); } catch (e) { return false; } };
const radarHeaders = () => { const h = { 'content-type': 'application/json' }; try { const t = sessionStorage.getItem('janus.founder.session'); if (t) h.authorization = 'Bearer ' + t; } catch (e) { } return h; };
const radarWhen = (isoText, withTime) => { if (!isoText) return '—'; const d = new Date(isoText); if (isNaN(d)) return '—'; try { return d.toLocaleString('es-ES', Object.assign({ timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short' }, withTime === false ? {} : { hour: '2-digit', minute: '2-digit', hour12: false })); } catch (e) { return isoText.slice(0, 16).replace('T', ' '); } };
const radarLeft = (h) => h == null ? 'sin fecha de fin' : h <= 0 ? 'caducada' : h < 48 ? 'quedan ' + Math.round(h) + ' h' : 'quedan ' + Math.round(h / 24) + ' días';

/* Registro inicial (mismo contenido que siembra el Núcleo). Solo para la vista previa sin conexión. */
function radarInitial() {
  const now = Date.now(), end = Date.parse('2026-11-17T07:59:00Z'), reset = Date.parse('2026-11-14T14:00:00Z'), hrs = (a, b) => Math.max(0, Math.round((b - a) / 360000) / 10);
  const left = Math.round((end - now) / 360000) / 10, expired = end <= now;
  const phases = expired ? [] : reset > now ? [
    { id: 'A', from: new Date(now).toISOString(), to: new Date(reset).toISOString(), hours: hrs(now, reset), capacity: 'Cupo restante desconocido: anótelo desde Ajustes → Uso de la cuenta.', focus: 'Usar el cupo disponible en las tareas de mayor valor y dejar preparados documentos, archivos y pruebas.' },
    { id: 'B', from: new Date(reset).toISOString(), to: new Date(end).toISOString(), hours: hrs(reset, end), capacity: 'Cupo renovado en el restablecimiento (fecha indicada, sin verificar).', focus: 'Ejecutar de inmediato: implementación, auditorías, correcciones y pruebas de los productos activos.' }]
    : [{ id: 'B', from: new Date(now).toISOString(), to: new Date(end).toISOString(), hours: hrs(now, end), capacity: 'Cupo renovado (fecha indicada, sin verificar).', focus: 'Ejecutar de inmediato: implementación, auditorías, correcciones y pruebas.' }];
  return {
    generatedAt: new Date(now).toISOString(),
    opportunities: [{ id: 'opp_fable52_pro_launch', provider: 'Anthropic', title: 'Claude Fable 5.2 incluido en el plan Pro (semana de lanzamiento)', kind: 'promotion', verification: 'pending', status: expired ? 'expired' : 'pending',
      sourceUrl: 'https://support.claude.com/en/articles/17506494', sourceLabel: 'Ayuda de Claude (citada por prensa; JANUS no ha leído la página oficial)',
      publishedAt: '2026-11-09T18:00:00Z', startsAt: '2026-11-09T18:00:00Z', expiresAt: '2026-11-17T07:59:00Z', hoursLeft: left,
      conditions: 'Según prensa que cita la ayuda oficial: incluido en Pro hasta el 16-nov 23:59 PT (17-nov 08:59 en Países Bajos); hasta el 50 % del límite semanal en Fable; un restablecimiento gratuito («Reset for free» en Ajustes → Uso) que caduca al terminar la semana de lanzamiento; después, Fable vuelve a consumir créditos de uso.',
      eligibility: 'Plan Pro. El restablecimiento gratuito exige facturación de pago anterior al 9-nov 10:00 PT.',
      projects: ['JANUS', 'IBA', 'ChatBox', 'Melanie'], benefit: 5, cost: 'none', risk: 1, compatible: true, stage: 'used', detectedBy: 'owner', detectedAt: '2026-11-10T12:00:00Z',
      score: { score: expired ? 0 : 82, priority: expired ? 'low' : 'critical', reasons: [radarLeft(left), 'beneficio 5/5', 'sin coste adicional', 'pendiente de verificar en la fuente oficial'] },
      late: { late: true, reason: 'La comunicó el propietario; JANUS no había generado una alerta propia.' },
      history: [{ at: '2026-11-10T12:00:00Z', event: 'detected', detail: 'Detectada por el propietario' }, { at: '2026-11-10T12:00:00Z', event: 'stage', detail: 'detected → activated: En uso en la cuenta Claude Pro' }, { at: '2026-11-10T12:00:00Z', event: 'stage', detail: 'activated → used' }] }],
    alerts: [], counts: { open: expired ? 0 : 1, verified: 0, pending: expired ? 0 : 1, expired: expired ? 1 : 0, critical: expired ? 0 : 1 },
    quotas: [{ id: 'quota_claude_pro_weekly', account: 'Claude Pro (propietario)', kind: 'weekly', label: 'Cupo semanal de Claude', resetsAt: '2026-11-14T14:00:00Z', verified: false, note: 'Indicado por el propietario: sábado 14-nov hacia las 15:00 (Países Bajos). Por verificar en la cuenta.' },
      { id: 'quota_claude_pro_5h', account: 'Claude Pro (propietario)', kind: 'short', label: 'Ventana corta (5 horas)', verified: false, note: 'Sin disponibilidad continua garantizada.' }],
    plan: { promotionEndsAt: '2026-11-17T07:59:00Z', nextResetAt: reset > now ? '2026-11-14T14:00:00Z' : null, resetVerified: false, phases, warnings: expired ? ['La promoción ya caducó.'] : ['Hay cupos sin verificar en la cuenta: las horas y fechas son las indicadas por el propietario.', 'Existen límites por ventanas cortas: no hay disponibilidad continua garantizada.'] },
    monitor: { enabled: false, reason: 'Vista previa sin conexión al Núcleo: aquí no se lee ninguna fuente.', lastRun: null, pushConfigured: false,
      sources: [['Anthropic · Newsroom', 'https://www.anthropic.com/news'], ['OpenAI · News', 'https://openai.com/news/'], ['Google · The Keyword (AI)', 'https://blog.google/technology/ai/']].map((s, i) => ({ id: 's' + i, label: s[0], url: s[1], state: null })) },
    incidents: [{ id: 'JANUS-OPPORTUNITY-20261110', at: '2026-11-10T12:00:00Z', error: 'Oportunidad temporal comunicada por el propietario; JANUS no había generado una alerta temprana verificable.', cause: 'POR CONFIRMAR. No se ha identificado un fallo técnico específico: no existía un monitor de oportunidades en ejecución.', preventiveRule: 'Vigilar fuentes oficiales con el Opportunity Radar; registrar fuente, fechas, condiciones, cupo y aprovechamiento.', verified: false }],
  };
}
async function radarLoad(force) {
  if (RADAR.loading || (!force && RADAR.data && Date.now() - RADAR.at < 60000)) return;
  if (!radarCore()) { RADAR.data = radarInitial(); RADAR.src = 'registro'; RADAR.at = Date.now(); return; }
  RADAR.loading = true;
  try {
    const res = await fetch('/api/radar', { headers: radarHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    RADAR.data = await res.json(); RADAR.src = 'vivo'; RADAR.err = '';
  } catch (e) { RADAR.err = 'No se pudo leer el radar del Núcleo (' + e.message + ').'; if (!RADAR.data) { RADAR.data = radarInitial(); RADAR.src = 'registro'; } }
  RADAR.loading = false; RADAR.at = Date.now(); rerender();
}
async function radarSend(method, path, body) {
  if (!radarCore()) { RADAR.err = 'Vista previa: los cambios se guardan cuando JANUS está encendido.'; return false; }
  try {
    const res = await fetch(path, { method, headers: radarHeaders(), body: JSON.stringify(body || {}), cache: 'no-store' });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || ('HTTP ' + res.status));
    RADAR.err = ''; await radarLoad(true); return true;
  } catch (e) { RADAR.err = e.message; return false; }
}
const RADAR_ST = { verified: ['verificada', 'g'], pending: ['por verificar', ''], expired: ['caducada', 'r'] };
const RADAR_STAGE = { detected: 'Detectada', activated: 'Activada', used: 'En uso', finished: 'Finalizada', dismissed: 'Descartada' };
const RADAR_NEXT = { detected: ['activated', 'Marcar activada'], activated: ['used', 'Marcar en uso'], used: ['finished', 'Marcar finalizada'] };
const RADAR_PRI = { critical: ['crítica', 'r'], high: ['alta', ''], normal: ['normal', ''], low: ['baja', ''] };

function vRadar(M, X, sub) {
  if (!RADAR.data) { RADAR.data = radarInitial(); RADAR.src = 'registro'; }
  void radarLoad(false);
  const D = RADAR.data, list = D.opportunities || [], sel = list.find((o) => o.id === RADAR.sel) || list[0];
  const badge = RADAR.src === 'vivo' ? '● REAL' : 'REGISTRO INICIAL';
  const ops = panel('', '📡', 'Oportunidades', D.counts.open + ' abiertas · ' + D.counts.pending + ' por verificar · ' + D.counts.expired + ' caducadas',
    (list.length ? '<div class="rdl">' + list.map((o) => '<div class="rdo' + (sel && o.id === sel.id ? ' on' : '') + (o.status === 'expired' ? ' past' : '') + '"' + act('radarSel', o.id, o.title) + '><div class="rdo1"><b>' + esc(o.provider) + '</b>' + pill(RADAR_ST[o.status][0], RADAR_ST[o.status][1]) + pill('prioridad ' + RADAR_PRI[o.score.priority][0], RADAR_PRI[o.score.priority][1]) + '</div><div class="rdo2">' + esc(o.title) + '</div><div class="rdo3 mono">' + esc(radarLeft(o.hoursLeft)) + ' · ' + RADAR_STAGE[o.stage] + '</div></div>').join('') + '</div>' : '<div class="dim">Sin oportunidades registradas.</div>') +
    '<div class="note mono">' + badge + (RADAR.src === 'vivo' ? '' : ' · sin conexión al Núcleo, nada se guarda') + '</div>');
  const kv = (rows) => '<div class="kv">' + rows.filter((r) => r[2]).map((r) => '<div class="kvr"><span class="bb s">' + r[0] + '</span><span>' + r[1] + '</span><b class="mono">' + r[2] + '</b></div>').join('') + '</div>';
  const det = sel ? panel('', '🔎', 'Detalle', RADAR_STAGE[sel.stage],
    '<div class="rdh"><b class="serif big2">' + esc(sel.title) + '</b></div>' +
    kv([['🏢', 'Proveedor', esc(sel.provider)], ['📅', 'Publicada', radarWhen(sel.publishedAt)], ['▶', 'Empieza', radarWhen(sel.startsAt)], ['⏳', 'Termina (hora NL)', radarWhen(sel.expiresAt)], ['🧩', 'Beneficia a', esc((sel.projects || []).join(' · '))], ['💶', 'Coste', { none: 'sin coste adicional', low: 'bajo', medium: 'medio', high: 'alto' }[sel.cost]], ['👁', 'Detectada por', { owner: 'el propietario', monitor: 'el monitor', agent: 'un agente' }[sel.detectedBy] + ' · ' + radarWhen(sel.detectedAt, false)]]) +
    (sel.conditions ? '<div class="sb mono">Condiciones</div><div class="rdt">' + esc(sel.conditions) + '</div>' : '') +
    (sel.eligibility ? '<div class="sb mono">Quién puede usarla</div><div class="rdt">' + esc(sel.eligibility) + '</div>' : '') +
    '<div class="sb mono">Por qué esta prioridad</div><div class="rdt">' + esc((sel.score.reasons || []).join(' · ')) + '</div>' +
    (sel.late && sel.late.late ? '<div class="note mono rdw">⚠ Detección tardía: ' + esc(sel.late.reason) + '</div>' : '') +
    (sel.sourceUrl ? '<div class="sb mono">Fuente</div><a class="rdi lnk" href="' + esc(sel.sourceUrl) + '" target="_blank" rel="noopener"><span>' + esc(sel.sourceLabel || sel.sourceUrl) + '</span>' + pill(sel.verification === 'verified' ? 'oficial leída' : 'sin leer por JANUS', sel.verification === 'verified' ? 'g' : '') + '</a>' : '') +
    '<div class="rdb">' + (sel.status !== 'expired' && RADAR_NEXT[sel.stage] ? '<span class="btn"' + act('radarStage', sel.id + '|' + RADAR_NEXT[sel.stage][0], RADAR_NEXT[sel.stage][1]) + '>' + RADAR_NEXT[sel.stage][1] + '</span>' : '') + (sel.verification !== 'verified' && sel.sourceUrl ? '<span class="btn"' + act('radarVerify', sel.id, 'He leído la fuente oficial') + '>✔ He leído la fuente oficial</span>' : '') + '</div>' +
    (RADAR.err ? '<div class="note mono rdw">' + esc(RADAR.err) + '</div>' : '')) : panel('', '🔎', 'Detalle', '', '<div class="dim">Elige una oportunidad.</div>');
  const P = D.plan;
  const quota = panel('', '⏱', 'Cupo y ventanas', P && P.nextResetAt ? 'restablece ' + radarWhen(P.nextResetAt) : 'sin restablecimiento conocido',
    (D.quotas || []).map((q) => '<div class="rdi"><span class="bb s">' + (q.kind === 'short' ? '⚡' : '📆') + '</span><span>' + esc(q.label) + (q.usedPercent != null ? ' · usado ' + q.usedPercent + ' %' : ' · consumo sin anotar') + '</span>' + pill(q.verified ? 'verificado' : 'declarado', q.verified ? 'g' : '') + '</div>').join('') +
    (P && P.phases.length ? P.phases.map((f) => '<div class="rdf"><div class="rdf1"><b class="serif">Fase ' + f.id + '</b><span class="mono">' + radarWhen(f.from) + ' → ' + radarWhen(f.to) + ' · ' + Math.round(f.hours) + ' h de calendario</span></div><div class="rdt">' + esc(f.focus) + '</div><div class="rdt dim">' + esc(f.capacity) + '</div></div>').join('') : '') +
    (P ? (P.warnings || []).map((w) => '<div class="note mono rdw">⚠ ' + esc(w) + '</div>').join('') : '') +
    '<div class="note mono">La fecha de fin de una promoción no es el tiempo efectivo de trabajo: manda el cupo. JANUS no lee los contadores de la cuenta.</div>');
  const Mo = D.monitor || { sources: [] };
  const mon = panel('', '🛰', 'Vigilancia de fuentes oficiales', Mo.enabled ? 'monitor activo' : 'monitor apagado',
    (Mo.sources || []).map((s) => '<div class="rdi"><span class="bb s">🌐</span><span>' + esc(s.label) + '</span>' + pill(s.state ? (s.state.ok ? 'leída ' + radarWhen(s.state.checkedAt) : 'sin acceso · ' + esc(s.state.detail)) : 'nunca leída', s.state ? (s.state.ok ? 'g' : 'r') : '') + '</div>').join('') +
    (Mo.reason ? '<div class="note mono rdw">' + esc(Mo.reason) + '</div>' : '') +
    '<div class="rdb"><span class="btn"' + act('radarRun', '', 'Revisar fuentes ahora') + '>↻ Revisar fuentes ahora</span></div>' +
    '<div class="note mono">El monitor propone candidatas por palabras clave; siempre nacen «por verificar». Avisos al teléfono: ' + (Mo.pushConfigured ? 'configurados' : 'sin configurar') + '.</div>');
  const inc = panel('', '🧾', 'Incidencias y lecciones', (D.incidents || []).length + '',
    (D.incidents || []).map((i) => '<div class="rdf"><div class="rdf1"><b class="mono">' + esc(i.id) + '</b>' + pill(i.verified ? 'medida verificada' : 'medida por verificar', i.verified ? 'g' : '') + '</div><div class="rdt">' + esc(i.error) + '</div><div class="rdt dim">Causa: ' + esc(i.cause) + '</div><div class="rdt dim">Regla: ' + esc(i.preventiveRule) + '</div></div>').join('') || '<div class="dim">Sin incidencias.</div>');
  return frame('radar', sub, M, '<div class="col3">' + ops + inc + '</div><div class="col3">' + det + '</div><div class="col3">' + quota + mon + '</div>');
}
VIEWS.radar = vRadar;
TABS.push(['radar', '📡', 'Radar']);
const RADAR_ACTS = {
  radarSel: (id) => { RADAR.sel = id; RADAR.err = ''; },
  radarStage: (arg) => { const p = String(arg).split('|'); return radarSend('PUT', '/api/radar/opportunities/' + encodeURIComponent(p[0]) + '/stage', { stage: p[1] }).then(rerender); },
  radarVerify: (id) => radarSend('PUT', '/api/radar/opportunities/' + encodeURIComponent(id) + '/verify', {}).then(rerender),
  radarRun: () => radarSend('POST', '/api/radar/run', {}).then(rerender),
};
/** Resumen para la portada: cuántas oportunidades abiertas hay y si alguna es crítica. */
function radarChip() {
  if (!RADAR.data) { RADAR.data = radarInitial(); RADAR.src = 'registro'; void radarLoad(false); }
  const c = RADAR.data.counts; if (!c.open) return '';
  return '<span class="chip ' + (c.critical ? 'warn' : '') + ' go"' + goAttr('radar', 'Radar de oportunidades') + '>📡 ' + c.open + '</span>';
}
