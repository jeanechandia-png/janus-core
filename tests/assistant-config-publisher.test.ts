import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAssistantProfileRevision,
  defaultLandingAssistantProfile,
  defaultLandingAssistantSurfaces,
  resolveAssistantSurfaceConfig,
} from '../packages/core/src/assistant-control-plane.js';
import {
  acknowledgeAssistantDelivery,
  createAssistantConfigBundle,
  createAssistantConfigDelivery,
  markAssistantDeliveryPublished,
  parseAssistantConfigBundle,
  serializeAssistantConfigBundle,
  verifyAssistantConfigBundle,
} from '../packages/core/src/assistant-config-publisher.js';

test('assistant config bundle is deterministic for the same resolved config', () => {
  const profile = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const surface = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')[0]!;
  const resolved = resolveAssistantSurfaceConfig({ surface, profiles: [profile] });

  const one = createAssistantConfigBundle({ resolved, modules: [] });
  const two = createAssistantConfigBundle({ resolved, modules: [] });

  assert.equal(one.bundleChecksum, two.bundleChecksum);
  assert.equal(serializeAssistantConfigBundle(one), serializeAssistantConfigBundle(two));
  assert.equal(verifyAssistantConfigBundle(one), true);
  assert.equal(parseAssistantConfigBundle(serializeAssistantConfigBundle(one)).bundleChecksum, one.bundleChecksum);
});

test('assistant config bundle pins exact reusable module revisions', () => {
  const base = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const profile = createAssistantProfileRevision({
    profileId: base.profileId,
    revision: 2,
    status: 'current',
    name: base.name,
    objective: base.objective,
    sharedInstructions: base.sharedInstructions,
    guardrails: base.guardrails,
    capabilities: base.capabilities,
    moduleRefs: [{ itemId: 'module.shared', revision: 3 }],
    createdAt: '2026-10-01T01:00:00.000Z',
    createdBy: 'founder',
    supersedesRevision: 1,
  });
  const surface = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')[1]!;
  const resolved = resolveAssistantSurfaceConfig({ surface, profiles: [profile] });

  const bundle = createAssistantConfigBundle({
    resolved,
    modules: [{
      itemId: 'module.shared',
      revision: 3,
      checksum: 'abc123',
      kind: 'module',
    }],
  });

  assert.deepEqual(bundle.modules, [{
    itemId: 'module.shared',
    revision: 3,
    checksum: 'abc123',
    kind: 'module',
  }]);
});

test('delivery distinguishes repository verification from live application acknowledgement', () => {
  const delivery = createAssistantConfigDelivery({
    surfaceId: 'landing.iba',
    profileId: 'infinity-landing-assistant',
    profileRevision: 2,
    bundleChecksum: 'bundle123',
    targetKind: 'repository',
    target: 'owner/repo',
    targetRef: 'release',
    targetPath: '.infinity/assistant-control/iba.json',
    createdBy: 'founder',
    expectedHeadSha: 'head123',
    createdAt: '2026-10-01T10:00:00.000Z',
  });

  const published = markAssistantDeliveryPublished({
    delivery,
    commitSha: 'commit123',
    verified: true,
    updatedAt: '2026-10-01T10:01:00.000Z',
  });
  assert.equal(published.status, 'published_verified');
  assert.equal(published.attempts, 1);

  const applied = acknowledgeAssistantDelivery({
    delivery: published,
    observedBundleChecksum: 'bundle123',
    acknowledgementSource: 'product-health:iba',
    appliedAt: '2026-10-01T10:02:00.000Z',
  });
  assert.equal(applied.status, 'applied');
  assert.equal(applied.observedBundleChecksum, 'bundle123');

  assert.throws(
    () => acknowledgeAssistantDelivery({
      delivery: published,
      observedBundleChecksum: 'wrong',
      acknowledgementSource: 'product-health:iba',
    }),
    /checksum mismatch/,
  );
});
