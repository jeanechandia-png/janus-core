import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderSpendSnapshot, parseElevenLabsSubscription } from '../packages/core/src/provider-spend-control.js';
import { ElevenLabsSubscriptionReader } from '../packages/adapters/src/elevenlabs-subscription-reader.js';

test('unknown providers never appear as zero cost or connected', () => {
  const out = buildProviderSpendSnapshot(null);
  assert.equal(out.totalCostEUR, null);
  assert.equal(out.costComplete, false);
  assert.ok(out.providers.some(p => p.id === 'openai-api'));
  assert.ok(out.providers.every(p => p.totalCostEUR === null && p.state !== 'verified'));
});

test('ElevenLabs parsing: threshold, unlimited overage, reset and missing full EUR cost', () => {
  const x = parseElevenLabsSubscription({
    character_count: 114128, character_limit: 121000,
    max_credit_limit_extension: 'unlimited',
    current_overage: { amount: '4.99', currency: 'usd' },
    next_character_count_reset_unix: 1793865600, currency: 'usd',
  }, '2026-11-05T11:00:00Z');
  assert.equal(x.alert, 'critical');
  assert.equal(x.overageEnabled, true);
  assert.equal(x.percent, 94.3); // threshold is 'high' at 85%; overage increases severity? see next assertion
  assert.equal(x.totalCostEUR, null);
  assert.equal(x.overageEUR, null); // never convert USD to guessed EUR
  assert.equal(x.unit, 'caracteres reportados por API');
  const summary = buildProviderSpendSnapshot(x, [{ date: '2026-11-05', observedAt: x.observedAt, used: x.used, limit: x.limit }]);
  assert.equal(summary.verifiedProviders, 1);
  assert.equal(summary.providers.find(p=>p.id==='elevenlabs')?.history.length,1);
});

test('thresholds and overages never imply known subscription price', () => {
  const raw = (used: number, cap: unknown) => ({ character_count: used, character_limit: 100, max_credit_limit_extension: cap,
    current_overage: { amount: '2.50', currency: 'eur' }, currency: 'eur' });
  assert.equal(parseElevenLabsSubscription(raw(69, 0), '2026-11-05T00:00:00Z').alert, 'normal');
  assert.equal(parseElevenLabsSubscription(raw(70, 0), '2026-11-05T00:00:00Z').alert, 'watch');
  assert.equal(parseElevenLabsSubscription(raw(86, 0), '2026-11-05T00:00:00Z').alert, 'high');
  assert.equal(parseElevenLabsSubscription(raw(95, 0), '2026-11-05T00:00:00Z').alert, 'critical');
  const over = parseElevenLabsSubscription(raw(35, 100), '2026-11-05T00:00:00Z');
  assert.equal(over.alert, 'watch');
  assert.equal(over.overageEUR, 2.5);
  assert.equal(over.totalCostEUR, null);
});
test('malformed/invalid usage is rejected rather than charted', () => {
  assert.throws(() => parseElevenLabsSubscription({ character_count: -1, character_limit: 2 }, new Date().toISOString()));
  assert.throws(() => parseElevenLabsSubscription({}, new Date().toISOString()));
});
test('read-only adapter uses fixed official host and secret never appears in result', async () => {
  let calls = 0;
  const reader = new ElevenLabsSubscriptionReader({
    apiKeyProvider: async () => 'hidden-test-key',
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      calls++;
      assert.equal(String(url), 'https://api.elevenlabs.io/v1/user/subscription');
      assert.equal(init?.method, 'GET');
      assert.equal(init?.redirect, 'error');
      assert.equal((init?.headers as Record<string,string>)['xi-api-key'], 'hidden-test-key');
      return new Response(JSON.stringify({ character_count: 10, character_limit: 100 }), { status: 200 });
    }) as typeof fetch,
  });
  const read = await reader.read() as Record<string, unknown>;
  assert.equal(read.character_count, 10);
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(read), /hidden-test-key/);
});
test('adapter with no key makes zero outbound API calls', async () => {
  const reader = new ElevenLabsSubscriptionReader({ apiKeyProvider: async () => undefined,
    fetchImpl: (async () => { throw Error('Must not connect'); }) as typeof fetch });
  assert.equal(await reader.read(), null);
});
