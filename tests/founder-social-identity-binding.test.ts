import assert from 'node:assert/strict';
import test from 'node:test';
import {
  founderSocialIdentityBindingChronologyRecord,
  founderSocialIdentityBindingFromChronology,
  validateFounderSocialIdentityBinding,
} from '../packages/core/src/founder-social-identity-binding.js';

test('Founder social identity binding requires evidence and validates platform hosts', () => {
  assert.throws(() => validateFounderSocialIdentityBinding({
    referenceId: 'social-instagram-la-tribuna-virtual',
    platform: 'instagram',
    sourceUrl: 'https://www.instagram.com/la_tribuna_virtual',
    graphEntityId: '17841400000000000',
    evidenceRefs: [],
    verifiedAt: '2026-10-01T18:50:00.000Z',
    verifiedBy: 'founder',
  }), /evidence reference/i);

  assert.throws(() => validateFounderSocialIdentityBinding({
    referenceId: 'social-instagram-la-tribuna-virtual',
    platform: 'instagram',
    sourceUrl: 'https://www.instagram.com/la_tribuna_virtual',
    canonicalTargetUrl: 'https://www.facebook.com/example',
    evidenceRefs: ['meta-graph:identity-resolution'],
    verifiedAt: '2026-10-01T18:50:00.000Z',
    verifiedBy: 'founder',
  }), /does not match/i);
});

test('Facebook Graph binding requires canonical target resolution first', () => {
  assert.throws(() => validateFounderSocialIdentityBinding({
    referenceId: 'social-facebook-share-example',
    platform: 'facebook',
    sourceUrl: 'https://www.facebook.com/share/example/',
    graphEntityId: '1234567890',
    evidenceRefs: ['meta-graph:page-id:1234567890'],
    verifiedAt: '2026-10-01T18:51:00.000Z',
    verifiedBy: 'founder',
  }), /canonical target URL first/i);

  const resolved = validateFounderSocialIdentityBinding({
    referenceId: 'social-facebook-share-example',
    platform: 'facebook',
    sourceUrl: 'https://www.facebook.com/share/example/',
    canonicalTargetUrl: 'https://www.facebook.com/example.page',
    graphEntityId: '1234567890',
    evidenceRefs: ['meta-graph:page-id:1234567890'],
    verifiedAt: '2026-10-01T18:51:00.000Z',
    verifiedBy: 'founder',
  });

  assert.equal(resolved.state, 'graph_bound');
});

test('Founder social bindings preserve superseded history and round-trip from chronology', () => {
  const canonical = validateFounderSocialIdentityBinding({
    referenceId: 'social-facebook-share-example',
    platform: 'facebook',
    sourceUrl: 'https://www.facebook.com/share/example/',
    canonicalTargetUrl: 'https://www.facebook.com/example.page',
    evidenceRefs: ['manual-resolution:verified-page-url'],
    verifiedAt: '2026-10-01T18:52:00.000Z',
    verifiedBy: 'founder',
  });
  const first = founderSocialIdentityBindingChronologyRecord({ binding: canonical });

  const graphBound = validateFounderSocialIdentityBinding({
    ...canonical,
    graphEntityId: '1234567890',
    evidenceRefs: ['meta-graph:page-id:1234567890'],
    verifiedAt: '2026-10-01T18:53:00.000Z',
  });
  const second = founderSocialIdentityBindingChronologyRecord({
    binding: graphBound,
    previous: first,
  });

  assert.equal(second.supersedesId, first.id);
  assert.notEqual(second.id, first.id);
  const parsed = founderSocialIdentityBindingFromChronology(second);
  assert.equal(parsed?.graphEntityId, '1234567890');
  assert.equal(parsed?.state, 'graph_bound');
});
