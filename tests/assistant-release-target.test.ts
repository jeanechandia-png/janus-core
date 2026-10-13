import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSISTANT_RELEASE_TARGET_METADATA_REF,
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
  assert.equal(
    ASSISTANT_RELEASE_TARGET_METADATA_REF,
    'infinity/assistant-control-metadata',
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

// --- Release HEAD custody (regression: publisher's own commit must not stale the manifest) ---
import { verifyReleaseHeadCustody } from '../packages/core/src/assistant-release-target.js';

const SHA_A = '0123456789abcdef0123456789abcdef01234567';
const SHA_B = 'b'.repeat(40);
const SHA_C = 'c'.repeat(40);
const SHA_X = 'f'.repeat(40);

function delivery(id: string, from: string, to: string, extra: Record<string, string> = {}) {
  return {
    id,
    target: 'owner/product',
    targetRef: 'release/rc25',
    status: 'published_verified',
    expectedHeadSha: from,
    publishedCommitSha: to,
    ...extra,
  };
}

test('custody accepts the exact manifest HEAD without a chain', () => {
  const result = verifyReleaseHeadCustody({ manifest: manifest(), observedHeadSha: SHA_A, deliveries: [] });
  assert.deepEqual(result, { ok: true, mode: 'manifest_head', chain: [] });
});

test('custody accepts HEAD advanced only by verified Janus deliveries', () => {
  const result = verifyReleaseHeadCustody({
    manifest: manifest(),
    observedHeadSha: SHA_C,
    deliveries: [delivery('d2', SHA_B, SHA_C, { status: 'applied' }), delivery('d1', SHA_A, SHA_B)],
  });
  assert.deepEqual(result, { ok: true, mode: 'janus_delivery_lineage', chain: ['d1', 'd2'] });
});

test('custody fails closed on a foreign commit (human/CI push)', () => {
  const result = verifyReleaseHeadCustody({
    manifest: manifest(),
    observedHeadSha: SHA_X,
    deliveries: [delivery('d1', SHA_A, SHA_B)],
  });
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /stale/);
});

test('custody ignores unverified, failed, other-repo and other-ref deliveries', () => {
  for (const bad of [
    delivery('d', SHA_A, SHA_B, { status: 'published' }),
    delivery('d', SHA_A, SHA_B, { status: 'failed' }),
    delivery('d', SHA_A, SHA_B, { target: 'owner/other' }),
    delivery('d', SHA_A, SHA_B, { targetRef: 'main' }),
  ]) {
    const result = verifyReleaseHeadCustody({ manifest: manifest(), observedHeadSha: SHA_B, deliveries: [bad] });
    assert.equal(result.ok, false);
  }
});

test('custody rejects forks and cycles instead of guessing', () => {
  const fork = verifyReleaseHeadCustody({
    manifest: manifest(),
    observedHeadSha: SHA_B,
    deliveries: [delivery('d1', SHA_A, SHA_B), delivery('d2', SHA_A, SHA_C)],
  });
  assert.equal(fork.ok, false);
  assert.match((fork as { reason: string }).reason, /ambiguous/);

  const cycle = verifyReleaseHeadCustody({
    manifest: manifest(),
    observedHeadSha: SHA_X,
    deliveries: [delivery('d1', SHA_A, SHA_B), delivery('d2', SHA_B, SHA_A)],
  });
  assert.equal(cycle.ok, false);
  assert.match((cycle as { reason: string }).reason, /cycle/);
});

test('custody rejects a malformed observed HEAD', () => {
  assert.throws(() => verifyReleaseHeadCustody({ manifest: manifest(), observedHeadSha: 'HEAD', deliveries: [] }));
});
