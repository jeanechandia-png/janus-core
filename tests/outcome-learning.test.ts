import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectOutcomeDrift,
  proposeImprovement,
  summarizeCalibration,
  type LearningObservation,
} from '../packages/core/src/outcome-learning.js';

function obs(index: number, score: number): LearningObservation {
  return {
    id: `o${index}`,
    receiptHash: `h${index}`,
    blueprintId: 'bp',
    blueprintRevision: 1,
    predictedConfidence: 0.8,
    outcomeScore: score,
    outcome: score > 0.8 ? 'success' : score > 0.4 ? 'partial' : 'failure',
    at: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
  };
}

test('learning loop detects degraded outcomes without auto-changing production', () => {
  const observations = [
    ...Array.from({ length: 12 }, (_, i) => obs(i, 0.9)),
    ...Array.from({ length: 6 }, (_, i) => obs(i + 12, 0.45)),
  ];

  const drift = detectOutcomeDrift(observations, {
    baselineWindow: 12,
    recentWindow: 6,
    minimumSamples: 12,
    threshold: 0.15,
  });
  assert.equal(drift.detected, true);
  assert.equal(drift.delta < 0, true);

  const calibration = summarizeCalibration(observations);
  assert.equal(calibration.count, 18);
  assert.equal(calibration.brierScore > 0, true);

  const proposal = proposeImprovement({
    id: 'ip1',
    blueprintId: 'bp',
    fromRevision: 1,
    rationale: 'Outcome drift detected',
    evidenceRefs: ['drift:1'],
    suggestedChanges: ['Route verification to stronger model'],
    createdAt: '2026-09-23T00:00:00.000Z',
  });
  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.requiresHumanApproval, true);
});
