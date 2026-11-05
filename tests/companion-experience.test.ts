import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { APPROVED_CHARACTER_SELECTION } from '../packages/modules/companion/src/index.js';
// @ts-expect-error browser ES module, intentionally shared with the offline PWA
import {
  initialCompanionState, restoreCompanionState, renameLocally, activeName,
  addStarsForChallenge, unlockAccessory, equipAccessory,
} from '../apps/pwa/companion-state.js';

const catalog = JSON.parse(readFileSync('apps/pwa/companion-catalog.json', 'utf8'));
const option = (id: string) => catalog.characters.find((c: { id: string }) => c.id === id);

test('offline catalog is identical to the approved selection (no Claude assets)', () => {
  assert.deepEqual(catalog.characters.map((c: { id: string }) => c.id),
    APPROVED_CHARACTER_SELECTION.map((c) => c.id));
  assert.deepEqual(catalog.characters.map((c: { origin: string }) => c.origin),
    APPROVED_CHARACTER_SELECTION.map((c) => c.origin));
  assert.deepEqual(catalog.characters.map((c: { position: number }) => c.position), [1, 2, 3]);
  assert.equal(catalog.characters[2].role, 'evolution-archive');
  assert.equal(catalog.characters[2].kind, 'robot');
  assert.ok(!JSON.stringify(catalog).toLowerCase().includes('claude'));
  assert.ok(catalog.characters.every((c: { assets: { previewImage: unknown; model3d: unknown } }) =>
    c.assets.previewImage === null && c.assets.model3d === null), 'no unsupported 3D claim');
});

test('legacy/third-party selection is rejected during local profile restoration', () => {
  const state = restoreCompanionState({
    selectedId: 'lumi',
    ownerName: '<Kendra>',
    nicknames: { 'approved-creature-01': '<b>Mía</b>', 'not-approved': 'intruder' },
    stars: -10_000,
    unlocked: ['unapproved-item'],
    equipped: { vehicles: 'unapproved-item' },
    stageOffset: Infinity,
  }, catalog);
  assert.equal(state.selectedId, 'approved-creature-01');
  assert.equal(state.ownerName, 'Kendra');
  assert.equal(state.stars, 0);
  assert.ok(state.unlocked.includes('star-hat'));
  assert.ok(!state.unlocked.includes('unapproved-item'));
  assert.equal(Object.keys(state.equipped).length, 0);
  assert.equal(state.stageOffset, 0);
  assert.equal(activeName(state, option('approved-creature-01')), 'bMíab');
});

test('profiles preserve distinct personal names and do not call the child hija', () => {
  const original = initialCompanionState(catalog);
  const renamed = renameLocally(original, 'janus-original-robot', ' Kendra ', ' Mi Robot ', 'Robot original');
  assert.equal(renamed.ownerName, 'Kendra');
  assert.equal(activeName(renamed, option('janus-original-robot')), 'Mi Robot');
  assert.equal(activeName(renamed, option('approved-creature-01')), 'Criatura 1');
  assert.equal(original.nicknames['janus-original-robot'], undefined);
});

test('earned stars are idempotent per challenge and capped per local day', () => {
  const day = new Date(2026, 10, 5, 11);
  let state = initialCompanionState(catalog);
  const first = addStarsForChallenge(state, 'problem-1', day);
  assert.equal(first.earned, 3); state = first.state;
  const same = addStarsForChallenge(state, 'problem-1', day);
  assert.equal(same.earned, 0); assert.equal(same.state.stars, 3);
  for (let i = 2; i <= 5; i++) state = addStarsForChallenge(state, 'problem-' + i, day).state;
  assert.equal(state.stars, 15);
  assert.equal(addStarsForChallenge(state, 'problem-6', day).earned, 0);
  assert.equal(addStarsForChallenge(state, 'problem-6', new Date(2026, 10, 6, 11)).earned, 3);
});

test('wardrobe: cannot spend unearned stars, equip locked items, or invent products', () => {
  let state = initialCompanionState(catalog);
  const jacket = catalog.accessories.find((a: { id: string }) => a.id === 'soft-jacket');
  const unearned = unlockAccessory(state, jacket, catalog);
  assert.equal(unearned.ok, false);
  assert.equal(unearned.missing, 10);
  assert.equal(equipAccessory(state, jacket, catalog), state);
  assert.equal(unlockAccessory(state, { id: 'fake', cost: 0 }, catalog).ok, false);
  state = { ...state, stars: 12 };
  const unlocked = unlockAccessory(state, jacket, catalog);
  assert.equal(unlocked.ok, true); state = unlocked.state;
  assert.equal(state.stars, 2);
  state = equipAccessory(state, jacket, catalog);
  assert.equal(state.equipped.chaquetas, 'soft-jacket');
  assert.equal(unlockAccessory(state, jacket, catalog).state.stars, 2, 'no double charge');
});

test('companion dashboard is linked, scripts are parseable, and shell is offline-ready', () => {
  const html = readFileSync('apps/pwa/companion.html', 'utf8');
  const index = readFileSync('apps/pwa/index.html', 'utf8');
  const script = readFileSync('apps/pwa/companion.js', 'utf8');
  const styles = readFileSync('apps/pwa/companion.css', 'utf8');
  const sw = readFileSync('apps/pwa/sw.js', 'utf8');
  assert.match(index, /href="\/companion\.html"/);
  assert.match(html, /id="characterOptions"/);
  assert.match(html, /id="characterStage"/);
  assert.match(html, /id="accessories"/);
  assert.match(html, /id="challengeForm"/);
  assert.match(script, /\/companion-catalog\.json/);
  assert.match(script, /model-viewer/);
  assert.match(styles, /@media\(max-width:720px\)/);
  for (const path of ['companion.html','companion.css','companion.js','companion-state.js','companion-catalog.json']) {
    assert.ok(sw.includes("'/" + path + "'"), 'offline shell missing ' + path);
  }
  for (const path of ['apps/pwa/companion.js','apps/pwa/companion-state.js']) {
    execFileSync(process.execPath, ['--check', path]);
  }
});
