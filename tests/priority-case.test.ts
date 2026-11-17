import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeAlert, addCaseNote, attachTranslation, caseView, createPriorityCase, decideNextAction, detectSignals, gmailQueryFor,
  ingestMessages, matchMessage, setCaseStatus, setMonitoring, type MailMessage,
} from '../packages/core/src/priority-case.js';

// Caso FICTICIO: ningún dato real entra en el repositorio.
const NOW = '2026-03-02T10:00:00Z';
const make = () => createPriorityCase({ id: 'caso-demo', title: 'Reclamación al ayuntamiento', ownerPrincipalId: 'founder', nextAction: 'Esperar respuesta',
  thread: { account: 'dueno@example.com', threadId: 'abc123def456', messageId: 'abc123def456', subject: 'Verzoek om contact – Voorbeeldstraat', sentAt: '2026-03-01T09:00:00Z',
    counterpart: { name: 'Agente Ejemplo', email: 'agente@gemeente.example' }, keywords: ['Voorbeeldstraat'] } }, NOW);
const msg = (over: Partial<MailMessage>): MailMessage => ({ id: 'm1', threadId: 'abc123def456', from: 'Agente Ejemplo <agente@gemeente.example>', subject: 'RE: Verzoek om contact', date: '2026-03-03T08:00:00Z', snippet: 'Dank voor uw bericht.', ...over });

test('un caso nace esperando respuesta, con conexión pendiente y su correo en el historial', () => {
  const c = make();
  assert.equal(c.priority, 'high'); assert.equal(c.status, 'waiting_reply'); assert.equal(c.monitoring.state, 'connection_pending');
  assert.deepEqual(c.timeline.map((e) => e.kind), ['sent', 'created']); assert.deepEqual(c.thread!.relatedDomains, ['gemeente.example']);
  assert.equal(caseView(c).monitoringLabel, 'Conexión pendiente', 'nunca «Monitorización activa» sin conexión');
  assert.equal(caseView(c).gmailUrl, 'https://mail.google.com/mail/?authuser=dueno%40example.com#all/abc123def456');
  assert.equal(gmailQueryFor(c), 'from:(@gemeente.example) after:2026/03/01');
  assert.throws(() => createPriorityCase({ id: 'x', title: 'T', ownerPrincipalId: 'f' }, NOW), /id/);
  assert.throws(() => createPriorityCase({ id: 'caso', title: 'T', ownerPrincipalId: 'f', thread: { account: 'no-es-correo' } as never }, NOW), /email/);
});

test('identifica el hilo correcto y no asocia correos ajenos', () => {
  const c = make();
  assert.equal(matchMessage(c, msg({})), 'thread');
  assert.equal(matchMessage(c, msg({ threadId: 'otro', from: 'agente@gemeente.example' })), 'related', 'misma agente, hilo nuevo');
  assert.equal(matchMessage(c, msg({ threadId: 'otro', from: 'balie@gemeente.example', subject: 'Uw melding Voorbeeldstraat' })), 'related', 'dominio oficial + palabra del caso');
  assert.equal(matchMessage(c, msg({ threadId: 'otro', from: 'nieuwsbrief@gemeente.example', subject: 'Nieuwsbrief maart' })), null, 'mismo dominio, sin relación');
  assert.equal(matchMessage(c, msg({ threadId: 'otro', from: 'agente@gemeente.example.evil.test', subject: 'Voorbeeldstraat' })), null, 'dominio parecido no vale');
  assert.equal(matchMessage(c, msg({ from: 'dueno@example.com' })), null, 'lo que envía el dueño no es una respuesta');
});

test('mensajes nuevos: una entrada y sus alertas, sin duplicar al volver a consultar', () => {
  const first = ingestMessages(make(), [msg({})], '2026-03-03T08:05:00Z');
  assert.equal(first.added.length, 1); assert.deepEqual(first.alerts.map((a) => a.key), ['m1:reply']);
  assert.equal(first.case.status, 'reply_received'); assert.equal(first.case.nextAction!.state, 'pending_approval');
  const again = ingestMessages(first.case, [msg({})], '2026-03-03T08:15:00Z');
  assert.equal(again.added.length, 0); assert.equal(again.alerts.length, 0); assert.equal(again.case.alerts.length, 1);
  assert.equal(again.case.updatedAt, first.case.updatedAt);
});

test('citas, plazos y documentación generan alertas propias y cambian el estado', () => {
  assert.deepEqual(detectSignals('Wij nodigen u uit voor een afspraak op het bureau; neem uw identiteitsbewijs mee, uiterlijk vrijdag.').sort(), ['appointment', 'deadline', 'documents']);
  const r = ingestMessages(make(), [msg({ id: 'm2', snippet: 'U kunt een afspraak maken voor de aangifte. Neem documenten mee.' })], NOW);
  assert.deepEqual(r.alerts.map((a) => a.signal).sort(), ['appointment', 'documents', 'important', 'reply']);
  assert.equal(r.case.status, 'scheduled'); assert.equal(r.added[0]!.original, 'U kunt een afspraak maken voor de aangifte. Neem documenten mee.');
  const docs = ingestMessages(make(), [msg({ id: 'm3', snippet: 'Kunt u foto\'s aanleveren?' })], NOW);
  assert.equal(docs.case.status, 'action_needed');
});

test('historial auditable: notas, estado, decisión sobre la próxima acción, alertas vistas y traducción', () => {
  let c = ingestMessages(make(), [msg({})], NOW).case;
  c = addCaseNote(c, 'Llamé por teléfono; no contestaron.', '2026-03-04T09:00:00Z');
  c = decideNextAction(c, 'approved', '2026-03-04T09:05:00Z');
  assert.equal(c.nextAction!.state, 'approved'); assert.equal(c.timeline.at(-1)!.kind, 'next_action');
  c = decideNextAction(c, 'done', '2026-03-04T10:00:00Z');
  assert.throws(() => decideNextAction(c, 'approved', NOW), /closed/);
  c = acknowledgeAlert(c, 'm1:reply', NOW); assert.equal(caseView(c).pendingAlerts, 0);
  assert.throws(() => acknowledgeAlert(c, 'no:existe', NOW), /not found/);
  const reply = c.timeline.find((e) => e.kind === 'reply')!;
  c = attachTranslation(c, reply.id, 'Gracias por su mensaje.', NOW);
  assert.equal(c.timeline.find((e) => e.id === reply.id)!.translation, 'Gracias por su mensaje.');
  assert.equal(c.timeline.find((e) => e.id === reply.id)!.original, 'Dank voor uw bericht.', 'el original se conserva');
  c = setCaseStatus(c, 'closed', NOW, 'resuelto');
  assert.equal(ingestMessages(c, [msg({ id: 'm9' })], NOW).added.length, 0, 'un caso cerrado no sigue vigilando');
  assert.equal(caseView(c).timeline[0]!.at >= caseView(c).timeline.at(-1)!.at, true, 'la vista ordena de lo más reciente a lo más antiguo');
});

test('estado de conexión real: activa solo tras una lectura correcta; el error se muestra', () => {
  let c = setMonitoring(make(), 'active', NOW);
  assert.equal(caseView(c).monitoringLabel, 'Monitorización activa'); assert.equal(c.monitoring.lastCheckedAt, '2026-03-02T10:00:00.000Z');
  c = setMonitoring(c, 'error', NOW, 'HTTP 401');
  assert.equal(caseView(c).monitoringLabel, 'Error de conexión'); assert.equal(c.monitoring.detail, 'HTTP 401');
});
