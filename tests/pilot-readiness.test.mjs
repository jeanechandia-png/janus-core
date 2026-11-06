import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUALITY_FILTERS, PILOT_CRITERIA, assessPilotReadiness,
} from '../packages/core/src/pilot-readiness.mjs';

const sha = '7ddfe245f15ec53438c2db98dbb7b137420ebcf9';
function fixture() {
  return {
    project: 'JANUS',
    updatedAt: '2026-11-06',
    baseline: { ref: 'main', commit: sha },
    deployment: { state: 'PUBLISHED', commit: sha, url: 'https://example.org/verification' },
    filters: Object.fromEntries(QUALITY_FILTERS.map(id => [id, { state: 'PASS', evidence: ['test-log:' + id] }])),
    acceptance: Object.fromEntries(PILOT_CRITERIA.map(id => [id, { state: 'PASS', evidence: ['e2e-log:' + id] }])),
  };
}
test('all fourteen filters and eight acceptance criteria are explicitly enumerated', () => {
  assert.equal(QUALITY_FILTERS.length, 14);
  assert.equal(PILOT_CRITERIA.length, 8);
});
test('a complete self-attested record is review-required, never automatically pilot-ready', () => {
  const result = assessPilotReadiness(fixture());
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reviewRequired, true);
  assert.deepEqual(result.errors, []);
});
test('unexecuted checks block claims of readiness without fabricating failures', () => {
  const record = fixture();
  record.filters.e2e = { state: 'NOT_RUN', evidence: [] };
  record.deployment = { state: 'NOT_DEPLOYED' };
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'IN_PROGRESS');
  assert.ok(result.pending.includes('e2e'));
});
test('critical failed privacy gate blocks release regardless of other green checks', () => {
  const record = fixture();
  record.filters.seguridad_privacidad = { state: 'FAIL', evidence: ['privacy-check:failed'] };
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'BLOCKED');
  assert.ok(result.failed.includes('seguridad_privacidad'));
});
test('PASS without evidence cannot be presented as a verified result', () => {
  const record = fixture();
  record.acceptance.iphone_safari = { state: 'PASS', evidence: [] };
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'INVALID_RECORD');
  assert.match(result.errors.join(' '), /PASS sin referencias/);
});
test('unknown checks and missing baseline commit fail closed', () => {
  const record = fixture();
  record.filters.inventado = { state: 'PASS', evidence: ['n/a'] };
  record.baseline.commit = '123';
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'INVALID_RECORD');
  assert.ok(result.errors.some(message => message.includes('desconocida')));
  assert.ok(result.errors.some(message => message.includes('SHA')));
});
test('non-waivable safety and E2E checks cannot be marked N/A', () => {
  const record = fixture();
  record.filters.e2e = { state: 'NOT_APPLICABLE', reason: 'Lo probaremos después de publicar' };
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'INVALID_RECORD');
  assert.match(result.errors.join(' '), /no admite exclusión/);
});
test('deployment SHA mismatch is invalid even with all green self-reports', () => {
  const record = fixture();
  record.deployment.commit = 'a'.repeat(40);
  const result = assessPilotReadiness(record);
  assert.equal(result.status, 'INVALID_RECORD');
  assert.match(result.errors.join(' '), /no corresponden al mismo commit/);
});
