import assert from 'node:assert/strict';
import test from 'node:test';
import {
  modelExecutionTier,
  planModelExecution,
  resolveModelProviders,
} from '../packages/core/src/model-provider-config.js';
import {
  CreditGuardedModelGateway,
  ExternalCreditCallLedger,
} from '../packages/gateways/src/credit-guarded-model-gateway.js';
import { FallbackModelRouter } from '../packages/gateways/src/model-router.js';
import { ModelBudgetExceededError } from '../packages/gateways/src/budgeted-model-gateway.js';
import type { ModelGateway, ModelRequest, ModelResponse } from '../packages/gateways/src/contracts.js';

const env = {
  JANUS_MODEL_BASE_URL: 'http://127.0.0.1:11434/v1',
  JANUS_MODEL_NAME: 'self-hosted-model',
  JANUS_OPENAI_API_KEY: 'FAKE_TEST_KEY',
  JANUS_OPENAI_MODEL: 'fake-model',
  JANUS_ANTHROPIC_API_KEY: 'FAKE_TEST_KEY',
  JANUS_ANTHROPIC_MODEL: 'fake-model',
  JANUS_MODEL_ORDER: 'anthropic,openai,custom',
};

test('configured commercial API keys alone never enable credit calls', () => {
  const configured = resolveModelProviders(env);
  assert.equal(configured[0]?.id, 'anthropic', 'legacy configured order may put remote first');
  const execution = planModelExecution(env);
  assert.deepEqual(execution.local.map((x) => x.id), ['custom']);
  assert.equal(execution.external.length, 0);
  assert.deepEqual(execution.blocked.map((x) => x.id), ['anthropic', 'openai']);
  assert.equal(execution.maxExternalCalls, 0);
});

test('only an explicit flag AND positive safe budget enable remote credit fallbacks', () => {
  for (const invalid of [
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true' },
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'TRUE', JANUS_MAX_EXTERNAL_MODEL_CALLS: '10' },
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true', JANUS_MAX_EXTERNAL_MODEL_CALLS: '0' },
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true', JANUS_MAX_EXTERNAL_MODEL_CALLS: 'NaN' },
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true', JANUS_MAX_EXTERNAL_MODEL_CALLS: '101' },
    { JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true', JANUS_MAX_EXTERNAL_MODEL_CALLS: '-1' },
  ]) {
    assert.equal(planModelExecution({ ...env, ...invalid }).maxExternalCalls, 0);
  }
  const allowed = planModelExecution({
    ...env,
    JANUS_ALLOW_EXTERNAL_MODEL_CREDITS: 'true',
    JANUS_MAX_EXTERNAL_MODEL_CALLS: '2',
  });
  assert.equal(allowed.maxExternalCalls, 2);
  assert.deepEqual(allowed.local.map((x) => x.id), ['custom']);
  assert.deepEqual(allowed.external.map((x) => x.id), ['anthropic', 'openai']);
});

test('remote compatible endpoint is NOT local merely because its provider is custom', () => {
  const customRemote = { ...env, JANUS_MODEL_BASE_URL: 'https://api.remotevendor.example/v1' };
  const configured = resolveModelProviders(customRemote);
  assert.equal(modelExecutionTier(configured.find((x) => x.id === 'custom')!, customRemote), 'external-credit');
  const execution = planModelExecution(customRemote);
  assert.equal(execution.local.length, 0);
  assert.ok(execution.blocked.some((x) => x.id === 'custom'));
});

test('trust LAN model only with exact configured origin; reject lookalike and unexpected protocol', () => {
  const base = { ...env, JANUS_MODEL_BASE_URL: 'http://192.168.1.30:11434/v1' };
  const localModel = resolveModelProviders(base).find((x) => x.id === 'custom')!;
  assert.equal(modelExecutionTier(localModel, base), 'external-credit');
  assert.equal(modelExecutionTier(localModel, {
    ...base, JANUS_TRUSTED_LOCAL_MODEL_ORIGINS: 'http://192.168.1.30:11434',
  }), 'local');
  assert.equal(modelExecutionTier(localModel, {
    ...base, JANUS_TRUSTED_LOCAL_MODEL_ORIGINS: 'http://192.168.1.30:11435',
  }), 'external-credit');
  const spoof = resolveModelProviders({ ...env, JANUS_MODEL_BASE_URL: 'https://localhost.evil.test' })[0]!;
  assert.equal(modelExecutionTier(spoof, env), 'external-credit');
});

test('local model wins even when paid model was configured first; capped provider only runs after local failure', async () => {
  const attempts: string[] = [];
  const request: ModelRequest = { messages: [{ role: 'user', content: 'Hola' }] };
  const selfHosted: ModelGateway = {
    async complete() {
      attempts.push('local');
      return { text: 'local answer', model: 'local', provider: 'custom' };
    },
  };
  const remote: ModelGateway = {
    async complete() {
      attempts.push('external');
      return { text: 'external answer', model: 'paid', provider: 'openai' };
    },
  };
  const ledger = new ExternalCreditCallLedger(1);
  const route = new FallbackModelRouter([
    { id: 'custom', gateway: selfHosted },
    { id: 'openai', gateway: new CreditGuardedModelGateway(remote, ledger) },
  ]);
  const got = await route.complete(request);
  assert.equal(got.provider, 'custom');
  assert.deepEqual(attempts, ['local']);
  assert.equal(ledger.usage().attempted, 0);

  const failingLocal: ModelGateway = {
    async complete() { attempts.push('local-failed'); throw new Error('offline'); },
  };
  const lastResort = new FallbackModelRouter([
    { id: 'custom', gateway: failingLocal },
    { id: 'openai', gateway: new CreditGuardedModelGateway(remote, ledger) },
  ]);
  assert.equal((await lastResort.complete(request)).provider, 'openai');
  assert.deepEqual(attempts.slice(-2), ['local-failed', 'external']);
  assert.equal(ledger.usage().remaining, 0);
  await assert.rejects(lastResort.complete(request), ModelBudgetExceededError);
  assert.equal(attempts.filter((x) => x === 'external').length, 1);
});

test('failed external requests still consume reservation; all external adapters share cap', async () => {
  const ledger = new ExternalCreditCallLedger(1);
  const down: ModelGateway = { async complete() { throw new Error('upstream failure'); } };
  const other: ModelGateway = { async complete(_req: ModelRequest): Promise<ModelResponse> {
    throw new Error('should never be reached');
  } };
  const router = new FallbackModelRouter([
    { id: 'a', gateway: new CreditGuardedModelGateway(down, ledger) },
    { id: 'b', gateway: new CreditGuardedModelGateway(other, ledger) },
  ]);
  await assert.rejects(router.complete({ messages: [] }), ModelBudgetExceededError);
  assert.equal(ledger.usage().attempted, 1);
  assert.throws(() => new ExternalCreditCallLedger(0), /between 1 and 100/);
});
