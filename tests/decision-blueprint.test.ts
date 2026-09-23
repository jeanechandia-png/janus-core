import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionBlueprint,
  diffDecisionBlueprints,
  proposeBlueprintRevision,
} from '../packages/core/src/decision-blueprint.js';

test('decision blueprint is versioned and diffable', () => {
  const base = createDecisionBlueprint({
    id: 'research',
    revision: 1,
    status: 'active',
    objective: 'Produce verified research',
    modelPolicy: { requiredCapabilities: ['reasoning'] },
    agents: [{ id: 'r1', role: 'researcher', objective: 'Research', requiredCapabilities: ['web'] }],
    tools: [{ tool: 'web', actions: ['search'], revalidateBeforeExternalWrite: true }],
    guardrails: [{ id: 'g1', description: 'No unsourced claims', condition: 'claim.unsourced', effect: 'deny' }],
    successMetrics: [{ id: 'm1', description: 'coverage', direction: 'min', target: 0.95 }],
    createdAt: '2026-09-23T00:00:00.000Z',
  });

  const next = createDecisionBlueprint({
    ...base,
    revision: 2,
    supersedesRevision: 1,
    modelPolicy: { requiredCapabilities: ['reasoning', 'long_context'] },
  });

  assert.deepEqual(diffDecisionBlueprints(base, next).changedFields, ['modelPolicy']);
  const proposal = proposeBlueprintRevision({
    id: 'p1',
    blueprint: next,
    rationale: 'Observed repeated context truncation',
    evidenceRefs: ['receipt:abc'],
    suggestedChanges: ['Increase minimum context requirement'],
    createdAt: '2026-09-23T01:00:00.000Z',
  });
  assert.equal(proposal.requiresHumanApproval, true);
  assert.equal(proposal.proposedRevision, 3);
});
