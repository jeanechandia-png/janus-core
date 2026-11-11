import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceStage, buildRadarView, createOpportunity, detectCandidates, dueOpportunityAlerts, lateDetection, markNotified,
  mergeOpportunity, opportunityFingerprint, opportunityStatus, parseRadarSources, planUtilization, runRadar, scoreOpportunity,
  validateQuotaWindow, verifyOpportunity, type Opportunity, type RadarSourceState,
} from '../packages/core/src/opportunity-radar.js';

const NOW = '2026-11-10T20:00:00Z';
const promo = (over = {}) => createOpportunity({ provider: 'Anthropic', title: 'Claude Fable 5.2 incluido en Pro', kind: 'promotion', expiresAt: '2026-11-17T07:59:00Z', startsAt: '2026-11-09T18:00:00Z', publishedAt: '2026-11-09T18:00:00Z', projects: ['JANUS', 'IBA'], benefit: 5, cost: 'none', detectedBy: 'owner', ...over }, { id: 'op-1', now: NOW });

test('detección de una promoción nueva: nace pendiente, con historial y sin avisos enviados', () => {
  const o = promo();
  assert.equal(o.verification, 'pending'); assert.equal(o.stage, 'detected'); assert.deepEqual(o.notified, []);
  assert.equal(o.history[0]!.event, 'detected'); assert.equal(opportunityStatus(o, NOW), 'pending');
  assert.throws(() => createOpportunity({ provider: 'X', title: 'Oferta', verification: 'verified' }, { id: 'x', now: NOW }), /official source/);
  assert.throws(() => createOpportunity({ provider: 'X', title: 'Oferta', sourceUrl: 'http://inseguro.example' }, { id: 'x', now: NOW }), /https/);
  assert.throws(() => createOpportunity({ provider: 'X', title: 'Oferta', startsAt: '2026-11-10', expiresAt: '2026-11-01' }, { id: 'x', now: NOW }), /before/);
});

test('fecha de caducidad: el estado «caducada» se deriva de la fecha y deja de puntuar y de avisar', () => {
  const o = promo();
  assert.equal(opportunityStatus(o, '2026-11-17T07:58:00Z'), 'pending');
  assert.equal(opportunityStatus(o, '2026-11-17T08:00:00Z'), 'expired');
  assert.equal(scoreOpportunity(o, '2026-11-18T00:00:00Z').score, 0);
  assert.deepEqual(dueOpportunityAlerts([o], '2026-11-18T00:00:00Z'), []);
});

test('alerta por vencimiento próximo: 72 h y 24 h, una sola vez cada una', () => {
  let o = advanceStage(promo(), 'activated', NOW);
  assert.deepEqual(dueOpportunityAlerts([o], NOW).map((a) => a.key), [], 'faltan más de 72 h y ya está activada');
  const at72 = '2026-11-14T10:00:00Z';
  assert.deepEqual(dueOpportunityAlerts([o], at72).map((a) => a.key), ['expires-72h']);
  o = markNotified(o, 'expires-72h', at72);
  assert.deepEqual(dueOpportunityAlerts([o], at72), []);
  const at24 = '2026-11-16T12:00:00Z';
  const alerts = dueOpportunityAlerts([o], at24);
  assert.deepEqual(alerts.map((a) => a.key), ['expires-24h']); assert.equal(alerts[0]!.severity, 'critical');
});

test('oportunidad crítica sin activar: avisa ya, sin esperar al resumen semanal', () => {
  const o = promo({ verification: 'verified', sourceUrl: 'https://www.anthropic.com/news' });
  const s = scoreOpportunity(o, NOW);
  assert.ok(s.priority === 'critical' || s.priority === 'high', `prioridad ${s.priority} (${s.score})`);
  assert.equal(dueOpportunityAlerts([o], NOW)[0]!.key, 'new');
  const cheap = scoreOpportunity(promo({ benefit: 5, cost: 'none' }), NOW).score, costly = scoreOpportunity(promo({ benefit: 5, cost: 'high', risk: 5, compatible: false }), NOW).score;
  assert.ok(cheap > costly, 'coste, riesgo e incompatibilidad restan prioridad');
});

