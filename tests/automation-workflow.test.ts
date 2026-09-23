import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAutomationWorkflow,
  diffAutomationWorkflows,
  validateAutomationWorkflow,
} from '../packages/automation/src/workflow.js';

function baseWorkflow() {
  return createAutomationWorkflow({
    id: 'lead-flow',
    name: 'Lead intake',
    revision: 1,
    status: 'published',
    maxConcurrency: 3,
    createdAt: '2026-09-23T00:00:00.000Z',
    nodes: [
      {
        id: 'trigger',
        type: 'webhook',
        version: 1,
        label: 'Receive lead',
        kind: 'trigger',
        executionMode: 'deterministic',
        parameters: {},
        toolOperation: { tool: 'webhook', action: 'receive' },
        risk: 'none',
        reversible: true,
        requiresApproval: false,
      },
      {
        id: 'qualify',
        type: 'agent',
        version: 1,
        label: 'Qualify lead',
        kind: 'ai',
        executionMode: 'agentic',
        parameters: {},
        agentOperation: {
          objective: 'Qualify this lead using current business rules',
          requiredCapabilities: ['reasoning'],
        },
        risk: 'none',
        reversible: true,
        requiresApproval: false,
      },
      {
        id: 'send',
        type: 'email',
        version: 1,
        label: 'Send reply',
        kind: 'action',
        executionMode: 'deterministic',
        parameters: { to: '{{ $input.email }}' },
        toolOperation: { tool: 'gmail', action: 'send' },
        credentialRefs: ['keychain:gmail:primary'],
        risk: 'medium',
        reversible: false,
        requiresApproval: true,
      },
    ],
    connections: [
      { from: 'trigger', to: 'qualify' },
      { from: 'qualify', to: 'send' },
    ],
  });
}

test('automation workflow validates hybrid deterministic and agentic nodes', () => {
  const workflow = baseWorkflow();
  assert.equal(validateAutomationWorkflow(workflow).ok, true);
});

test('automation workflow rejects raw secrets and graph cycles', () => {
  const workflow = baseWorkflow();
  const invalid = {
    ...workflow,
    nodes: workflow.nodes.map((node) =>
      node.id === 'send' ? { ...node, credentialRefs: ['sk-secret'] } : node,
    ),
    connections: [...workflow.connections, { from: 'send', to: 'qualify' }],
  };
  const result = validateAutomationWorkflow(invalid);
  assert.equal(result.ok, false);
  assert.equal(result.errors.some((error) => error.includes('credentialRefs')), true);
  assert.equal(result.errors.some((error) => error.includes('cycle')), true);
});

test('workflow revisions are diffable', () => {
  const previous = baseWorkflow();
  const next = createAutomationWorkflow({
    ...previous,
    revision: 2,
    supersedesRevision: 1,
    nodes: previous.nodes.map((node) =>
      node.id === 'qualify' ? { ...node, label: 'Qualify and score lead' } : node,
    ),
  });
  assert.deepEqual(diffAutomationWorkflows(previous, next).changedNodeIds, ['qualify']);
});
