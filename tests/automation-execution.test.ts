import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowExecutionState, nextRetryDelayMs, nextWorkflowBatch } from '../packages/automation/src/execution.js';
import { createAutomationWorkflow } from '../packages/automation/src/workflow.js';

const workflow = createAutomationWorkflow({
  id: 'parallel',
  name: 'Parallel research',
  revision: 1,
  status: 'published',
  maxConcurrency: 2,
  createdAt: '2026-09-23T00:00:00.000Z',
  nodes: [
    { id: 't', type: 'event', version: 1, label: 'Trigger', kind: 'trigger', executionMode: 'deterministic', parameters: {}, toolOperation: { tool: 'events', action: 'receive' }, risk: 'none', reversible: true, requiresApproval: false },
    { id: 'a', type: 'research', version: 1, label: 'Research A', kind: 'ai', executionMode: 'agentic', parameters: {}, agentOperation: { objective: 'Research A', requiredCapabilities: ['reasoning'] }, risk: 'none', reversible: true, requiresApproval: false, retry: { maxAttempts: 3, backoffMs: 100, maxBackoffMs: 500 } },
    { id: 'b', type: 'research', version: 1, label: 'Research B', kind: 'ai', executionMode: 'agentic', parameters: {}, agentOperation: { objective: 'Research B', requiredCapabilities: ['reasoning'] }, risk: 'none', reversible: true, requiresApproval: false },
  ],
  connections: [{ from: 't', to: 'a' }, { from: 't', to: 'b' }],
});

test('workflow execution batches respect dependencies and concurrency', () => {
  const state = createWorkflowExecutionState(workflow, 'run1');
  assert.deepEqual(nextWorkflowBatch(workflow, state).map((node) => node.id), ['t']);

  state.nodeStatus.t = 'completed';
  assert.deepEqual(nextWorkflowBatch(workflow, state).map((node) => node.id), ['a', 'b']);
});

test('workflow retry delay uses bounded exponential backoff', () => {
  const state = createWorkflowExecutionState(workflow, 'run1');
  state.attempts.a = 4;
  assert.equal(nextRetryDelayMs(workflow.nodes[1]!, state), 500);
});