test('duplicados: la misma oferta contada de otra forma no crea un segundo registro', () => {
  assert.equal(opportunityFingerprint('Anthropic', 'Claude Fable 5.2 incluido en Pro'), opportunityFingerprint('ANTHROPIC', '  Fable 5.2 — Claude, incluido en PRO '));
  assert.notEqual(opportunityFingerprint('Anthropic', 'Fable 5.2 en Pro'), opportunityFingerprint('OpenAI', 'Fable 5.2 en Pro'));
  const a = advanceStage(markNotified(promo(), 'new', NOW), 'activated', NOW);
  const again = promo();
  const { opportunity, changed } = mergeOpportunity(a, again, '2026-11-11T09:00:00Z');
  assert.deepEqual(changed, []); assert.equal(opportunity.stage, 'activated'); assert.deepEqual(opportunity.notified, ['new']);
  assert.equal(opportunity.id, a.id); assert.equal(opportunity.updatedAt, a.updatedAt);
});

test('cambio de condiciones: se anota en el historial y reabre los avisos de vencimiento', () => {
  const a = markNotified(markNotified(promo(), 'new', NOW), 'expires-72h', NOW);
  const { opportunity, changed } = mergeOpportunity(a, promo({ expiresAt: '2026-11-20T07:59:00Z', conditions: 'Hasta el 50 % del límite semanal' }), '2026-11-12T09:00:00Z');
  assert.deepEqual(changed.sort(), ['conditions', 'expiresAt']);
  assert.equal(opportunity.expiresAt, '2026-11-20T07:59:00.000Z');
  assert.deepEqual(opportunity.notified, ['new'], 'el aviso de 72 h vuelve a estar pendiente con la fecha nueva');
  assert.equal(opportunity.history.at(-1)!.event, 'conditions_changed');
  const verified = mergeOpportunity(a, promo({ verification: 'verified', sourceUrl: 'https://support.claude.com/en/articles/1' }), NOW).opportunity;
  assert.equal(verified.verification, 'verified');
  assert.equal(mergeOpportunity(verified, promo(), NOW).opportunity.verification, 'verified', 'nunca se degrada a pendiente');
});

test('aprovechamiento real: detectada → activada → utilizada → finalizada, sin retrocesos', () => {
  let o = promo();
  o = advanceStage(o, 'activated', NOW); o = advanceStage(o, 'used', NOW);
  assert.throws(() => advanceStage(o, 'detected', NOW), /backwards/);
  o = advanceStage(o, 'finished', NOW);
  assert.throws(() => advanceStage(o, 'used', NOW), /closed/);
  assert.throws(() => advanceStage(promo(), 'dismissed', NOW), /reason/);
  assert.equal(advanceStage(promo(), 'dismissed', NOW, 'No aplica a nuestro plan').stage, 'dismissed');
  assert.equal(verifyOpportunity(promo(), 'https://support.claude.com/en/articles/1', NOW).verification, 'verified');
});

test('incidencia de detección tardía: la comunicó el propietario y no el monitor', () => {
  const late = lateDetection(promo());
  assert.equal(late.late, true); assert.match(late.reason, /propietario/);
  const byMonitor = createOpportunity({ provider: 'OpenAI', title: 'Créditos de lanzamiento', detectedBy: 'monitor', publishedAt: NOW }, { id: 'm', now: NOW });
  assert.equal(lateDetection(byMonitor).late, false);
});

test('límites y restablecimiento de cupo: la fecha de fin no es el tiempo efectivo de trabajo', () => {
  const weekly = validateQuotaWindow({ id: 'q1', account: 'Claude Pro', kind: 'weekly', label: 'Cupo semanal', usedPercent: 70, resetsAt: '2026-11-14T14:00:00Z', verified: false }, NOW);
  const short = validateQuotaWindow({ id: 'q2', account: 'Claude Pro', kind: 'short', label: 'Ventana de 5 h' }, NOW);
  const plan = planUtilization(promo(), [weekly, short], NOW);
  assert.deepEqual(plan.phases.map((p) => p.id), ['A', 'B']);
  assert.equal(plan.phases[0]!.to, '2026-11-14T14:00:00.000Z'); assert.equal(plan.phases[1]!.to, '2026-11-17T07:59:00.000Z');
  assert.equal(plan.phases[0]!.hours, 90); assert.equal(plan.resetVerified, false);
  assert.match(plan.phases[0]!.capacity, /30 %.*sin verificar/);
  assert.ok(plan.warnings.some((w) => /sin verificar/.test(w)) && plan.warnings.some((w) => /ventanas cortas/.test(w)));
  assert.throws(() => validateQuotaWindow({ id: 'q', account: 'A', label: 'L', usedPercent: 140 }, NOW), /between/);
  assert.throws(() => validateQuotaWindow({ id: 'q', account: 'A', label: 'L', resetsAt: 'pronto' }, NOW), /valid date/);
});

