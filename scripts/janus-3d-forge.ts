#!/usr/bin/env node
/**
 * JANUS 3D Forge — offline asset intake for the EXISTING JanusCreatureSlot.
 *
 * Commands:
 *   npm run forge:inspect -- --input /absolute/model.glb
 *   npm run forge:prepare -- --slot musgo --origin hyper3d-rodin --input /absolute/model.glb --pilot-use-until 2026-12-31
 *
 * Never uploads, trains, purchases, publishes, or changes a dashboard.
 * The staged GLB must still pass JanusCreatureSlot.inspect and human visual review.
 */
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { promises as fs } from 'node:fs';
import { resolve, join, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORGE_SLOTS, inspectForgeGlb, makeForgeReceipt,
  type ForgeOrigin, type ForgeSlot,
} from '../packages/modules/janus-3d-forge/src/index.js';

function parseArgs(argv: string[]): { command: string; flags: Map<string, string> } {
  const [command, ...raw] = argv;
  if (command !== 'inspect' && command !== 'prepare') {
    throw new Error('Use inspect or prepare. See scripts/janus-3d-forge.ts for examples.');
  }
  const flags = new Map<string, string>();
  for (let i = 0; i < raw.length; i += 2) {
    if (!raw[i]?.startsWith('--') || raw[i + 1] === undefined) {
      throw new Error('Expected --flag value pairs');
    }
    const name = raw[i]!.slice(2);
    if (flags.has(name)) throw new Error('Duplicate argument: --' + name);
    flags.set(name, raw[i + 1]!);
  }
  const allowed = new Set(['input', 'slot', 'origin', 'reference-sha256', 'pilot-use-until', 'rights-evidence', 'private-dir', 'expected-sha256']);
  for (const key of flags.keys()) if (!allowed.has(key)) throw new Error('Unknown flag: --' + key);
  if (!flags.get('input')) throw new Error('Missing --input');
  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const filepath = resolve(flags.get('input')!);
  if (extname(filepath).toLowerCase() !== '.glb') throw new Error('Only .glb files are supported');
  const bytes = await fs.readFile(filepath);
  const expected = flags.get('expected-sha256');
  if (expected !== undefined && (!/^[a-f0-9]{64}$/i.test(expected) || createHash('sha256').update(bytes).digest('hex') !== expected.toLowerCase())) {
    throw new Error('Original GLB SHA-256 mismatch; no model staged');
  }
  const inspected = inspectForgeGlb(bytes);
  if (command === 'inspect') {
    process.stdout.write(JSON.stringify(inspected, null, 2) + '\n');
    if (!inspected.valid) process.exitCode = 2;
    return;
  }
  const slot = flags.get('slot') as ForgeSlot;
  const origin = flags.get('origin') as ForgeOrigin;
  if (!FORGE_SLOTS.includes(slot)) throw new Error('Use a canonical PWA slot: ' + FORGE_SLOTS.join(', '));
  if (!['hyper3d-rodin', 'janus-trellis2-local', 'manual-local'].includes(origin)) {
    throw new Error('Use --origin hyper3d-rodin | janus-trellis2-local | manual-local');
  }
  const receipt = makeForgeReceipt(bytes, {
    slot, origin, sourceSha256: createHash('sha256').update(bytes).digest('hex'),
    rightsStatus: flags.has('rights-evidence') ? 'reviewed' : 'pending_review',
    ...(flags.has('rights-evidence') ? { rightsEvidence: flags.get('rights-evidence') } : {}),
    ...(flags.has('reference-sha256') ? { referenceSha256: flags.get('reference-sha256') } : {}),
    ...(flags.has('pilot-use-until') ? { pilotUseUntil: flags.get('pilot-use-until') } : {}),
  });
  if (receipt.status === 'rejected') {
    process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
    process.exitCode = 2;
    return;
  }

  const root = resolve(flags.get('private-dir') || join(homedir(), '.janus', 'private', '3d-forge'));
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (root === repositoryRoot || root.startsWith(repositoryRoot + sep)) {
    throw new Error('Refusing to store private 3D assets inside the public JANUS repository');
  }
  const folder = join(root, slot);
  await fs.mkdir(folder, { recursive: true, mode: 0o700 });
  const filename = receipt.sourceSha256 + '.glb';
  const destination = join(folder, filename);
  try {
    await fs.writeFile(destination, bytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existing = await fs.readFile(destination);
    if (createHash('sha256').update(existing).digest('hex') !== receipt.sourceSha256) {
      throw new Error('Existing staged asset has an unexpected checksum');
    }
  }
  const receiptFilename = join(folder, receipt.sourceSha256 + '.receipt.json');
  try {
    await fs.writeFile(receiptFilename, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    // Immutable first-write receipt: never silently upgrade rights or approval metadata.
  }
  process.stdout.write(JSON.stringify({
    status: receipt.status, slot: receipt.slot, origin: receipt.origin,
    sha256: receipt.sourceSha256, assetPath: destination, receiptPath: receiptFilename,
    nextGate: receipt.nextGate, warnings: receipt.warnings,
    message: 'LOCAL PREVIEW ONLY: import GLB through the existing private PWA slot and review visually before use.',
  }, null, 2) + '\n');
}

main().catch((error: unknown) => {
  process.stderr.write('JANUS 3D Forge: ' + (error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
});
