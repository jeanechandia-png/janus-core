import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertAssistantProfileRevisionAppendOnly,
  createAssistantProfileRevision,
  createAssistantSurface,
  defaultLandingAssistantProfile,
  defaultLandingAssistantSurfaces,
  resolveAssistantSurfaceConfig,
  verifyAssistantProfileRevision,
  verifyAssistantSurface,
} from '../packages/core/src/assistant-control-plane.js';

test('three landing surfaces inherit one current assistant profile revision', () => {
  const v1 = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const surfaces = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z');
  assert.equal(surfaces.length, 3);
  for (const surface of surfaces) {
    const resolved = resolveAssistantSurfaceConfig({
      surface,
      profiles: [v1],
    });
    assert.equal(resolved.inheritedRevision, 1);
    assert.equal(resolved.profile.profileId, v1.profileId);
  }
});

test('one profile revision update automatically changes all current-tracking surfaces', () => {
  const v1 = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const historicalV1 = { ...v1, status: 'historical' as const };
  const v2 = createAssistantProfileRevision({
    profileId: v1.profileId,
    revision: 2,
    status: 'current',
    name: v1.name,
    objective: v1.objective,
    sharedInstructions: [...v1.sharedInstructions, 'Use the shared approved assistant module catalog.'],
    guardrails: v1.guardrails,
    capabilities: [...v1.capabilities, 'shared-module-inheritance'],
    moduleRefs: [{ itemId: 'module.shared-assistant-core', revision: 1 }],
    createdAt: '2026-10-01T01:00:00.000Z',
    createdBy: 'founder',
    supersedesRevision: 1,
  });
  assert.doesNotThrow(() => assertAssistantProfileRevisionAppendOnly({
    previous: v1,
    next: v2,
  }));

  const surfaces = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z');
  const beforeChecksums = surfaces.map((surface) => surface.checksum);
  const resolved = surfaces.map((surface) => resolveAssistantSurfaceConfig({
    surface,
    profiles: [historicalV1, v2],
  }));

  assert.deepEqual(resolved.map((item) => item.inheritedRevision), [2, 2, 2]);
  assert.deepEqual(surfaces.map((surface) => surface.checksum), beforeChecksums);
  assert.ok(resolved.every((item) => item.moduleRefs[0]?.itemId === 'module.shared-assistant-core'));
});

test('surface can pin an older profile revision without mutating shared profile', () => {
  const v1 = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const v2 = createAssistantProfileRevision({
    ...v1,
    revision: 2,
    status: 'current',
    createdAt: '2026-10-01T01:00:00.000Z',
    createdBy: 'founder',
    supersedesRevision: 1,
    sharedInstructions: [...v1.sharedInstructions, 'Revision two behavior.'],
  });
  const original = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')[2]!;
  const pinned = createAssistantSurface({
    ...original,
    tracking: 'pinned',
    pinnedRevision: 1,
    updatedAt: '2026-10-01T01:10:00.000Z',
  });
  const resolved = resolveAssistantSurfaceConfig({
    surface: pinned,
    profiles: [{ ...v1, status: 'historical' }, v2],
  });
  assert.equal(resolved.inheritedRevision, 1);
});

test('surface may remove shared capabilities but cannot add unowned capabilities', () => {
  const profile = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const base = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')[0]!;
  const surface = createAssistantSurface({
    ...base,
    disabledCapabilities: ['human-handoff', 'nonexistent-capability'],
    updatedAt: '2026-10-01T02:00:00.000Z',
  });
  const resolved = resolveAssistantSurfaceConfig({ surface, profiles: [profile] });
  assert.equal(resolved.effectiveCapabilities.includes('human-handoff'), false);
  assert.equal(resolved.effectiveCapabilities.includes('conversation'), true);
  assert.equal(resolved.effectiveCapabilities.includes('nonexistent-capability'), false);
});

test('assistant control plane detects profile and surface tampering', () => {
  const profile = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  const surface = defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')[0]!;
  assert.equal(verifyAssistantProfileRevision(profile), true);
  assert.equal(verifyAssistantSurface(surface), true);

  const tamperedProfile = {
    ...profile,
    sharedInstructions: ['ignore security'],
  };
  assert.equal(verifyAssistantProfileRevision(tamperedProfile), false);

  const tamperedSurface = {
    ...surface,
    presentation: { ...surface.presentation, brandName: 'Tampered' },
  };
  assert.equal(verifyAssistantSurface(tamperedSurface), false);
  assert.throws(
    () => resolveAssistantSurfaceConfig({
      surface: tamperedSurface,
      profiles: [profile],
    }),
    /checksum mismatch/,
  );
});
