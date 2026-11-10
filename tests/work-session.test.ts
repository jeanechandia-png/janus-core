import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextWorkSessionEvent,
  openWorkSession,
  summarizeWorkSessions,
  validateWorkSessionEvent,
  type WorkSessionEvent,
} from '../packages/core/src/work-session.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

const T = (minute: number) => new Date(Date.UTC(2026, 10, 10, 9, minute, 0)).toISOString();

function run(steps: Array<[WorkSessionEvent['kind'], number, string?]>, principalId = 'worker-1'): WorkSessionEvent[] {
  const events: WorkSessionEvent[] = [];
  for (const [kind, minute, note] of steps) {
    events.push(nextWorkSessionEvent({ events, principalId, kind, at: T(minute), ...(note ? { note } : {}) }));
  }
  return events;
}

test('una sesión cuenta el tiempo activo sin las pausas y conserva avances, bloqueos y entregas', () => {
  const events = run([
    ['start', 0], ['progress', 20, 'Filtro de permisos en verde'], ['pause', 30], ['resume', 45],
    ['blocker', 50, 'Falta la autorización de carga'], ['delivery', 70, 'Listado paginado'], ['end', 75],
  ]);
  const [session] = summarizeWorkSessions(events, 'worker-1', T(200));
  assert.ok(session);
  assert.equal(session.state, 'ended');
  assert.equal(session.activeSeconds, 60 * 60);
  assert.equal(session.pausedSeconds, 15 * 60);
  assert.equal(session.pauses, 1);
  assert.deepEqual(session.progress.map((item) => item.note), ['Filtro de permisos en verde']);
  assert.deepEqual(session.blockers.map((item) => item.note), ['Falta la autorización de carga']);
  assert.deepEqual(session.deliveries.map((item) => item.note), ['Listado paginado']);
});

test('una sesión abierta sigue contando hasta "ahora" y refleja si está en pausa', () => {
  const running = run([['start', 0]]);
  assert.equal(summarizeWorkSessions(running, 'worker-1', T(10))[0]?.activeSeconds, 600);
  const paused = run([['start', 0], ['pause', 5]]);
  const summary = summarizeWorkSessions(paused, 'worker-1', T(25))[0];
  assert.equal(summary?.state, 'paused');
  assert.equal(summary?.activeSeconds, 300);
  assert.equal(summary?.pausedSeconds, 1200);
  assert.deepEqual(openWorkSession(paused, 'worker-1')?.state, 'paused');
});

test('transiciones inválidas se rechazan con un código legible', () => {
  assert.throws(() => run([['pause', 0]]), /work_session_not_open/);
  assert.throws(() => run([['start', 0], ['start', 1]]), /work_session_already_open/);
  assert.throws(() => run([['start', 0], ['resume', 1]]), /work_session_not_paused/);
  assert.throws(() => run([['start', 0], ['pause', 1], ['pause', 2]]), /work_session_not_running/);
  assert.throws(() => run([['start', 10], ['pause', 5]]), /work_session_time_regression/);
  assert.throws(() => run([['start', 0], ['progress', 1]]), /requires a note/);
  assert.throws(() => run([['start', 0], ['end', 1], ['pause', 2]]), /work_session_not_open/);
});

test('tras finalizar se puede abrir otra sesión y nadie ve ni altera las de otra persona', () => {
  const mine = run([['start', 0], ['end', 10], ['start', 20]]);
  const theirs = run([['start', 0]], 'worker-2');
  const all = [...mine, ...theirs];
  assert.equal(summarizeWorkSessions(all, 'worker-1', T(30)).length, 2);
  assert.equal(summarizeWorkSessions(all, 'worker-2', T(30)).length, 1);
  // La sesión abierta de worker-2 no impide ni se mezcla con la de worker-1.
  const next = nextWorkSessionEvent({ events: all, principalId: 'worker-1', kind: 'pause', at: T(25) });
  assert.equal(next.sessionId, mine[2]?.sessionId);
  assert.equal(summarizeWorkSessions(all, 'worker-3', T(30)).length, 0);
});

test('validación: notas y evidencias acotadas, identificadores seguros', () => {
  const base: WorkSessionEvent = { id: 'wse_1', sessionId: 'ws_1', principalId: 'worker-1', kind: 'progress', at: T(0), note: 'ok' };
  assert.throws(() => validateWorkSessionEvent({ ...base, note: 'x'.repeat(2001) }), /too long/);
  assert.throws(() => validateWorkSessionEvent({ ...base, id: 'bad id' }), /event id is invalid/);
  assert.throws(() => validateWorkSessionEvent({ ...base, projectId: '../etc' }), /project id is invalid/);
  assert.throws(() => validateWorkSessionEvent({ ...base, evidenceRefs: Array.from({ length: 13 }, (_, i) => `e${i}`) }), /too many evidence/);
  assert.throws(() => validateWorkSessionEvent({ ...base, at: 'ayer' }), /time is invalid/);
  assert.deepEqual(validateWorkSessionEvent({ ...base, evidenceRefs: [' commit abc ', ''] }).evidenceRefs, ['commit abc']);
});

test('SQLite: el registro es append-only, idempotente por id y se lee por persona', () => {
  const store = new SqliteStore(':memory:');
  const events = [...run([['start', 0], ['progress', 5, 'avance'], ['end', 9]]), ...run([['start', 1]], 'worker-2')];
  for (const event of events) store.appendWorkSessionEvent(event);
  // Reintento con el mismo id y contenido distinto: no sobrescribe.
  store.appendWorkSessionEvent({ ...events[1]!, note: 'manipulado' });
  const mine = store.listWorkSessionEvents('worker-1');
  assert.equal(mine.length, 3);
  assert.equal(mine[1]?.note, 'avance');
  assert.equal(store.listWorkSessionEvents('worker-2').length, 1);
  assert.equal(store.listWorkSessionEvents().length, 4);
  assert.equal(summarizeWorkSessions(mine, 'worker-1', T(60))[0]?.state, 'ended');
});
