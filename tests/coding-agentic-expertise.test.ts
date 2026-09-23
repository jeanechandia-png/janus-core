import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentSwarm } from '../packages/orchestrator/src/agent-swarm.js';
import type { WorkGraph } from '../packages/orchestrator/src/work-graph.js';
import { expertisePolicy, requiresFreshResearch } from '../packages/core/src/expertise-policy.js';

test('coding and agentic workflow nodes get dedicated specialists', () => {
  const graph: WorkGraph = {
    goal: 'Build and validate an agentic feature',
    nodes: [
      { id: 'code', label: 'Code', kind: 'coding', dependsOn: [], objective: 'Implement', expectedOutput: 'tested code' },
      { id: 'flow', label: 'Flow', kind: 'agentic_workflow', dependsOn: ['code'], objective: 'Orchestrate', expectedOutput: 'validated workflow' },
    ],
  };
  const swarm = buildAgentSwarm(graph);
  assert.equal(swarm.assignments.find((x) => x.nodeId === 'code')?.role, 'builder');
  assert.equal(swarm.assignments.find((x) => x.nodeId === 'flow')?.role, 'workflow_architect');
  assert.ok(swarm.agents.find((x) => x.role === 'workflow_architect')?.capabilities.includes('recovery'));
});

test('expertise policy requires freshness and verification', () => {
  const coding = expertisePolicy('coding');
  assert.equal(coding.currentKnowledgeRequired, true);
  assert.equal(coding.providerIndependent, true);
  assert.ok(coding.mandatoryVerification.includes('tests'));
  const now = new Date('2026-09-23T12:00:00Z');
  assert.equal(requiresFreshResearch('coding', undefined, 30, now), true);
  assert.equal(requiresFreshResearch('coding', '2026-09-20T12:00:00Z', 30, now), false);
  assert.equal(requiresFreshResearch('agentic_workflow', '2026-07-01T12:00:00Z', 30, now), true);
});
