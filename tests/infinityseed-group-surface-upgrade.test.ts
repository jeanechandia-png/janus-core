import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INFINITY_GROUP_CHATBOX_RUNTIME_TARGET,
  createAssistantSurface,
  defaultLandingAssistantSurfaces,
  upgradeInfinitySeedGroupSurface,
  verifyAssistantSurface,
} from '../packages/core/src/assistant-control-plane.js';

function legacySeed(createdBy = 'janus-core') {
  const current = defaultLandingAssistantSurfaces().find((surface) => surface.id === 'landing.infinity-group')!;
  return createAssistantSurface({
    ...current,
    name: 'Infinity Group main landing assistant',
    presentation: { ...current.presentation, brandName: 'Infinity Group', disclosure: 'AI assistant for Infinity Group.' },
    deliveryTargets: [current.deliveryTargets[0]!],
    createdBy,
  });
}

test('new seeds use the canonical InfinitySeed Group name and both delivery targets', () => {
  const surface = defaultLandingAssistantSurfaces().find((item) => item.id === 'landing.infinity-group')!;
  assert.equal(surface.presentation.brandName, 'InfinitySeed Group');
  assert.equal(surface.deliveryTargets.length, 2);
  assert.equal(surface.deliveryTargets[0]!.target, 'jeanechandia-png/infinityseed-group-website');
  assert.equal(surface.deliveryTargets[1]!.target, INFINITY_GROUP_CHATBOX_RUNTIME_TARGET.target);
});

test('legacy installations are corrected additively: brand fixed, original target kept first', () => {
  const upgraded = upgradeInfinitySeedGroupSurface(legacySeed(), '2026-10-13T18:30:00.000Z')!;
  assert.ok(upgraded);
  assert.equal(upgraded.presentation.brandName, 'InfinitySeed Group');
  assert.equal(upgraded.presentation.disclosure, 'AI assistant for InfinitySeed Group.');
  assert.equal(upgraded.name, 'InfinitySeed Group main landing assistant');
  assert.deepEqual(upgraded.deliveryTargets.map((target) => target.target), [
    'jeanechandia-png/infinityseed-group-website',
    'jeanechandia-png/infinity-chatbox-platform',
  ]);
  assert.equal(verifyAssistantSurface(upgraded), true);
  assert.equal(upgradeInfinitySeedGroupSurface(upgraded, '2026-10-13T19:00:00.000Z'), null, 'idempotent');
});

test('surfaces created or edited by a human are never auto-migrated', () => {
  assert.equal(upgradeInfinitySeedGroupSurface(legacySeed('founder'), '2026-10-13T18:30:00.000Z'), null);
});

test('other surfaces are untouched', () => {
  for (const surface of defaultLandingAssistantSurfaces().filter((item) => item.id !== 'landing.infinity-group')) {
    assert.equal(upgradeInfinitySeedGroupSurface(surface, '2026-10-13T18:30:00.000Z'), null);
  }
});
