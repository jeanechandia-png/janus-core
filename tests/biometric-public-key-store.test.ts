import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('SQLite persists only Founder biometric public-key metadata and revocation state', () => {
  const store = new SqliteStore(':memory:');
  const record = {
    keyId: 'iphone-face-key-v1',
    principalId: 'founder',
    publicKeyPem: '-----BEGIN PUBLIC KEY-----\nPUBLIC\n-----END PUBLIC KEY-----\n',
    method: 'platform-face' as const,
    biometry: 'face' as const,
    binding: 'biometry-current-set' as const,
    createdAt: '2026-10-01T19:00:00.000Z',
    active: true,
  };

  store.upsertBiometricPublicKey(record);
  assert.deepEqual(store.getBiometricPublicKey(record.keyId), record);
  assert.equal(store.listBiometricPublicKeys('founder', true).length, 1);

  assert.equal(
    store.revokeBiometricPublicKey(
      record.keyId,
      '2026-10-01T19:05:00.000Z',
    ),
    true,
  );
  const revoked = store.getBiometricPublicKey(record.keyId);
  assert.equal(revoked?.active, false);
  assert.equal(revoked?.revokedAt, '2026-10-01T19:05:00.000Z');
  assert.equal(store.listBiometricPublicKeys('founder', true).length, 0);

  const serialized = JSON.stringify(store.listBiometricPublicKeys());
  assert.equal(serialized.includes('privateKey'), false);
  assert.equal(serialized.includes('face image'), false);
  assert.equal(serialized.includes('template'), false);

  store.close();
});
