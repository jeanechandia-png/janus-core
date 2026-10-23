import assert from 'node:assert/strict';
import test from 'node:test';
import { findAdrCollisions, latestHandoff, nextFreeAdrNumber, stackOutline } from '../packages/core/src/continuity-scan.js';

test('detects two agents creating the same ADR number with different files', () => {
  const entries = [
    { ref: 'origin/main', path: 'docs/ADR-008-identity-presence.md' },
    { ref: 'origin/a', path: 'docs/ADR-009-likeness-consent-voice-clone.md' },
    { ref: 'origin/b', path: 'docs/ADR-009-speaker-recognition.md' },
    { ref: 'origin/c', path: 'docs/ADR-009-speaker-recognition.md' },
    { ref: 'origin/a', path: 'docs/README.md' },
  ];
  const collisions = findAdrCollisions(entries);
  assert.equal(collisions.length, 1);
  assert.equal(collisions[0]!.number, '009');
  assert.deepEqual(collisions[0]!.files.find((f) => f.path.endsWith('speaker-recognition.md'))!.refs, ['origin/b', 'origin/c']);
  assert.equal(nextFreeAdrNumber(entries), '010');
  assert.deepEqual(findAdrCollisions([{ ref: 'x', path: 'docs/ADR-001-a.md' }, { ref: 'y', path: 'docs/ADR-001-a.md' }]), []);
});

test('draws stacked PRs under the PR they depend on', () => {
  const lines = stackOutline([
    { number: 38, head: 'seneca', base: 'exec', title: 'Séneca' },
    { number: 37, head: 'exec', base: 'main', title: 'Exec' },
    { number: 36, head: 'dash', base: 'main', title: 'Dash', draft: true },
  ]);
  assert.match(lines[0]!, /^#36 dash → main \(borrador\)/);
  assert.match(lines[1]!, /^#37 exec → main/);
  assert.match(lines[2]!, /^ {2}#38 seneca → exec/);
});

test('the current handoff is the newest by date, even when an older one sits later in the file', () => {
  const md = [
    '# Estado',
    '## Handoff 2026-10-21 (Claude): nuevo',
    '- HECHO: nuevo',
    '## Handoff 2026-10-18 (Claude): viejo',
    '- HECHO: viejo',
    '## PRÓXIMO',
    'texto',
  ].join('\n');
  const handoff = latestHandoff(md);
  assert.ok(handoff);
  assert.match(handoff.heading, /2026-10-21/);
  assert.deepEqual(handoff.body, ['- HECHO: nuevo']);
  assert.equal(latestHandoff('# sin handoffs'), undefined);
});
