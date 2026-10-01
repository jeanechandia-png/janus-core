import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';
import { buildFounderSocialSourceRegistry } from '../packages/core/src/founder-social-sources.js';

test('Founder social source registry is read-only and preserves exact source URLs', () => {
  const instagramUrl =
    'https://www.instagram.com/la_tribuna_virtual?stkn=MWY2OWdiNzRyaWw1Zg%3D%3D&utm_source=qr';
  const facebookUrl =
    'https://www.facebook.com/share/19TFEYdcNk/?mibextid=wwXIfr';
  const document = parseFounderReferenceLibrary({
    schemaVersion: 1,
    ownerPrincipalId: 'founder',
    updatedAt: '2026-10-01T00:00:00.000Z',
    records: [
      {
        id: 'instagram-la-tribuna',
        subject: 'founder-reference:social:instagram:la-tribuna',
        kind: 'reference',
        classification: 'current',
        label: 'Instagram — La Tribuna Virtual',
        value: instagramUrl,
        retention: 'preserve',
        tags: ['social', 'instagram'],
      },
      {
        id: 'facebook-share',
        subject: 'founder-reference:social:facebook:share',
        kind: 'reference',
        classification: 'current',
        label: 'Facebook reference',
        value: facebookUrl,
        retention: 'preserve',
        tags: ['social', 'facebook', 'canonical-target-unresolved'],
      },
      {
        id: 'policy',
        subject: 'founder-policy:example',
        kind: 'policy',
        classification: 'current',
        label: 'Policy',
        value: 'Keep provider credentials outside source control.',
        retention: 'preserve',
        tags: ['security'],
      },
    ],
  });

  const registry = buildFounderSocialSourceRegistry(document);

  assert.equal(registry.policy.mode, 'read_only');
  assert.equal(registry.policy.publishingAllowed, false);
  assert.equal(registry.policy.directMessagingAllowed, false);
  assert.equal(registry.policy.campaignManagementAllowed, false);
  assert.equal(registry.policy.spendAllowed, false);
  assert.equal(registry.sources.length, 2);

  const instagram = registry.sources.find((source) => source.platform === 'instagram');
  assert.equal(instagram?.sourceUrl, instagramUrl);
  assert.equal(instagram?.publicHandle, 'la_tribuna_virtual');
  assert.equal(instagram?.graphEntityId, null);
  assert.equal(instagram?.bindingState, 'graph_entity_unbound');
  assert.deepEqual(instagram?.permittedReadActions, ['instagram.account.insights']);

  const facebook = registry.sources.find((source) => source.platform === 'facebook');
  assert.equal(facebook?.sourceUrl, facebookUrl);
  assert.equal(facebook?.shareToken, '19TFEYdcNk');
  assert.equal(facebook?.canonicalTarget, null);
  assert.equal(facebook?.graphEntityId, null);
  assert.equal(facebook?.bindingState, 'canonical_target_unresolved');
  assert.deepEqual(facebook?.permittedReadActions, ['facebook.page.insights']);
});
