import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import {
  createAssistantConfigDelivery,
  markAssistantDeliveryPublished,
} from '../packages/core/src/assistant-config-publisher.js';

test('SQLite persists assistant config delivery lifecycle', () => {
  const store = new SqliteStore(':memory:');
  const desired = createAssistantConfigDelivery({
    surfaceId: 'landing.infinity-chatbox',
    profileId: 'infinity-landing-assistant',
    profileRevision: 2,
    bundleChecksum: 'bundle-abc',
    targetKind: 'repository',
    target: 'owner/repo',
    targetRef: 'release',
    targetPath: '.infinity/assistant-control/infinity-chatbox.json',
    createdBy: 'founder',
    expectedHeadSha: 'head-1',
    createdAt: '2026-10-01T10:00:00.000Z',
  });
  store.upsertAssistantConfigDelivery(desired);
  const published = markAssistantDeliveryPublished({
    delivery: desired,
    commitSha: 'commit-1',
    verified: true,
    updatedAt: '2026-10-01T10:01:00.000Z',
  });
  store.upsertAssistantConfigDelivery(published);

  assert.equal(store.getAssistantConfigDelivery(desired.id)?.status, 'published_verified');
  assert.equal(store.listAssistantConfigDeliveries('landing.infinity-chatbox').length, 1);
  assert.equal(store.listAssistantConfigDeliveries()[0]?.publishedCommitSha, 'commit-1');

  store.close();
});
