import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHARACTER_SLOTS, CharacterLibrary, CHARACTER_UPLOAD_LIMIT,
} from '../packages/modules/character-library/src/index.js';
import { doc, glb, inspector, sha } from './helpers/glb-fixture.js';
import { FORGE_GLB_MAX_BYTES, FORGE_SLOTS } from '../packages/modules/janus-3d-forge/src/index.js';

const tempRoot = () => join(mkdtempSync(join(tmpdir(), 'janus-characters-')), 'private');

test('la biblioteca admite un GLB de Rodin como parcial y pendiente de revisión visual', () => {
  const lib = new CharacterLibrary(tempRoot(), { inspector });
  const bytes = glb(doc('rodin-a'));
  const result = lib.admit({ slot: 'nexo-masculino', bytes, origin: 'hyper3d-rodin' });
  assert.ok(result.ok);
  assert.equal(result.duplicate, false);
  assert.equal(result.entry.tier, 'partial');
  assert.equal(result.entry.review, 'pending_visual_review');
  assert.equal(result.entry.sha256, sha(bytes));
  assert.equal(result.entry.origin, 'hyper3d-rodin');
  assert.ok(result.entry.warnings.some((w) => /static preview/.test(w)));
  const view = lib.overview().find((item) => item.slot === 'nexo-masculino')!;
  assert.equal(view.active?.sha256, sha(bytes));
  assert.equal(view.servable, undefined, 'nada sin aprobar llega a superficies de menores');
  assert.deepEqual(lib.kidOverview(), []);
});

test('rechaza slots ajenos, orígenes desconocidos, GLB corruptos y archivos excesivos', () => {
  const lib = new CharacterLibrary(tempRoot(), { inspector });
  const bytes = glb(doc('x'));
  const wrongSlot = lib.admit({ slot: 'robot', bytes });
  assert.ok(!wrongSlot.ok && wrongSlot.code === 'unknown_slot');
  const wrongOrigin = lib.admit({ slot: 'lumi', bytes, origin: 'otra-cosa' });
  assert.ok(!wrongOrigin.ok && wrongOrigin.code === 'unknown_origin');
  const broken = lib.admit({ slot: 'lumi', bytes: Buffer.from('no soy un glb, soy texto de relleno suficiente') });
  assert.ok(!broken.ok && broken.code === 'invalid_model');
  const huge = lib.admit({ slot: 'lumi', bytes: new Uint8Array(CHARACTER_UPLOAD_LIMIT + 1) });
  assert.ok(!huge.ok && huge.code === 'too_large');
  assert.deepEqual(lib.overview().map((item) => item.versions), [0, 0, 0, 0, 0, 0]);
});

test('subida idempotente: el mismo archivo no duplica ni reinicia la aprobación', () => {
  const lib = new CharacterLibrary(tempRoot(), { inspector });
  const bytes = glb(doc('idem'));
  const first = lib.admit({ slot: 'lumi', bytes, origin: 'hyper3d-rodin' });
  assert.ok(first.ok);
  lib.review('lumi', first.entry.sha256, 'approved');
  const again = lib.admit({ slot: 'lumi', bytes, origin: 'hyper3d-rodin' });
  assert.ok(again.ok && again.duplicate);
  assert.equal(again.entry.review, 'approved');
  assert.equal(lib.overview().find((item) => item.slot === 'lumi')!.versions, 1);
});

test('Kendra solo recibe modelos aprobados y una versión nueva no retira la aprobada', () => {
  const lib = new CharacterLibrary(tempRoot(), { inspector });
  const a = lib.admit({ slot: 'bombo', bytes: glb(doc('v1')) });
  const b = lib.admit({ slot: 'bombo', bytes: glb(doc('v2', 600)) });
  assert.ok(a.ok && b.ok);
  assert.deepEqual(lib.kidOverview(), []);
  lib.review('bombo', a.entry.sha256, 'approved');
  assert.deepEqual(lib.kidOverview().map((c) => [c.slot, c.sha256]), [['bombo', a.entry.sha256]]);
  // v2 es la activa del Founder (pendiente) pero Kendra sigue viendo v1 aprobada.
  const view = lib.overview().find((item) => item.slot === 'bombo')!;
  assert.equal(view.active?.sha256, b.entry.sha256);
  assert.equal(view.servable?.sha256, a.entry.sha256);
  lib.review('bombo', a.entry.sha256, 'rejected');
  assert.deepEqual(lib.kidOverview(), []);
});

