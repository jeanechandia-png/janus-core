import test from 'node:test';
import assert from 'node:assert/strict';
import { EVOLUTION_CHECKS, assessReleaseGate, postmortem, premortem, proposeUpgrade } from '../packages/modules/janus-evolution-guard/src/index.js';

const at = '2026-11-04T18:00:00.000Z';
test('premortem starts UNKNOWN: absence of evidence is never marked PASS', () => {
  const report = premortem([], at);
  assert.equal(report.findings.length, EVOLUTION_CHECKS.length);
  assert.equal(report.counts.unverified, EVOLUTION_CHECKS.length);
  assert.equal(report.status, 'insufficient-evidence');
  assert.equal(report.requiresApprovalForChanges, true);
});
test('verified fresh pass may clear its check, stale/unverified assertions cannot', () => {
  const evidence = { id: 'offline.core-workflows' as const, at, result: 'pass' as const, evidenceRef: 'ci:offline:123', verified: true };
  const fresh = premortem([evidence], at);
  assert.equal(fresh.findings.find(f => f.id === evidence.id)?.level, 'stable');
  assert.equal(premortem([{ ...evidence, verified: false }], at).findings.find(f => f.id === evidence.id)?.level, 'unverified');
  const stale = premortem([evidence], '2027-02-04T18:00:00.000Z');
  assert.equal(stale.findings.find(f => f.id === evidence.id)?.result, 'unknown');
  assert.equal(stale.counts.stable, 0);
});
test('failure is critical; a verified warning is watch; no automatic deployment', () => {
  const report = premortem([
    { id: 'security.authority', result: 'fail', verified: true, at, evidenceRef: 'test:auth:failed' },
    { id: 'gateway.alternative-model', result: 'warn', verified: true, at, evidenceRef: 'test:exit:warning' },
  ], at);
  assert.equal(report.findings.find(f => f.id === 'security.authority')?.level, 'critical');
  assert.equal(report.priority[0]?.id, 'security.authority');
  assert.equal(report.status, 'attention-required');
});
const incident = {
  id: 'event-1', fingerprint: 'test-failure-123',
  occurredAt: '2026-11-03T11:00:00.000Z', recordedAt: at,
  error: 'Backend returned a broken contract', cause: 'The interface changed unexpectedly',
  impact: 'Messages could not be sent', lesson: 'Test at the adapter boundary',
  preventiveRule: 'Run contract tests on every adapter update',
  solutions: ['Pin last known working adapter', 'Implement updated schema'],
  change: 'Add contract test', verification: 'CI verified regression fixed',
  evidenceRefs: ['ci:123'], verified: true,
};
test('postmortem records cause, lesson, recurrence and prevention', () => {
  const first = postmortem(incident);
  assert.equal(first.recurrenceCount, 1);
  assert.equal(first.resolved, true);
  assert.equal(first.requiresHumanApproval, true);
  const repeated = postmortem({ ...incident, previousOccurrences: 1, verified: false, verification: 'pendiente' });
  assert.equal(repeated.requiresProtectionReview, true);
  assert.equal(repeated.severity, 'critical');
  assert.equal(repeated.resolved, false);
  assert.equal(repeated.status, 'open');
});
test('unknown cause may not be declared resolved', () => {
  assert.equal(postmortem({ ...incident, cause: 'por confirmar' }).resolved, false);
  assert.throws(() => postmortem({ ...incident, evidenceRefs: [] }), /evidencia/i);
});
test('proposals stay in draft and promotion requires all independent checks and Founder approval', () => {
  const proposal = proposeUpgrade({
    id: 'proposal-1', at, currentRef: 'main@commit-A', candidateRef: 'feature@commit-B',
    riskIds: ['gateway.alternative-model'],
    evidenceRefs: ['ci:model:123'], expectedBenefit: 'Lower vendor dependence',
    fallbackRef: 'main@commit-A',
  });
  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.autoDeploy, false);
  const checks = { regressionPass: true, securityPass: true, offlinePass: true,
    independentReviewPass: true, rollbackReady: true, founderApproved: false };
  assert.equal(assessReleaseGate(checks).canPromote, false);
  assert.match(assessReleaseGate(checks).blockers.join(' '), /Founder/);
  assert.equal(assessReleaseGate({ ...checks, founderApproved: true }).canPromote, true);
});
