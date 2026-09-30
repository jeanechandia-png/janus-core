import assert from 'node:assert/strict';
import test from 'node:test';
import { createDecisionBlueprint } from '../packages/core/src/decision-blueprint.js';
import { createDecisionReceipt } from '../packages/core/src/decision-receipt.js';
import type { JanusEvent, RunSnapshot } from '../packages/core/src/events.js';
import type { LearningObservation } from '../packages/core/src/outcome-learning.js';
import {
  assessVerifiedRunOutcome,
  createRuntimeLearningObservation,
  maybeProposeRuntimeImprovement,
  runtimeLearningReport,
} from '../packages/core/src/runtime-outcome-learning.js';

const blueprint = createDecisionBlueprint({
  id: 'runtime',
  revision: 1,
  status: 'active',
  objective: 'test runtime',
  modelPolicy: { requiredCapabilities: [] },
  agents: [],
  tools: [],
  guardrails: [],
  successMetrics: [],
  createdAt: '2026-09-30T19:00:00.000Z',
});

function snapshot(status: RunSnapshot['status']): RunSnapshot {
  return {
    runId: 'run_test',
    goal: 'test',
    status,
    lastEventSeq: 3,
    startedAt: '2026-09-30T19:00:00.000Z',
    updatedAt: '2026-09-30T19:01:00.000Z',
  };
}

function event(type: JanusEvent['type'], id: string): JanusEvent {
  return {
    id,
    runId: 'run_test',
    seq: Number(id.replace(/\D/g, '')) || 1,
    type,
    at: '2026-09-30T19:01:00.000Z',
    source: 'core',
    summary: type,
    payload: {},
  };
}

test('only treats completed runs with a prior execution prediction and verified delivery as success', () => {
  const events = [
    event('quality.passed', 'evt_1'),
    event('run.completed', 'evt_2'),
  ];

  const verified = assessVerifiedRunOutcome(snapshot('completed'), events, {
    hasExecutionPrediction: true,
  });
  assert.equal(verified.outcome, 'success');
  assert.equal(verified.outcomeScore, 1);
  assert.equal(verified.learningEligible, true);

  const fallback = assessVerifiedRunOutcome(snapshot('completed'), events, {
    hasExecutionPrediction: false,
  });
  assert.equal(fallback.outcome, 'unknown');
  assert.equal(fallback.learningEligible, false);
});

test('keeps dependency/approval blocks out of calibration and counts runtime failure as failure', () => {
  const blocked = assessVerifiedRunOutcome(
    snapshot('blocked'),
    [event('run.blocked', 'evt_3')],
    { hasExecutionPrediction: true },
  );
  assert.equal(blocked.outcome, 'unknown');
  assert.equal(blocked.learningEligible, false);

  const failed = assessVerifiedRunOutcome(
    snapshot('failed'),
    [event('run.failed', 'evt_4')],
    { hasExecutionPrediction: true },
  );
  assert.equal(failed.outcome, 'failure');
  assert.equal(failed.outcomeScore, 0);
  assert.equal(failed.learningEligible, true);
});

test('builds a learning observation from the execution prediction rather than verification confidence', () => {
  const prediction = createDecisionReceipt({
    id: 'prediction',
    runId: 'run_test',
    blueprintId: blueprint.id,
    blueprintRevision: blueprint.revision,
    decisionKind: 'execution_prediction',
    selectedWorker: 'janus-core/runtime-outcome-prior-v1',
    confidence: 0.5,
    inputRefs: ['run:run_test'],
    outputSummary: 'neutral prior',
    at: '2026-09-30T19:00:30.000Z',
  });
  const assessment = assessVerifiedRunOutcome(
    snapshot('completed'),
    [event('quality.passed', 'evt_5'), event('run.completed', 'evt_6')],
    { hasExecutionPrediction: true },
  );

  const observation = createRuntimeLearningObservation({
    snapshot: snapshot('completed'),
    blueprint,
    prediction,
    assessment,
  });

  assert.equal(observation.receiptHash, prediction.hash);
  assert.equal(observation.predictedConfidence, 0.5);
  assert.equal(observation.outcome, 'success');
  assert.equal(observation.outcomeScore, 1);
});

test('detects negative drift and creates at most one human-approved improvement proposal per revision', () => {
  const observations: LearningObservation[] = Array.from({ length: 20 }, (_, index) => ({
    id: 'obs_' + index,
    receiptHash: 'hash_' + index,
    blueprintId: blueprint.id,
    blueprintRevision: blueprint.revision,
    predictedConfidence: 0.5,
    outcomeScore: index < 10 ? 1 : 0.2,
    outcome: index < 10 ? 'success' : 'partial',
    at: new Date(Date.UTC(2026, 8, 30, 19, index)).toISOString(),
  }));

  const report = runtimeLearningReport(observations);
  assert.equal(report.drift.detected, true);
  assert.ok(report.drift.delta < 0);

  const proposal = maybeProposeRuntimeImprovement({
    blueprint,
    observations,
    existingProposals: [],
    createdAt: '2026-09-30T20:00:00.000Z',
  });
  assert.ok(proposal);
  assert.equal(proposal.requiresHumanApproval, true);
  assert.equal(proposal.status, 'proposed');

  const duplicate = maybeProposeRuntimeImprovement({
    blueprint,
    observations,
    existingProposals: [proposal],
    createdAt: '2026-09-30T20:01:00.000Z',
  });
  assert.equal(duplicate, null);
});
