import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  FORGE_SLOTS, inspectForgeGlb, makeForgeReceipt,
  FORGE_REQUIRED_BONES, FORGE_REQUIRED_MORPHS, FORGE_REQUIRED_CLIPS, FORGE_REQUIRED_SOCKETS,
} from '../packages/modules/janus-3d-forge/src/index.js';

type Document = Record<string, unknown>;
function glb(doc: Document): Uint8Array {
  const json = Buffer.from(JSON.stringify(doc), 'utf8');
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const out = Buffer.alloc(20 + jsonLength, 0x20);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonLength, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  json.copy(out, 20);
  return out;
}
function baseDoc(): Document {
  return {
    asset: { version: '2.0' },
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
    accessors: [{ count: 300 }, { count: 300 }],
    nodes: [{ name: 'mesh', mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
}
function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

test('3D Forge accepts a real GLB 2.0 container for PREVIEW, never final art approval', () => {
  const bytes = glb(baseDoc());
  const inspection = inspectForgeGlb(bytes);
  assert.equal(inspection.valid, true);
  assert.equal(inspection.triangles, 100);
  assert.equal(inspection.meshes, 1);
  assert.ok(inspection.warnings.some((w) => /static preview/.test(w)));
  const receipt = makeForgeReceipt(bytes, {
    slot: 'musgo', origin: 'hyper3d-rodin', sourceSha256: checksum(bytes),
    rightsStatus: 'pending_review', pilotUseUntil: '2026-12-31',
  }, new Date('2026-11-18T12:00:00Z'));
  assert.equal(receipt.status, 'preview_only');
  assert.equal(receipt.trainingAllowedFromThisAsset, false);
  assert.equal(receipt.pilotUseUntil, '2026-12-31');
  assert.equal(receipt.nextGate, 'pwa_contract_and_human_visual_review');
  assert.equal(receipt.createdAt, '2026-11-18T12:00:00.000Z');
  assert.equal(receipt.rightsStatus, 'pending_review');
});

test('3D Forge is independently reusable across exactly the six approved slots', () => {
  assert.deepEqual(FORGE_SLOTS, ['lumi', 'bombo', 'musgo', 'nimbo', 'nexo-masculino', 'nexo-femenino']);
  const bytes = glb(baseDoc());
  for (const slot of FORGE_SLOTS) {
    const receipt = makeForgeReceipt(bytes, { slot, origin: 'manual-local',
      rightsStatus: 'reviewed', rightsEvidence: 'private local asset author approval', sourceSha256: checksum(bytes) });
    assert.equal(receipt.slot, slot);
    assert.equal(receipt.status, 'preview_only');
    assert.equal(receipt.trainingAllowedFromThisAsset, false);
  }
  assert.throws(() => makeForgeReceipt(bytes, { slot: 'robot' as never, origin: 'manual-local',
    rightsStatus: 'pending_review', sourceSha256: checksum(bytes) }), /Unknown approved/);
});

test('3D Forge rejects corrupt, mismatched, non-mesh or disallowed compressed GLB', () => {
  const valid = glb(baseDoc());
  const wrongLength = Buffer.from(valid);
  wrongLength.writeUInt32LE(valid.length + 4, 8);
  assert.equal(inspectForgeGlb(wrongLength).valid, false);
  assert.ok(inspectForgeGlb(wrongLength).blocked.some((x) => /length/.test(x)));
  const empty = glb({ asset: { version: '2.0' }, meshes: [] });
  assert.equal(inspectForgeGlb(empty).valid, false);
  assert.equal(inspectForgeGlb(Buffer.from('not a GLB')).valid, false);
  const draco = glb({ ...baseDoc(), extensionsRequired: ['KHR_draco_mesh_compression'] });
  assert.equal(inspectForgeGlb(draco).valid, false);
  const ktx = glb({ ...baseDoc(), extensionsRequired: ['KHR_texture_basisu'] });
  assert.equal(inspectForgeGlb(ktx).valid, false);
  const meshDraco = glb({ ...baseDoc(), meshes: [{ primitives: [{ attributes: { POSITION: 0 }, extensions: { KHR_draco_mesh_compression: {} } }] }] });
  assert.equal(inspectForgeGlb(meshDraco).valid, false);
});

test('3D Forge checks iPhone triangle limits and flags heavy meshes', () => {
  const big = baseDoc();
  big.accessors = [{ count: 1_000_000 }, { count: 1_000_000 }];
  assert.equal(inspectForgeGlb(glb(big)).valid, false);
  big.accessors = [{ count: 290_000 }, { count: 290_000 }];
  const medium = inspectForgeGlb(glb(big));
  assert.equal(medium.valid, true);
  assert.ok(medium.warnings.some((w) => /iPhone/.test(w)));
});

test('3D Forge validates provenance, SHA and rights evidence; never silently approves a commercial license', () => {
  const bytes = glb(baseDoc());
  const form = { slot: 'lumi' as const, origin: 'hyper3d-rodin' as const,
    sourceSha256: checksum(bytes), rightsStatus: 'pending_review' as const };
  assert.throws(() => makeForgeReceipt(bytes, { ...form, sourceSha256: 'a'.repeat(64) }), /does not match/);
  assert.throws(() => makeForgeReceipt(bytes, { ...form, rightsStatus: 'reviewed' }), /requires traceable/);
  assert.throws(() => makeForgeReceipt(bytes, { ...form, pilotUseUntil: 'December' }), /YYYY-MM-DD/);
  const receipt = makeForgeReceipt(bytes, { ...form, rightsStatus: 'reviewed', rightsEvidence: 'invoice+terms reviewed' });
  assert.equal(receipt.rightsStatus, 'reviewed');
  assert.equal(receipt.status, 'preview_only');
  assert.equal(receipt.trainingAllowedFromThisAsset, false);
});

test('3D Forge reports the PWA contract names without inventing missing animation capability', () => {
  const doc = baseDoc();
  const extraNodes = [
    ...FORGE_REQUIRED_BONES.map((name) => ({ name })),
    ...FORGE_REQUIRED_SOCKETS.map((name) => ({ name })),
  ];
  doc.nodes = [{ name: 'mesh', mesh: 0, skin: 0 }, ...extraNodes];
  doc.skins = [{ joints: FORGE_REQUIRED_BONES.map((_, i) => i + 1) }];
  doc.animations = FORGE_REQUIRED_CLIPS.map((name) => ({ name }));
  doc.meshes = [{ primitives: [{ attributes: { POSITION: 0 }, targets: FORGE_REQUIRED_MORPHS.map(() => ({ POSITION: 0 })) }],
    extras: { targetNames: [...FORGE_REQUIRED_MORPHS] } }];
  const result = inspectForgeGlb(glb(doc));
  assert.equal(result.valid, true);
  assert.equal(result.skinned, true);
  assert.deepEqual(result.missing, { bones: [], morphs: [], clips: [], sockets: [] });
  const receipt = makeForgeReceipt(glb(doc), { slot: 'nimbo', origin: 'janus-trellis2-local',
    sourceSha256: checksum(glb(doc)), rightsStatus: 'pending_review' });
  assert.equal(receipt.status, 'preview_only', 'even a plausible rig is not automatically visually approved');
});
