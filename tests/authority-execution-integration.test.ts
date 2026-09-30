import assert from 'node:assert/strict';
import test from 'node:test';
import { EventHub } from '../packages/core/src/event-hub.js';
import { TaskRunner } from '../packages/core/src/task-runner.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import type { ToolAdapter, ToolRequest } from '../packages/gateways/src/contracts.js';
import { compilePlan } from '../packages/orchestrator/src/compile-plan.js';
import { createPlan } from '../packages/orchestrator/src/plan.js';
import { compileAutomationWorkflow } from '../packages/automation/src/compiler.js';
import { createAutomationWorkflow } from '../packages/automation/src/workflow.js';

class WriteAdapter implements ToolAdapter {
  readonly name = 'office';
  readonly capabilities = ['create.document'];
  calls: ToolRequest[] = [];

  async execute(request: ToolRequest) {
    this.calls.push(request);
    return { ok: true, output: { id: 'doc-1' } };
  }
}

function founderAuthority() {
  return {
    principal: { id: 'founder', role: 'founder_director' as const, active: true },
    instruction: {
      id: 'instruction-1',
      principalId: 'founder',
      source: 'authenticated_human' as const,
      authenticated: true,
      instruction: 'Create approved document',
      requestedAt: '2026-09-30T16:00:00.000Z',
    },
  };
}

test('compiled tool plan is blocked before gateway mutation without authority', async () => {
  const hub = new EventHub();
  const gateway = new DefaultToolGateway();
  const adapter = new WriteAdapter();
  gateway.register(adapter);

  const plan = createPlan('Create a document', [{
    id: 'create-doc',
    kind: 'tool',
    label: 'Create document',
    tool: 'office',
    action: 'create.document',
    input: { title: 'Proposal' },
    risk: 'low',
    reversible: true,
    requiresApproval: false,
    idempotencyKey: 'create-doc:1',
  }]);

  const runner = new TaskRunner(plan.goal, { sink: hub.sink });
  const snapshot = await runner.execute(compilePlan(plan, { toolGateway: gateway }));

  assert.equal(snapshot.status, 'blocked');
  assert.equal(adapter.calls.length, 0);
  assert.ok(hub.replay(snapshot.runId).some((event) => event.type === 'authority.evaluated'));
});

test('authenticated founder permit reaches Tool Gateway and allows mutation', async () => {
  const hub = new EventHub();
  const gateway = new DefaultToolGateway();
  const adapter = new WriteAdapter();
  gateway.register(adapter);

  const plan = createPlan('Create a document', [{
    id: 'create-doc',
    kind: 'tool',
    label: 'Create document',
    tool: 'office',
    action: 'create.document',
    input: { title: 'Proposal' },
    risk: 'low',
    reversible: true,
    requiresApproval: false,
    idempotencyKey: 'create-doc:2',
  }]);

  const runner = new TaskRunner(plan.goal, {
    sink: hub.sink,
    authorityContext: founderAuthority(),
  });
  const snapshot = await runner.execute(compilePlan(plan, { toolGateway: gateway }));

  assert.equal(snapshot.status, 'completed');
  assert.equal(adapter.calls.length, 1);
  assert.equal(adapter.calls[0]?.authorization?.privileged, true);
  assert.match(adapter.calls[0]?.authorization?.authorityDecisionHash ?? '', /^[a-f0-9]{64}$/);
});

test('root-destructive action still requires explicit confirmation after founder authority passes', async () => {
  const hub = new EventHub();
  const runner = new TaskRunner('Rotate root keys', {
    sink: hub.sink,
    approvalHandler: async () => ({ approved: true }),
    authorityContext: {
      principal: { id: 'founder', role: 'founder_director', active: true },
      instruction: {
        id: 'root-1',
        principalId: 'founder',
        source: 'authenticated_human',
        authenticated: true,
        instruction: 'Rotate root keys',
        requestedAt: '2026-09-30T16:30:00.000Z',
      },
    },
  });

  const snapshot = await runner.execute([{
    id: 'rotate',
    label: 'Rotate root keys',
    run: async ({ assertCanExecute }) => {
      await assertCanExecute({
        id: 'rotate',
        label: 'Rotate root keys',
        tool: 'system',
        operation: 'rotate_root_keys',
        risk: 'high',
        reversible: false,
        requiresApproval: true,
      });
    },
  }]);

  assert.equal(snapshot.status, 'blocked');
  const events = hub.replay(snapshot.runId);
  const authority = events.find((event) => event.type === 'authority.evaluated');
  assert.equal(authority?.payload.allowed, true);
  assert.equal(authority?.payload.requiresConfirmation, true);
  assert.ok(events.some((event) => event.type === 'approval.required'));
  assert.ok(events.some((event) => event.type === 'run.blocked'));
});

test('automation write node inherits the same authority boundary', async () => {
  const workflow = createAutomationWorkflow({
    id: 'authority-flow',
    name: 'Authority flow',
    revision: 1,
    status: 'published',
    maxConcurrency: 1,
    createdAt: '2026-09-30T16:00:00.000Z',
    nodes: [
      {
        id: 'trigger',
        type: 'manual',
        version: 1,
        label: 'Start',
        kind: 'trigger',
        executionMode: 'deterministic',
        parameters: {},
        toolOperation: { tool: 'manual', action: 'receive' },
        risk: 'none',
        reversible: true,
        requiresApproval: false,
      },
      {
        id: 'draft',
        type: 'office',
        version: 1,
        label: 'Create draft',
        kind: 'action',
        executionMode: 'deterministic',
        parameters: { title: 'Proposal' },
        toolOperation: { tool: 'office', action: 'create.document' },
        risk: 'low',
        reversible: true,
        requiresApproval: false,
      },
    ],
    connections: [{ from: 'trigger', to: 'draft' }],
  });
  const compiled = compileAutomationWorkflow(workflow);
  const toolSteps = compiled.nodes.flatMap((node) => node.toolStep ? [node.toolStep] : []);

  const gateway = new DefaultToolGateway();
  const adapter = new WriteAdapter();
  gateway.register(adapter);
  const hub = new EventHub();
  const runner = new TaskRunner(workflow.name, { sink: hub.sink });

  const snapshot = await runner.execute(
    compilePlan(createPlan(workflow.name, toolSteps), { toolGateway: gateway }),
  );

  assert.equal(snapshot.status, 'blocked');
  assert.equal(adapter.calls.length, 0);
});
