import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { createDecisionBlueprint } from '../packages/core/src/decision-blueprint.js';
import { createDecisionReceipt } from '../packages/core/src/decision-receipt.js';
import { proposeImprovement, type LearningObservation } from '../packages/core/src/outcome-learning.js';

test('sqlite persists super-agent learning primitives', () => {
  const store = new SqliteStore(':memory:');
  const blueprint = createDecisionBlueprint({
    id: 'super-agent',
    revision: 1,
    status: 'active',
    objective: 'Execute and learn with operator control',
    modelPolicy: { requiredCapabilities: ['reasoning'] },
    agents: [],
    tools: [{ tool: 'local', actions: ['read'] }],
    guardrails: [],
    successMetrics: [{ id: 'quality', description: 'verified quality', direction: 'min', target: 0.9 }],
    createdAt: '2026-09-23T00:00:00.000Z',
  });
  store.upsertDecisionBlueprint(blueprint);

  const receipt = createDecisionReceipt({
    id: 'receipt-1',
    runId: 'run-1',
    blueprintId: blueprint.id,
    blueprintRevision: blueprint.revision,
    decisionKind: 'plan',
    selectedWorker: 'planner',
    confidence: 0.8,
    inputRefs: ['goal:1'],
    outputSummary: 'planned',
    at: '2026-09-23T00:01:00.000Z',
  });
  store.appendDecisionReceipt(receipt);

  const observation: LearningObservation = {
    id: 'obs-1',
    receiptHash: receipt.hash,
    blueprintId: blueprint.id,
    blueprintRevision: blueprint.revision,
    predictedConfidence: 0.8,
    outcomeScore: 1,
    outcome: 'success',
    at: '2026-09-23T00:02:00.000Z',
  };
  store.appendLearningObservation(observation);

  const proposal = proposeImprovement({
    id: 'proposal-1',
    blueprintId: blueprint.id,
    fromRevision: blueprint.revision,
    rationale: 'Observed verified opportunity',
    evidenceRefs: [receipt.hash],
    suggestedChanges: ['Prefer lower latency when quality is equivalent'],
    createdAt: '2026-09-23T00:03:00.000Z',
  });
  store.upsertImprovementProposal(proposal);

  assert.equal(store.getDecisionBlueprint('super-agent')?.revision, 1);
  assert.equal(store.listDecisionReceipts('run-1')[0]?.hash, receipt.hash);
  assert.equal(store.listLearningObservations('super-agent')[0]?.outcome, 'success');
  assert.equal(store.listImprovementProposals('proposed')[0]?.requiresHumanApproval, true);
  store.close();
});
