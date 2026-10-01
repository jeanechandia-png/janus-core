import assert from 'node:assert/strict';
import test from 'node:test';
import {
  founderReferenceChronologyRecord,
  founderReferenceNeedsUpdate,
  parseFounderReferenceLibrary,
} from '../packages/core/src/founder-reference-library.js';

test('Founder reference library validates preserved current references', () => {
  const document = parseFounderReferenceLibrary({
    schemaVersion: 1,
    ownerPrincipalId: 'founder',
    updatedAt: '2026-10-01T00:00:00.000Z',
    records: [{
      id: 'instagram-example',
      subject: 'founder-reference:social:instagram:example',
      kind: 'reference',
      classification: 'current',
      label: 'Instagram example',
      value: 'https://www.instagram.com/example',
      retention: 'preserve',
      tags: ['social', 'instagram'],
    }],
  });

  assert.equal(document.records.length, 1);
  assert.equal(document.records[0]?.retention, 'preserve');
});

test('Founder reference chronology preserves prior revisions as superseded history', () => {
  const seed = {
    id: 'instagram-example',
    subject: 'founder-reference:social:instagram:example',
    kind: 'reference' as const,
    classification: 'current' as const,
    label: 'Instagram example',
    value: 'https://www.instagram.com/example',
    retention: 'preserve' as const,
    tags: ['social', 'instagram'],
  };
  const first = founderReferenceChronologyRecord({
    seed,
    ownerPrincipalId: 'founder',
    at: '2026-10-01T00:00:00.000Z',
  });
  const second = founderReferenceChronologyRecord({
    seed: { ...seed, value: 'https://www.instagram.com/example2' },
    ownerPrincipalId: 'founder',
    at: '2026-10-02T00:00:00.000Z',
    previous: first,
  });

  assert.equal(second.supersedesId, first.id);
  assert.equal(founderReferenceNeedsUpdate(seed, first), false);
  assert.equal(
    founderReferenceNeedsUpdate({ ...seed, value: 'https://www.instagram.com/example2' }, first),
    true,
  );
});

test('Founder policy records may preserve biometric-storage consent without biometric material', () => {
  const document = parseFounderReferenceLibrary({
    schemaVersion: 1,
    ownerPrincipalId: 'founder',
    updatedAt: '2026-10-01T00:00:00.000Z',
    records: [{
      id: 'biometric-consent',
      subject: 'founder-policy:biometric-storage-consent',
      kind: 'policy',
      classification: 'current',
      label: 'Biometric storage authorization',
      value: 'Founder authorizes local biometric storage if operationally necessary.',
      retention: 'preserve',
      tags: ['security', 'biometric'],
    }],
  });

  const serialized = JSON.stringify(document);
  assert.equal(serialized.includes('face image'), false);
  assert.equal(serialized.includes('template bytes'), false);
});