test('los bytes se sirven verificando la huella y no se aceptan rutas ni huellas ajenas', () => {
  const root = tempRoot();
  const lib = new CharacterLibrary(root, { inspector });
  const bytes = glb(doc('serve'));
  const result = lib.admit({ slot: 'musgo', bytes });
  assert.ok(result.ok);
  assert.deepEqual(lib.bytes('musgo', result.entry.sha256), Buffer.from(bytes));
  assert.equal(lib.bytes('lumi', result.entry.sha256), undefined);
  assert.equal(lib.bytes('musgo', '../../etc/passwd'), undefined);
  assert.equal(lib.bytes('../musgo', result.entry.sha256), undefined);
  writeFileSync(join(root, 'musgo', result.entry.sha256 + '.glb'), Buffer.from(bytes).fill(1, 40, 60));
  assert.equal(lib.bytes('musgo', result.entry.sha256), undefined, 'un archivo alterado no se sirve');
});

test('el estado persiste al reabrir y el recibo nunca autoriza entrenamiento', () => {
  const root = tempRoot();
  const first = new CharacterLibrary(root, { inspector });
  const added = first.admit({ slot: 'nimbo', bytes: glb(doc('persist')), origin: 'hyper3d-rodin', pilotUseUntil: '2026-12-31' });
  assert.ok(added.ok);
  first.review('nimbo', added.entry.sha256, 'approved');
  const reopened = new CharacterLibrary(root, { inspector });
  assert.equal(reopened.kidOverview()[0]?.sha256, added.entry.sha256);
  const receipt = JSON.parse(readFileSync(join(root, 'nimbo', added.entry.sha256 + '.receipt.json'), 'utf8')) as Record<string, unknown>;
  assert.equal(receipt.trainingAllowedFromThisAsset, false);
  assert.equal(receipt.pilotUseUntil, '2026-12-31');
  assert.equal(receipt.rightsStatus, 'pending_review');
  if (process.platform !== 'win32') assert.equal(statSync(join(root, 'nimbo', added.entry.sha256 + '.glb')).mode & 0o077, 0, 'archivos privados 0600');
});

test('adopta los GLB que dejó el comando forge:prepare y rehace un índice dañado sin perderlos', () => {
  const root = tempRoot();
  const bytes = glb(doc('staged'));
  const hash = sha(bytes);
  mkdirSync(join(root, 'nexo-femenino'), { recursive: true });
  writeFileSync(join(root, 'nexo-femenino', hash + '.glb'), bytes);
  writeFileSync(join(root, 'nexo-femenino', hash + '.receipt.json'), JSON.stringify({ origin: 'hyper3d-rodin', createdAt: '2026-11-24T10:00:00.000Z' }));
  const lib = new CharacterLibrary(root, { inspector });
  assert.equal(lib.overview().find((item) => item.slot === 'nexo-femenino')!.active?.origin, 'hyper3d-rodin');
  lib.review('nexo-femenino', hash, 'approved');
  writeFileSync(join(root, 'library-index.json'), '{ esto no es json');
  const recovered = new CharacterLibrary(root, { inspector });
  const entry = recovered.overview().find((item) => item.slot === 'nexo-femenino')!.active!;
  assert.equal(entry.sha256, hash);
  assert.equal(entry.review, 'pending_visual_review', 'si se pierde el índice, la aprobación vuelve a pedirse');
  assert.ok(readdirSync(root).some((name) => name.startsWith('library-index.json.corrupt-')));
});

test('se niega a guardar activos privados dentro del repositorio público', () => {
  const repo = mkdtempSync(join(tmpdir(), 'janus-repo-'));
  assert.throws(() => new CharacterLibrary(join(repo, 'assets'), { inspector, repositoryRoot: repo }), /public JANUS repository/);
  assert.equal(existsSync(join(repo, 'assets')), false);
  assert.equal(CHARACTER_SLOTS.length, 6);
});

test('la lista de personajes y el tope de tamaño no se desincronizan de 3D Forge', () => {
  assert.deepEqual([...CHARACTER_SLOTS], [...FORGE_SLOTS]);
  assert.equal(CHARACTER_UPLOAD_LIMIT, FORGE_GLB_MAX_BYTES);
});
