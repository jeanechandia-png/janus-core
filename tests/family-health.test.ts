import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadHealthMetric, filterHealthSamples, getHealthDisplayState, healthAlertReadiness, validateHealthSample } from '../packages/modules/family-health/src/index.js';
const founder = { id: 'founder', role: 'founder' as const, displayName: 'Founder' };
const child = { id: 'child', role: 'child' as const, displayName: 'Child' };
const sample = { profileId: 'child', metric: 'heart_rate' as const, value: 80, unit: 'bpm' as const, recordedAt: '2026-11-06T12:00:00Z', source: 'test-fixture' };
const base = { viewerProfileId: 'founder', profiles: [founder, child], grants: [] };
test('health data is denied cross-profile without explicit scoped grant', () => {
  assert.equal(canReadHealthMetric(base, 'child', 'heart_rate'), false);
  assert.deepEqual(filterHealthSamples(base, [sample]), []);
  assert.throws(() => getHealthDisplayState(base, 'child', 'heart_rate', [sample], true), /denied/);
});
test('parent grant allows only specified metric and can be revoked', () => {
  const grant = { subjectProfileId: 'child', viewerProfileId: 'founder', metrics: ['heart_rate' as const], grantedAt: '2026-11-06T00:00:00Z' };
  const allowed = { ...base, grants: [grant] };
  assert.equal(canReadHealthMetric(allowed, 'child', 'heart_rate'), true);
  assert.equal(canReadHealthMetric(allowed, 'child', 'sleep_minutes'), false);
  assert.equal(getHealthDisplayState(allowed, 'child', 'heart_rate', [sample], true).status, 'available');
  assert.equal(getHealthDisplayState(allowed, 'child', 'heart_rate', [sample], false).status, 'no_connection');
  assert.equal(canReadHealthMetric({ ...base, grants: [{ ...grant, revokedAt: '2026-11-07T00:00:00Z' }] }, 'child', 'heart_rate'), false);
});
test('measurements have strict units and provenance', () => {
  assert.doesNotThrow(() => validateHealthSample(sample));
  assert.throws(() => validateHealthSample({ ...sample, unit: 'mmHg' as const }), /mismatch/);
  assert.throws(() => validateHealthSample({ ...sample, source: '' }), /provenance/);
});
test('child health alerts are not generated from adult thresholds', () => {
  assert.equal(healthAlertReadiness(child), 'clinical_rules_required');
});