test('falta de datos: sin cupos ni fecha el plan lo dice en vez de inventar', () => {
  const noQuota = planUtilization(promo(), [], NOW);
  assert.deepEqual(noQuota.phases.map((p) => p.id), ['A']); assert.match(noQuota.phases[0]!.capacity, /desconocido/);
  assert.ok(noQuota.warnings.some((w) => /No hay cupos/.test(w)));
  const noDate = planUtilization(promo({ expiresAt: undefined, startsAt: undefined }), [], NOW);
  assert.deepEqual(noDate.phases, []); assert.ok(noDate.warnings.some((w) => /fecha de fin/.test(w)));
  assert.equal(planUtilization(promo(), [], '2026-12-01T00:00:00Z').warnings[0], 'La promoción ya caducó.');
});

test('lectura de una fuente oficial: titulares con señales de oferta, sin duplicar y solo https', () => {
  const source = { id: 's', provider: 'Anthropic', label: 'News', url: 'https://www.anthropic.com/news' };
  const html = `<a href="/news/fable">Introducing Claude Fable 5.2 and Mythos 5.2</a>
    <a href="/news/fable">Introducing Claude Fable 5.2 and Mythos 5.2</a>
    <a href="https://www.anthropic.com/pro"><span>Fable is free for Pro users until November 16</span></a>
    <a href="/careers">Careers at the company and open roles</a>
    <a href="http://inseguro.example/x">Limited-time discount for everyone today</a>
    <a href="/x">Beta</a>`;
  const found = detectCandidates(html, source);
  assert.deepEqual(found.map((c) => c.kind), ['launch', 'free_trial']);
  assert.equal(found[0]!.url, 'https://www.anthropic.com/news/fable');
});

test('monitor: fuente inaccesible no rompe la pasada, cuenta fallos y no duplica en la siguiente', async () => {
  const saved = new Map<string, Opportunity>(); const states = new Map<string, RadarSourceState>(); let n = 0;
  const deps = {
    sources: [{ id: 'ok', provider: 'Anthropic', label: 'News', url: 'https://a.example/news' }, { id: 'down', provider: 'OpenAI', label: 'News', url: 'https://o.example/news' }],
    fetchText: async (url: string) => { if (url.includes('o.example')) throw new Error('HTTP 503'); return '<a href="/p">Free trial of the new model for Pro until Friday</a>'; },
    list: () => [...saved.values()], save: (o: Opportunity) => { saved.set(o.id, o); },
    previousState: (id: string) => states.get(id), saveState: (s: RadarSourceState) => { states.set(s.sourceId, s); },
    newId: () => `op-${++n}`, now: () => NOW,
  };
  const first = await runRadar(deps);
  assert.deepEqual(first.summary, { sources: 2, reachable: 1, created: 1, updated: 0, read: 1, failed: 1 });
  assert.equal(states.get('down')!.ok, false); assert.equal(states.get('down')!.detail, 'HTTP 503');
  const second = await runRadar(deps);
  assert.equal(second.summary.created, 0, 'la misma oferta no se crea dos veces'); assert.equal(saved.size, 1);
  assert.equal(states.get('down')!.consecutiveFailures, 2);
  assert.equal([...saved.values()][0]!.verification, 'pending'); assert.equal([...saved.values()][0]!.detectedBy, 'monitor');
});

test('fuentes configurables: solo https y con proveedor', () => {
  assert.equal(parseRadarSources(undefined).length, 3);
  assert.equal(parseRadarSources('[{"provider":"xAI","url":"https://x.ai/news"}]')[0]!.provider, 'xAI');
  assert.throws(() => parseRadarSources('[{"provider":"xAI","url":"http://x.ai/news"}]'), /https/);
  assert.throws(() => parseRadarSources('{}'), /array/);
});

test('vista del dashboard: ordena por prioridad, separa verificadas, pendientes y caducadas', () => {
  const live = promo({ verification: 'verified', sourceUrl: 'https://www.anthropic.com/news' });
  const old = createOpportunity({ provider: 'Google', title: 'Créditos de prueba', expiresAt: '2026-11-01T00:00:00Z' }, { id: 'op-2', now: '2026-10-20T00:00:00Z' });
  const maybe = createOpportunity({ provider: 'OpenAI', title: 'Acceso anticipado a herramienta', benefit: 2 }, { id: 'op-3', now: NOW });
  const view = buildRadarView([old, maybe, live], [], NOW);
  assert.deepEqual(view.opportunities.map((o) => o.id), ['op-1', 'op-3', 'op-2']);
  assert.deepEqual(view.counts, { open: 2, verified: 1, pending: 1, expired: 1, critical: view.counts.critical });
  assert.equal(view.plan!.opportunityId, 'op-1'); assert.ok(view.alerts.some((a) => a.opportunityId === 'op-1'));
});
