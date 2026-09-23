import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentSwarm, nextSwarmBatch } from '../packages/orchestrator/src/agent-swarm.js';
import type { WorkGraph } from '../packages/orchestrator/src/work-graph.js';

const graph: WorkGraph = {
  goal: 'Research and verify',
  nodes: [
    { id: 'a', label: 'Research A', kind: 'research', dependsOn: [], objective: 'A', expectedOutput: 'facts' },
    { id: 'b', label: 'Research B', kind: 'research', dependsOn: [], objective: 'B', expectedOutput: 'facts' },
    { id: 'c', label: 'Analyze', kind: 'analysis', dependsOn: ['a', 'b'], objective: 'Analyze', expectedOutput: 'analysis' },
    { id: 'd', label: 'Verify', kind: 'verification', dependsOn: ['c'], objective: 'Verify', expectedOutput: 'verified' },
  ],
};

test('agent swarm assigns specialists and respects graph readiness', () => {
  const swarm = buildAgentSwarm(graph, { maxAgents: 4, maxConcurrency: 2 });
  assert.equal(swarm.agents.length >= 3, true);

  const first = nextSwarmBatch(graph, swarm, new Set());
  assert.deepEqual(first.map((item) => item.nodeId), ['a', 'b']);

  const second = nextSwarmBatch(graph, swarm, new Set(['a', 'b']));
  assert.deepEqual(second.map((item) => item.nodeId), ['c']);
});
