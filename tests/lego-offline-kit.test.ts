import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OUTBOX_POLICY, decide, dueItems, enqueue, evaluateCapabilities, freshness, initialConnectivity, offlineSummary, outboxCounts, recordProbe,
  revalidate, settle, type CapabilitySpec, type OutboxItem,
} from '../packages/modules/offline-kit/src/index.js';

const T = (minutes: number): string => new Date(Date.UTC(2026, 10, 15, 12, 0, 0) + minutes * 60_000).toISOString();

test('conectividad: un fallo suelto no desconecta; dos seguidos sí; un acierto reconecta', () => {
  let c = initialConnectivity(T(0));
  assert.equal(c.state, 'unknown');
  c = recordProbe(c, true, T(1)); assert.equal(c.state, 'online'); assert.equal(c.since, T(1));
  c = recordProbe(c, false, T(2)); assert.equal(c.state, 'online', 'un solo fallo no cambia el estado');
  c = recordProbe(c, false, T(3)); assert.equal(c.state, 'offline'); assert.equal(c.since, T(3));
  c = recordProbe(c, false, T(4)); assert.equal(c.since, T(3), 'no reinicia el «desde»');
  c = recordProbe(c, true, T(5)); assert.equal(c.state, 'online'); assert.equal(c.consecutiveFailures, 0);
});

const SPECS: CapabilitySpec[] = [
  { id: 'notes', label: 'Notas', needs: 'device' },
  { id: 'phone', label: 'Abrir desde el móvil', needs: 'local_network' },
  { id: 'chat', label: 'Conversar', needs: 'internet', localResource: 'local_model', offlineFallback: 'Sin internet responde con funciones básicas, sin IA.' },
  { id: 'mail', label: 'Enviar correo', needs: 'internet', queuesChanges: true },
  { id: 'calls', label: 'Teléfono', needs: 'internet' },
];

test('capacidades: solo se promete sin internet lo que no necesita red o tiene recurso local', () => {
  const none = offlineSummary(SPECS, {});
  assert.deepEqual(none.works.map((v) => v.id), ['notes']);
  assert.deepEqual(none.degraded.map((v) => v.id), ['chat', 'mail']);
  assert.deepEqual(none.unavailable.map((v) => v.id), ['phone', 'calls']);
  const withModel = offlineSummary(SPECS, { local_model: true }, true);
  assert.deepEqual(withModel.works.map((v) => v.id), ['notes', 'phone', 'chat']);
  assert.ok(evaluateCapabilities(SPECS, { internet: true, localNetwork: true, resources: {} }).every((v) => v.status === 'works'));
});

test('bandeja de salida: orden, idempotencia y rechazo de entradas no válidas', () => {
  let box: OutboxItem[] = [];
  box = [...box, enqueue(box, { id: 'a_1', kind: 'note.create', summary: 'Nota 1', payload: { t: 1 }, now: T(0) })];
  box = [...box, enqueue(box, { id: 'a_2', kind: 'mail.send', summary: 'Correo', payload: {}, sensitive: true, now: T(1) })];
  box = [...box, enqueue(box, { id: 'a_3', kind: 'note.create', summary: 'Nota 2', payload: {}, idempotencyKey: 'k-3', now: T(2) })];
  assert.equal(box[0]!.idempotencyKey, 'a_1'); assert.equal(box[2]!.idempotencyKey, 'k-3');
  assert.throws(() => enqueue(box, { id: 'a_1', kind: 'note.create', summary: 'x', payload: {}, now: T(3) }), /already exists/);
  assert.throws(() => enqueue(box, { id: 'a_9', kind: 'Bad Kind', summary: 'x', payload: {}, now: T(3) }), /kind/);
  assert.throws(() => enqueue(box, { id: 'a_9', kind: 'x.y', summary: '', payload: {}, now: T(3) }), /summary/);
  const circular: Record<string, unknown> = {}; circular.self = circular;
  assert.throws(() => enqueue(box, { id: 'a_9', kind: 'x.y', summary: 'x', payload: circular, now: T(3) }), /JSON/);
  assert.throws(() => enqueue(box, { id: 'a_9', kind: 'x.y', summary: 'x', payload: {}, now: T(3) }, { ...DEFAULT_OUTBOX_POLICY, maxItems: 3 }), /full/);
  assert.deepEqual(dueItems(box, T(5)).map((i) => i.id), ['a_1', 'a_2', 'a_3']);
});

