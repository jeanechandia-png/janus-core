import test from 'node:test';
import assert from 'node:assert/strict';
import { compileAutomationWorkflow } from '../packages/automation/src/compiler.js';
import { createAutomationWorkflow } from '../packages/automation/src/workflow.js';

test('workflow compiler maps automation into Janus Work Graph and safe tool steps', () => {
  const workflow = createAutomationWorkflow({
    id: 'office-flow',
    name: 'Office flow',
    revision: 1,
    status: 'published',
    maxConcurrency: 2,
    createdAt: '2026-09-23T00:00:00.000Z',
    nodes: [
      {
        id: 't',
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
    connections: [{ from: 't', to: 'draft' }],
  });

  const compiled = compileAutomationWorkflow(workflow);
  assert.equal(compiled.workGraph.nodes[1]?.dependsOn[0], 't');
  assert.equal(compiled.nodes[1]?.toolStep?.idempotencyKey?.includes('office-flow'), true);
});
