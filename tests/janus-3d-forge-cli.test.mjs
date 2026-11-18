import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function syntheticGlb() {
  const json = Buffer.from(JSON.stringify({
    asset: { version: '2.0' },
    buffers: [{ byteLength: 144 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 108 },
      { buffer: 0, byteOffset: 108, byteLength: 36 },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { count: 9, bufferView: 0, componentType: 5126, type: 'VEC3' },
      { count: 9, bufferView: 1, componentType: 5125, type: 'SCALAR' },
    ],
    nodes: [{ name: 'mesh', mesh: 0 }],
  }), 'utf8');
  const size = Math.ceil(json.length / 4) * 4;
  const buffer = Buffer.alloc(28 + size + 144, 0);
  buffer.writeUInt32LE(0x46546c67, 0);
  buffer.writeUInt32LE(2, 4);
  buffer.writeUInt32LE(buffer.length, 8);
  buffer.writeUInt32LE(size, 12);
  buffer.writeUInt32LE(0x4e4f534a, 16);
  buffer.fill(0x20, 20, 20 + size);
  json.copy(buffer, 20);
  buffer.writeUInt32LE(144, 20 + size);
  buffer.writeUInt32LE(0x004e4942, 24 + size);
  buffer.writeFloatLE(1, 28 + size + 12);
  buffer.writeFloatLE(1, 28 + size + 28);
  return buffer;
}
function cli(command, args) {
  return spawnSync(process.execPath,
    ['--import', 'tsx', 'scripts/janus-3d-forge.ts', command, ...args],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 20000 });
}
test('Forge CLI stages local preview reproducibly without publishing or modifying dashboard', () => {
  const temp = mkdtempSync(join(tmpdir(), 'janus-forge-ci-'));
  try {
    const img = join(temp, 'model.glb');
    const privateDir = join(temp, 'private');
    const original = syntheticGlb();
    writeFileSync(img, original);
    const args = ['--input', img, '--slot', 'musgo', '--origin', 'hyper3d-rodin',
      '--private-dir', privateDir, '--pilot-use-until', '2026-12-31'];
    const preflight = cli('inspect', ['--input', img]);
    assert.equal(preflight.status, 0, preflight.stderr);
    assert.equal(JSON.parse(preflight.stdout).valid, true);
    const staged = cli('prepare', args);
    assert.equal(staged.status, 0, staged.stderr);
    const report = JSON.parse(staged.stdout);
    assert.equal(report.status, 'preview_only');
    assert.ok(existsSync(report.assetPath));
    assert.deepEqual(readFileSync(report.assetPath), original);
    const receipt = JSON.parse(readFileSync(report.receiptPath, 'utf8'));
    assert.equal(receipt.trainingAllowedFromThisAsset, false);
    assert.equal(receipt.rightsStatus, 'pending_review');
    assert.equal(receipt.origin, 'hyper3d-rodin');
    assert.equal(receipt.pilotUseUntil, '2026-12-31');
    assert.equal(receipt.nextGate, 'pwa_contract_and_human_visual_review');
    if (process.platform !== 'win32') assert.equal(statSync(report.assetPath).mode & 0o777, 0o600);
    assert.equal(cli('prepare', args).status, 0, 'idempotent: no overwrite');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('Forge CLI refuses corrupt input and never stages it', () => {
  const temp = mkdtempSync(join(tmpdir(), 'janus-forge-invalid-'));
  try {
    const bad = join(temp, 'bad.glb');
    writeFileSync(bad, 'fake-3d');
    const dest = join(temp, 'private');
    const result = cli('prepare', ['--slot', 'lumi', '--origin', 'manual-local',
      '--input', bad, '--private-dir', dest]);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).status, 'rejected');
    assert.equal(existsSync(join(dest, 'lumi')), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('Forge CLI refuses staging assets under the public JANUS source tree', () => {
  const temp = mkdtempSync(join(tmpdir(), 'janus-forge-no-public-'));
  try {
    const glbPath = join(temp, 'source.glb');
    writeFileSync(glbPath, syntheticGlb());
    const result = cli('prepare', ['--slot', 'nimbo', '--origin', 'manual-local',
      '--input', glbPath, '--private-dir', join(process.cwd(), 'assets', 'private-temp')]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /public JANUS repository/);
    assert.equal(existsSync(join(process.cwd(), 'assets', 'private-temp')), false);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
