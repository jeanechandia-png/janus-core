import assert from 'node:assert/strict';
import test from 'node:test';
import { FallbackModelRouter } from '../packages/gateways/src/model-router.js';
import { ModelBudgetExceededError } from '../packages/gateways/src/budgeted-model-gateway.js';
import type { ModelGateway, ModelRequest, ModelResponse } from '../packages/gateways/src/contracts.js';
import { validateCoordinationAssignment, type CoordinationAssignment } from '../packages/core/src/operator-coordination.js';
import { localDayKey, operatorDailyUsage, parseOperatorDailyRuns } from '../packages/core/src/operator-usage-limit.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

const calls: string[] = [];
const provider = (id: string, fail?: Error): { id: string; gateway: ModelGateway } => ({
  id,
  gateway: { complete: async (_request: ModelRequest) => { calls.push(id); if (fail) throw fail; return { text: `de ${id}` } as ModelResponse; } },
});
const request = { messages: [{ role: 'user', content: 'hola' }] } as unknown as ModelRequest;

test('delegación por tarea: el agente preferido va primero y el resto queda de respaldo', async () => {
  const router = new FallbackModelRouter([provider('custom'), provider('openai'), provider('anthropic'), provider('gemini')]);
  const preferred = router.withPreference('anthropic');
  assert.deepEqual(preferred.providerIds(), ['anthropic', 'custom', 'openai', 'gemini']);
  assert.deepEqual(router.providerIds(), ['custom', 'openai', 'anthropic', 'gemini'], 'el enrutador compartido no se altera');
  calls.length = 0;
  assert.equal((await preferred.complete(request)).provider, 'anthropic');
  assert.deepEqual(calls, ['anthropic']);
});

test('si el agente preferido falla, la tarea continúa con las alternativas', async () => {
  const router = new FallbackModelRouter([provider('custom'), provider('gemini', new Error('sin saldo'))]).withPreference('gemini');
  calls.length = 0;
  const response = await router.complete(request);
  assert.equal(response.provider, 'custom');
  assert.deepEqual(calls, ['gemini', 'custom']);
  assert.deepEqual(router.lastAttempts().map((attempt) => [attempt.provider, attempt.ok]), [['gemini', false], ['custom', true]]);
});

test('preferencia desconocida o no configurada: se conserva el orden y no falla', () => {
  const router = new FallbackModelRouter([provider('custom'), provider('openai')]);
  assert.deepEqual(router.withPreference('gemini').providerIds(), ['custom', 'openai']);
  assert.deepEqual(router.withPreference(undefined).providerIds(), ['custom', 'openai']);
});

test('un rechazo por presupuesto NO se esquiva probando otro proveedor', async () => {
  const router = new FallbackModelRouter([provider('anthropic', new ModelBudgetExceededError(1)), provider('openai')]).withPreference('anthropic');
  calls.length = 0;
  await assert.rejects(() => router.complete(request), ModelBudgetExceededError);
  assert.deepEqual(calls, ['anthropic']);
});

test('la tarea solo admite agentes conocidos', () => {
  const base: CoordinationAssignment = {
    id: 'a1', title: 't', goal: 'g', assigneePrincipalId: 'w', scopeIds: ['s'], status: 'queued', priority: 'normal',
    createdBy: 'founder', createdAt: '2026-11-10T09:00:00Z', updatedAt: '2026-11-10T09:00:00Z', nextActions: [],
  };
  assert.equal(validateCoordinationAssignment({ ...base, preferredProvider: 'anthropic' }).preferredProvider, 'anthropic');
  assert.equal(validateCoordinationAssignment(base).preferredProvider, undefined);
  assert.throws(() => validateCoordinationAssignment({ ...base, preferredProvider: 'skynet' as never }), /preferredProvider/);
});

test('límite diario: cuenta por día natural de la zona horaria de JANUS', () => {
  const tz = 'Europe/Amsterdam';
  // 23:30 UTC del día 9 ya es día 10 en Ámsterdam (UTC+1).
  assert.equal(localDayKey('2026-11-09T23:30:00Z', tz), '2026-11-10');
  const stamps = ['2026-11-09T22:00:00Z', '2026-11-09T23:30:00Z', '2026-11-10T08:00:00Z'];
  const usage = operatorDailyUsage({ runTimestamps: stamps, now: '2026-11-10T12:00:00Z', timeZone: tz, limit: 3 });
  assert.deepEqual({ used: usage.used, remaining: usage.remaining, allowed: usage.allowed }, { used: 2, remaining: 1, allowed: true });
  assert.equal(operatorDailyUsage({ runTimestamps: [...stamps, '2026-11-10T09:00:00Z'], now: '2026-11-10T12:00:00Z', timeZone: tz, limit: 3 }).allowed, false);
  const unlimited = operatorDailyUsage({ runTimestamps: stamps, now: '2026-11-10T12:00:00Z', timeZone: tz, limit: 0 });
  assert.equal(unlimited.allowed, true); assert.equal(unlimited.remaining, null);
});

test('límite diario: configuración tolerante y registro durable por persona', () => {
  assert.equal(parseOperatorDailyRuns(undefined), 60);
  assert.equal(parseOperatorDailyRuns('25'), 25);
  assert.equal(parseOperatorDailyRuns('0'), 0);
  assert.equal(parseOperatorDailyRuns('abc'), 60);
  assert.equal(parseOperatorDailyRuns('-4'), 60);
  const store = new SqliteStore(':memory:');
  store.appendOperatorRun({ runId: 'r1', principalId: 'w1', at: '2026-11-10T08:00:00.000Z' });
  store.appendOperatorRun({ runId: 'r1', principalId: 'w1', at: '2026-11-10T08:00:01.000Z' }); // reintento: no duplica
  store.appendOperatorRun({ runId: 'r2', principalId: 'w2', at: '2026-11-10T08:05:00.000Z' });
  assert.deepEqual(store.listOperatorRunTimes('w1', '2026-11-09T00:00:00.000Z'), ['2026-11-10T08:00:00.000Z']);
  assert.equal(store.listOperatorRunTimes('w1', '2026-11-11T00:00:00.000Z').length, 0);
  assert.equal(store.listOperatorRunTimes('w2', '2026-11-09T00:00:00.000Z').length, 1);
});
