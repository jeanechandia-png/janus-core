import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('SQLite stores only public authority credential metadata and revocation state', () => {
  const store = new SqliteStore(':memory:');
  const credential = {
    principal: {
      id: 'admin-1',
      role: 'administrator' as const,
      displayName: 'Admin One',
      active: true,
    },
    algorithm: 'ecdsa-p256-sha256' as const,
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nPUBLIC\n-----END PUBLIC KEY-----\n',
    createdAt: '2026-09-30T17:00:00.000Z',
    delegatedBy: 'founder',
  };

  store.upsertAuthorityCredential(credential);
  assert.deepEqual(store.getAuthorityCredential('admin-1'), credential);
  assert.equal(store.listAuthorityCredentials(true).length, 1);

  assert.equal(
    store.revokeAuthorityCredential('admin-1', '2026-09-30T18:00:00.000Z'),
    true,
  );
  const revoked = store.getAuthorityCredential('admin-1');
  assert.equal(revoked?.principal.active, false);
  assert.equal(revoked?.revokedAt, '2026-09-30T18:00:00.000Z');
  assert.equal(store.listAuthorityCredentials(true).length, 0);

  store.close();
});
