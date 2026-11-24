import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizedHealthReport, describeReadingFreshness, requireHealthAccess } from '../packages/modules/family-health/src/tenant-health.js';
const owner = { tenantId: 'jessica-household', userId: 'jessica' };
const child = { tenantId: 'jessica-household', subjectId: 'child', isMinor: true };
const grant = { tenantId: 'jessica-household', subjectId: 'child', granteeUserId: 'jessica', allowedActions: ['read' as const, 'export' as const], consentRecordedAt: '2026-11-01T00:00:00Z' };
const now = '2026-11-06T12:00:00Z';
test('cross-tenant and missing grants fail closed', () => {
  assert.throws(() => requireHealthAccess({ tenantId: 'janus-household', userId: 'jessica' }, child, 'read', [grant], now), /denied/);
  assert.throws(() => requireHealthAccess(owner, child, 'read', [], now), /denied/);
  assert.doesNotThrow(() => requireHealthAccess(owner, child, 'read', [grant], now));
  assert.throws(() => requireHealthAccess(owner, child, 'read', [{ ...grant, revokedAt: now }], now), /denied/);
});
test('reports exclude other households even when profile IDs collide', () => {
  const reading = { id: 'r', profileId: 'child', kind: 'heart_rate' as const, unit: 'bpm' as const, value: 90, recordedAt: now, source: 'test', tenantId: 'jessica-household' };
  const result = buildAuthorizedHealthReport(owner, child, [grant], '2026-11-01T00:00:00Z', now, now, [], [reading, { ...reading, tenantId: 'janus-household', value: 160 }]);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.value, 90);
});
test('readings are marked stale rather than pretending live telemetry', () => {
  const reading = { id: 'r', profileId: 'child', kind: 'heart_rate' as const, unit: 'bpm' as const, value: 90, recordedAt: '2026-11-06T11:00:00Z', source: 'test', tenantId: 'jessica-household' };
  assert.equal(describeReadingFreshness(reading, true, now, 60).status, 'stale');
  assert.equal(describeReadingFreshness(reading, false, now, 60).status, 'not_connected');
});
