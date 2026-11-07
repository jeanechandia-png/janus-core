import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPROVED_CHARACTER_SELECTION,
  getApprovedCharacterSlot,
  isApprovedCharacterOrigin,
  isCharacterReady,
} from '../packages/modules/companion/src/index.js';

test('dirección visual 2026-11-05: dos criaturas aprobadas y robot original tercero', () => {
  assert.deepEqual(APPROVED_CHARACTER_SELECTION.map((c) => c.position), [1, 2, 3]);
  assert.deepEqual(APPROVED_CHARACTER_SELECTION.map((c) => c.kind), ['creature', 'creature', 'robot']);
  assert.equal(APPROVED_CHARACTER_SELECTION[2]?.id, 'janus-original-robot');
  assert.equal(APPROVED_CHARACTER_SELECTION[2]?.role, 'evolution-archive');
  assert.ok(APPROVED_CHARACTER_SELECTION.slice(0, 2).every((c) => c.origin === 'chatgpt-approved-design'));
});

test('las criaturas de Claude nunca se consideran aprobadas', () => {
  assert.equal(isApprovedCharacterOrigin('claude-generated'), false);
  assert.equal(isApprovedCharacterOrigin('claude'), false);
  assert.throws(() => getApprovedCharacterSlot('bombo'), /no aprobado/);
  assert.equal(getApprovedCharacterSlot('approved-creature-02').position, 2);
});

test('no se simula un personaje 3D sin activos verificados', () => {
  assert.ok(APPROVED_CHARACTER_SELECTION.every((c) => !isCharacterReady(c)));
  const loaded = {
    ...getApprovedCharacterSlot('approved-creature-01'),
    assets: { previewImage: '/verified/approved-01.png', model3d: '/verified/approved-01.glb' },
  };
  assert.equal(isCharacterReady(loaded), true);
  assert.equal(isCharacterReady({ ...loaded, origin: 'claude' as any }), false);
});
