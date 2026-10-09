import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAssistantReleaseTargetManifest,
  defaultAssistantReleaseTargetPath,
  parseAssistantReleaseTargetManifest,
  resolveAssistantReleaseTarget,
  verifyAssistantReleaseTargetManifest,
} from '../packages/core/src/assistant-release-target.js';

function manifest() {
  return createAssistantReleaseTargetManifest({
    schemaVersion: 1,
    surfaceId: 'landing.infinity-chatbox',
    product: 'infinity-chatbox',
    repository: 'owner/product',
    releaseRef: 'release/rc25',
    releaseHeadSha: '0123456789abcdef0123456789abcdef01234567',
    updatedAt: '2026-10-09T12:00:00.000Z',
    evidenceRefs: [
      'github:owner/product@release/rc25',
      'project-state:validated-release',
    ],
  });
}

test('assistant release target manifest is deterministic and round-trips', () => {
  const one = manifest();
  const two = manifest();
  assert.equal(one.checksum, two.checksum);
  assert.equal(verifyAssistantReleaseTargetManifest(one), true);
  assert.deepEqual(parseAssistantReleaseTargetManifest(JSON.stringify(one)), one);
  assert.equal(
    defaultAssistantReleaseTargetPath('infinity-chatbox'),
    '.infinity/assistant-control/infinity-chatbox.release.json',
  );
});

test('assistant release target manifest is bound to exact product surface and repository', () => {
  const value = manifest();
  assert.equal(
    resolveAssistantReleaseTarget({
      manifest: value,
      surfaceId: 'landing.infinity-chatbox',
      product: 'infinity-chatbox',
      repository: 'owner/product',
    }).releaseRef,
    'release/rc25',
  );
  assert.throws(
    () => resolveAssistantReleaseTarget({
      manifest: value,
      surfaceId: 'landing.iba',
      product: 'infinity-business-assistant',
      repository: 'owner/product',
    }),
    /surface mismatch/,
  );
  assert.throws(
    () => resolveAssistantReleaseTarget({
      manifest: value,
      surfaceId: 'landing.infinity-chatbox',
      product: 'infinity-chatbox',
      repository: 'owner/other',
    }),
    /repository mismatch/,
  );
});

test('assistant release target manifest fails closed on tampering and unsafe refs', () => {
  const value = manifest();
  const tampered = { ...value, releaseRef: 'main' };
  assert.equal(verifyAssistantReleaseTargetManifest(tampered), false);
  assert.throws(
    () => parseAssistantReleaseTargetManifest(JSON.stringify(tampered)),
    /checksum mismatch/,
  );
  assert.throws(
    () => createAssistantReleaseTargetManifest({
      schemaVersion: 1,
      surfaceId: 'landing.infinity-chatbox',
      product: 'infinity-chatbox',
      repository: 'owner/product',
      releaseRef: 'refs/heads/main',
      releaseHeadSha: '0123456789abcdef0123456789abcdef01234567',
      updatedAt: '2026-10-09T12:00:00.000Z',
      evidenceRefs: ['test'],
    }),
    /releaseRef is invalid/,
  );
  assert.throws(
    () => createAssistantReleaseTargetManifest({
      schemaVersion: 1,
      surfaceId: 'landing.infinity-chatbox',
      product: 'infinity-chatbox',
      repository: 'owner/product',
      releaseRef: 'release/rc25',
      releaseHeadSha: 'not-a-sha',
      updatedAt: '2026-10-09T12:00:00.000Z',
      evidenceRefs: ['test'],
    }),
    /releaseHeadSha is invalid/,
  );
});
