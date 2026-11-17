import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_JANUS_REPOSITORY,
  evaluateContinuityGate,
  repositoryFromGitRemote,
  type ContinuityGateInput,
} from '../packages/core/src/continuity-guard.js';

const valid: ContinuityGateInput = {
  originUrl: 'git@github.com:jeanechandia-png/janus-core.git',
  branch: 'chatgpt/unified-continuity',
  headSha: 'local-sha',
  baseRef: 'origin/main',
  baseSha: 'remote-sha',
  baseAncestor: true,
  fetchVerified: true,
  requiredFilesPresent: true,
};

test('recognizes only canonical Github remotes (no lookalike host, other repo or token-bearing URL)', () => {
  assert.equal(repositoryFromGitRemote('https://github.com/jeanechandia-png/janus-core.git'), CANONICAL_JANUS_REPOSITORY);
  assert.equal(repositoryFromGitRemote('ssh://git@github.com/jeanechandia-png/janus-core'), CANONICAL_JANUS_REPOSITORY);
  assert.equal(repositoryFromGitRemote('git@github.com:jeanechandia-png/janus-core.git'), CANONICAL_JANUS_REPOSITORY);
  assert.equal(repositoryFromGitRemote('https://github.com.evil.com/jeanechandia-png/janus-core'), undefined);
  assert.equal(repositoryFromGitRemote('https://github.com/jeanechandia-png/janus-core-copy'), 'jeanechandia-png/janus-core-copy');
  assert.equal(repositoryFromGitRemote('https://token@github.com/jeanechandia-png/janus-core'), undefined);
});

test('permits a synchronized, non-main working branch without claiming deployment', () => {
  assert.deepEqual(evaluateContinuityGate(valid), {
    state: 'ready', reasons: [], repository: CANONICAL_JANUS_REPOSITORY,
  });
});

test('prevents stale main and stale stacked-base edits', () => {
  const result = evaluateContinuityGate({ ...valid, baseRef: 'origin/stacked-pr', baseAncestor: false });
  assert.equal(result.state, 'blocked');
  assert.match(result.reasons.join(' '), /último commit/);
});

test('no accidental fork, detached HEAD, direct-main edit, or missing project files', () => {
  for (const bad of [
    { originUrl: 'https://github.com/someone/janus-core' },
    { branch: 'HEAD' },
    { branch: 'main' },
    { headSha: undefined },
    { requiredFilesPresent: false },
  ]) {
    assert.equal(evaluateContinuityGate({ ...valid, ...bad }).state, 'blocked');
  }
});

test('unavailable remote is blocked unless offline is explicit, and even then it is LOCAL ONLY', () => {
  const missingRemote = { ...valid, fetchVerified: false, baseSha: undefined };
  assert.equal(evaluateContinuityGate(missingRemote).state, 'blocked');
  const offline = evaluateContinuityGate({ ...missingRemote, offlineAllowed: true });
  assert.equal(offline.state, 'local-only');
  assert.match(offline.reasons.join(' '), /publicar, fusionar y desplegar están bloqueados/);
});

test('a vanished remote base cannot be considered synchronized', () => {
  const result = evaluateContinuityGate({ ...valid, baseSha: undefined });
  assert.equal(result.state, 'blocked');
});
