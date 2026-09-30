import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReusableRevisionAppendOnly,
  createReusableLibraryItem,
  resolveReusableSelection,
  verifyReusableLibraryItem,
} from '../packages/core/src/reusable-library.js';

test('reusable library resolves current component with versioned dependencies', () => {
  const icon = createReusableLibraryItem({
    id: 'icon.translate',
    revision: 1,
    status: 'current',
    kind: 'icon',
    name: 'Translate icon',
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
    tags: ['translator', 'shared'],
    compatibility: ['web', 'pwa'],
    spec: { shape: 'medallion' },
  });
  const button = createReusableLibraryItem({
    id: 'button.hyperreal.glow',
    revision: 1,
    status: 'current',
    kind: 'button',
    name: 'Hyperreal illuminated button',
    createdAt: '2026-10-01T08:01:00.000Z',
    createdBy: 'founder',
    tags: ['hyperreal', 'illuminated'],
    compatibility: ['web', 'pwa'],
    dependencies: [{ itemId: icon.id, revision: icon.revision }],
    spec: { depth: 'high', illumination: true },
  });

  const selection = resolveReusableSelection({
    itemId: button.id,
    items: [icon, button],
  });

  assert.equal(selection.item.id, button.id);
  assert.equal(selection.dependencyItems.length, 1);
  assert.equal(selection.dependencyItems[0]?.id, icon.id);
  assert.equal(verifyReusableLibraryItem(button), true);
});

test('new reusable revision is append-only and lifecycle status does not change content checksum', () => {
  const v1 = createReusableLibraryItem({
    id: 'font.infinity.primary',
    revision: 1,
    status: 'current',
    kind: 'font',
    name: 'Infinity primary typography',
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
    spec: { family: 'Inter', weight: 600 },
  });
  const historical = { ...v1, status: 'historical' as const };
  assert.equal(verifyReusableLibraryItem(historical), true);
  assert.equal(historical.checksum, v1.checksum);

  const v2 = createReusableLibraryItem({
    id: v1.id,
    revision: 2,
    status: 'current',
    kind: 'font',
    name: 'Infinity primary typography',
    createdAt: '2026-10-01T09:00:00.000Z',
    createdBy: 'founder',
    supersedesRevision: 1,
    spec: { family: 'Inter', weight: 700 },
  });
  assert.doesNotThrow(() => assertReusableRevisionAppendOnly({ previous: v1, next: v2 }));

  assert.throws(
    () => assertReusableRevisionAppendOnly({
      previous: v1,
      next: { ...v2, revision: 3 },
    }),
    /increment by exactly one/,
  );
});

test('reusable library fails closed on checksum tampering and missing dependencies', () => {
  const button = createReusableLibraryItem({
    id: 'button.safe',
    revision: 1,
    status: 'current',
    kind: 'button',
    name: 'Safe button',
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
    dependencies: [{ itemId: 'icon.missing' }],
    spec: { illumination: true },
  });

  assert.throws(
    () => resolveReusableSelection({ itemId: button.id, items: [button] }),
    /missing reusable dependency/,
  );

  const tampered = {
    ...button,
    spec: { illumination: false },
  };
  assert.equal(verifyReusableLibraryItem(tampered), false);
  assert.throws(
    () => resolveReusableSelection({ itemId: tampered.id, items: [tampered] }),
    /checksum mismatch/,
  );
});
