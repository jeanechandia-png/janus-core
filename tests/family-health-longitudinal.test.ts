import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClinicalSummary, canCollectObservation, validateObservation } from '../packages/modules/family-health/src/longitudinal-monitoring.js';
const plan = { profileId: 'founder', mode: 'seasonal' as const, enabledKinds: ['heart_rate' as const, 'sleep' as const], startedAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-30T23:59:59Z', consentRecordedAt: '2026-10-31T00:00:00Z' };
const obs = { id: '1', profileId: 'founder', kind: 'heart_rate' as const, unit: 'bpm' as const, value: 160, source: 'test-device', recordedAt: '2026-11-06T12:00:00Z' };
test('seasonal monitoring requires enabled kind and active consent window', () => {
  assert.equal(canCollectObservation(plan, 'heart_rate', obs.recordedAt), true);
  assert.equal(canCollectObservation(plan, 'snoring', obs.recordedAt), false);
  assert.equal(canCollectObservation(plan, 'heart_rate', '2026-12-01T00:00:00Z'), false);
  assert.equal(canCollectObservation({ ...plan, mode: 'off' }, 'heart_rate', obs.recordedAt), false);
});
test('clinician summary includes observed and self-reported events but not other profiles', () => {
  const episodes = [{ id: 'e1', profileId: 'founder', startedAt: '2026-11-06T12:00:00Z', endedAt: '2026-11-06T12:05:00Z', trigger: 'self_reported' as const, symptoms: ['palpitations'], reliefActions: ['breathing'] }];
  const report = buildClinicalSummary('founder', '2026-11-01T00:00:00Z', '2026-11-30T23:59:59Z', episodes, [obs, { ...obs, id: '2', profileId: 'child' }]);
  assert.equal(report.episodes[0]?.durationMinutes, 5);
  assert.equal(report.observations.length, 1);
  assert.equal(report.observations[0]?.value, 160);
  assert.ok(report.limitations.some(x => x.includes('diagnóstico')));
});
test('invalid sensor values and unreferenced ECG records are rejected', () => {
  assert.doesNotThrow(() => validateObservation(obs));
  assert.throws(() => validateObservation({ ...obs, value: -1 }), /Invalid numeric/);
  assert.throws(() => validateObservation({ ...obs, kind: 'ecg', unit: 'file_reference', value: undefined }), /reference/);
});
