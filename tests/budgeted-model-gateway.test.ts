import assert from 'node:assert/strict';
import test from 'node:test';
import { BudgetedModelGateway, ModelBudgetExceededError } from '../packages/gateways/src/budgeted-model-gateway.js';
import type { ModelGateway, ModelRequest } from '../packages/gateways/src/contracts.js';
import { decideEffort, effortPlanningGuidance } from '../packages/core/src/effort-policy.js';

function fakeProvider(fail = false): ModelGateway & { calls: number } {
  return {
    calls: 0,
    async complete(_request: ModelRequest) {
      this.calls += 1;
      if (fail) throw new Error('provider down');
      return { text: '{}', model: 'fake', provider: 'fake', usage: { input_tokens: 10, output_tokens: 5 } };
    },
  };
}

test('budget refuses calls beyond the limit BEFORE reaching the provider (no spend)', async () => {
  const provider = fakeProvider();
  const gateway = new BudgetedModelGateway(provider, 2);
  await gateway.complete({ messages: [] });
  await gateway.complete({ messages: [] });
  await assert.rejects(gateway.complete({ messages: [] }), ModelBudgetExceededError);
  assert.equal(provider.calls, 2);
  assert.deepEqual(gateway.usage(), { maxCalls: 2, calls: 2, refused: 1, failures: 0, tokens: { input_tokens: 20, output_tokens: 10 } });
  assert.equal(gateway.remaining(), 0);
});

test('provider failures count against the budget and are recorded; zero budget never calls', async () => {
  const failing = new BudgetedModelGateway(fakeProvider(true), 1);
  await assert.rejects(failing.complete({ messages: [] }), /provider down/);
  assert.equal(failing.usage().failures, 1);
  const none = fakeProvider();
  await assert.rejects(new BudgetedModelGateway(none, 0).complete({ messages: [] }), /budget exhausted/);
  assert.equal(none.calls, 0);
  assert.throws(() => new BudgetedModelGateway(none, -1), /non-negative/);
});

test('effort levels map to plan sizes and planner guidance without lowering NORMAL capacity', () => {
  const eco = decideEffort({ text: 'hola', requested: 'eco' });
  const normal = decideEffort({ text: 'hola', requested: 'normal' });
  const max = decideEffort({ text: 'hola', requested: 'maximo' });
  assert.equal(eco.budget.maxPlanSteps, 8);
  assert.equal(normal.budget.maxPlanSteps, 20); // previous fixed default preserved
  assert.equal(max.budget.maxPlanSteps, 30);
  const guidance = effortPlanningGuidance(eco);
  assert.equal(guidance.level, 'eco');
  assert.match(String(guidance.rule), /never skip mandatory safety/);
});
