import assert from 'node:assert/strict';
import test from 'node:test';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import type { ToolAdapter, ToolRequest } from '../packages/gateways/src/contracts.js';

class RecordingAdapter implements ToolAdapter {
  readonly name = 'records';
  readonly capabilities = ['read.item', 'create.item'];
  calls: ToolRequest[] = [];

  async execute(request: ToolRequest) {
    this.calls.push(request);
    return { ok: true, output: { action: request.action } };
  }
}

test('Tool Gateway allows non-privileged reads without authority permit', async () => {
  const gateway = new DefaultToolGateway();
  const adapter = new RecordingAdapter();
  gateway.register(adapter);

  const result = await gateway.execute(
    { tool: 'records', action: 'read.item', input: {} },
    () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(adapter.calls.length, 1);
});

test('Tool Gateway blocks privileged mutations without audited authority permit', async () => {
  const gateway = new DefaultToolGateway();
  const adapter = new RecordingAdapter();
  gateway.register(adapter);

  const result = await gateway.execute(
    {
      tool: 'records',
      action: 'create.item',
      input: { name: 'example' },
      idempotencyKey: 'create:example',
    },
    () => {},
  );

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /authority permit/i);
  assert.equal(adapter.calls.length, 0);
});

test('Tool Gateway accepts privileged mutation with idempotency and audited authority permit', async () => {
  const gateway = new DefaultToolGateway();
  const adapter = new RecordingAdapter();
  gateway.register(adapter);

  const result = await gateway.execute(
    {
      tool: 'records',
      action: 'create.item',
      input: { name: 'example' },
      idempotencyKey: 'create:example',
      authorization: {
        privileged: true,
        authorityDecisionHash: 'a'.repeat(64),
        principalId: 'founder',
      },
    },
    () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(adapter.calls.length, 1);
});
