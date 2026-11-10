import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PRESENCE_ONLINE_WINDOW_MS,
  PRESENCE_WORKING_GRACE_MS,
  WorkPresenceTracker,
  resolveWorkPresence,
} from '../packages/core/src/work-presence.js';

const NOW = Date.parse('2026-11-10T20:30:00Z');
const running = { state: 'running' as const, startedAt: '2026-11-10T19:00:00Z' };
const paused = { state: 'paused' as const, startedAt: '2026-11-10T19:00:00Z' };

test('una luz verde exige sesión en marcha Y señal reciente', () => {
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: NOW - 20_000, nowMs: NOW }).state, 'working');
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: NOW - PRESENCE_WORKING_GRACE_MS, nowMs: NOW }).state, 'working');
});

test('sesión en marcha sin señal no se afirma como «trabajando»', () => {
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: NOW - PRESENCE_WORKING_GRACE_MS - 1000, nowMs: NOW }).state, 'unconfirmed');
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: undefined, nowMs: NOW }).state, 'unconfirmed', 'tras reiniciar JANUS no hay señal aún');
});

test('pausa, conectada y desconectada', () => {
  assert.equal(resolveWorkPresence({ session: paused, lastSeenMs: undefined, nowMs: NOW }).state, 'paused');
  assert.equal(resolveWorkPresence({ session: null, lastSeenMs: NOW - 30_000, nowMs: NOW }).state, 'online');
  assert.equal(resolveWorkPresence({ session: null, lastSeenMs: NOW - PRESENCE_ONLINE_WINDOW_MS - 1, nowMs: NOW }).state, 'offline');
  assert.equal(resolveWorkPresence({ session: null, lastSeenMs: undefined, nowMs: NOW }).state, 'offline');
  assert.equal(resolveWorkPresence({ session: { state: 'ended', startedAt: '2026-11-10T09:00:00Z' }, lastSeenMs: NOW - 10_000, nowMs: NOW }).state, 'online', 'una sesión terminada no cuenta');
});

test('un reloj atrasado no produce edades negativas y se informa la antigüedad en segundos', () => {
  const p = resolveWorkPresence({ session: null, lastSeenMs: NOW + 5000, nowMs: NOW });
  assert.equal(p.seenSecondsAgo, 0); assert.equal(p.state, 'online');
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: NOW - 42_000, nowMs: NOW }).seenSecondsAgo, 42);
  assert.equal(resolveWorkPresence({ session: running, lastSeenMs: undefined, nowMs: NOW }).seenSecondsAgo, null);
});

test('el registro de presencia es solo memoria y está acotado', () => {
  const tracker = new WorkPresenceTracker(3);
  for (const id of ['a', 'b', 'c', 'd']) tracker.touch(id, NOW);
  assert.equal(tracker.lastSeen('a'), undefined, 'la más antigua se descarta');
  assert.equal(tracker.lastSeen('d'), NOW);
  tracker.touch('b', NOW + 1000); tracker.touch('e', NOW + 2000);
  assert.equal(tracker.lastSeen('b'), NOW + 1000); assert.equal(tracker.lastSeen('c'), undefined);
  tracker.forget('b'); assert.equal(tracker.lastSeen('b'), undefined);
  tracker.touch('', NOW); assert.equal(tracker.lastSeen(''), undefined);
});