test('revalidar al reconectar: lo delicado y lo viejo no se envían solos', () => {
  let box: OutboxItem[] = [];
  box = [...box, enqueue(box, { id: 'b_1', kind: 'note.create', summary: 'Nota vieja', payload: {}, now: T(-60 * 30) })];
  box = [...box, enqueue(box, { id: 'b_2', kind: 'mail.send', summary: 'Correo', payload: {}, sensitive: true, now: T(-5) })];
  box = [...box, enqueue(box, { id: 'b_3', kind: 'note.create', summary: 'Nota reciente', payload: {}, now: T(-5) })];
  const after = revalidate(box, T(0));
  assert.deepEqual(after.map((i) => i.state), ['needs_review', 'needs_review', 'queued']);
  assert.deepEqual(dueItems(after, T(0)).map((i) => i.id), ['b_3']);
  assert.equal(box[0]!.state, 'queued', 'no muta la entrada');
  const approved = decide(after[1]!, 'send', T(1));
  assert.equal(approved.state, 'queued'); assert.equal(approved.sensitive, false);
  assert.deepEqual(revalidate([approved], T(2)).map((i) => i.state), ['queued'], 'una vez confirmado ya no vuelve a revisión');
  assert.equal(decide(after[0]!, 'discard', T(1)).state, 'discarded');
  assert.throws(() => decide(after[2]!, 'send', T(1)), /only items in review/);
  assert.deepEqual(outboxCounts(after), { queued: 1, sent: 0, needs_review: 2, failed: 0, discarded: 0 });
});

test('envío: éxito, rechazo definitivo y reintentos con espera creciente hasta pedir revisión', () => {
  const item = enqueue([], { id: 'c_1', kind: 'note.create', summary: 'Nota', payload: {}, now: T(0) });
  assert.equal(settle(item, { ok: true }, T(1)).state, 'sent');
  const rejected = settle(item, { ok: false, retryable: false, error: '422 datos no válidos' }, T(1));
  assert.equal(rejected.state, 'failed'); assert.match(rejected.lastError!, /422/);
  let retry = item; const delays: number[] = [];
  for (let i = 0; i < DEFAULT_OUTBOX_POLICY.maxAttempts; i += 1) {
    const now = retry.nextAttemptAt;
    retry = settle(retry, { ok: false, retryable: true, error: 'sin red' }, now);
    if (retry.state === 'queued') delays.push(Date.parse(retry.nextAttemptAt) - Date.parse(now));
  }
  assert.deepEqual(delays, [5_000, 10_000, 20_000, 40_000, 80_000]);
  assert.equal(retry.state, 'needs_review'); assert.equal(retry.attempts, 6);
  assert.equal(settle(retry, { ok: true }, T(9)).state, 'needs_review', 'lo que no está en cola no se toca');
  assert.deepEqual(dueItems([settle(item, { ok: false, retryable: true, error: 'x' }, T(0))], T(0)), [], 'respeta la espera');
});

test('caché de lectura: reciente, antiguo o caducado', () => {
  assert.equal(freshness(T(0), T(2)).state, 'fresh');
  assert.equal(freshness(T(0), T(60)).state, 'stale');
  assert.equal(freshness(T(0), T(60 * 24 * 8)).state, 'expired');
  assert.equal(freshness(T(5), T(0)).ageMs, 0);
});
