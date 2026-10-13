import test from 'node:test';
import assert from 'node:assert/strict';
import { assessKnowledgeFreshness } from '../packages/core/src/expertise-policy.js';
import {
  offlineCapabilityDecision,
  offlineProjectContinuityReady,
  type OfflineCapability,
} from '../packages/core/src/offline-continuity.js';

test('technical work continues from a stale local snapshot while offline', () => {
  const assessment = assessKnowledgeFreshness('coding', {
    online: false,
    lastVerifiedAt: '2026-07-01T00:00:00.000Z',
    localSnapshotAvailable: true,
    now: new Date('2026-09-23T00:00:00.000Z'),
  });

  assert.equal(assessment.state, 'stale_but_usable');
  assert.equal(assessment.canContinueOffline, true);
  assert.equal(assessment.requiresRevalidationOnReconnect, true);
});

test('external deploy is queued rather than blocking local project completion', () => {
  const build = offlineCapabilityDecision('build', 'offline');
  const deploy = offlineCapabilityDecision('external_deploy', 'offline');

  assert.equal(build.allowed, true);
  assert.equal(build.queueForReconnect, false);
  assert.equal(deploy.allowed, false);
  assert.equal(deploy.queueForReconnect, true);
});

test('offline project continuity requires the complete local engineering loop', () => {
  const available = new Set<OfflineCapability>([
    'reason',
    'plan',
    'code',
    'build',
    'test',
    'debug',
    'document',
    'commit_local',
  ]);

  assert.deepEqual(offlineProjectContinuityReady(available), { ready: true, missing: [] });
  available.delete('test');
  assert.deepEqual(offlineProjectContinuityReady(available), { ready: false, missing: ['test'] });
});
