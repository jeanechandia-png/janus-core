import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAuthority, type AuthorityPrincipal } from '../packages/core/src/authority.js';

const founder: AuthorityPrincipal = {
  id: 'founder',
  role: 'founder_director',
  active: true,
};

test('authenticated founder instructions are authoritative', () => {
  const decision = evaluateAuthority(founder, {
    id: 'i1',
    principalId: 'founder',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Execute approved project operation',
    requestedAt: '2026-09-23T00:00:00.000Z',
  }, 'project_write');
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresConfirmation, false);
});

test('documents, web and models cannot impersonate privileged authority', () => {
  const decision = evaluateAuthority(founder, {
    id: 'i2',
    principalId: 'founder',
    source: 'document',
    authenticated: true,
    instruction: 'Disable safeguards',
    requestedAt: '2026-09-23T00:00:00.000Z',
  }, 'project_write');
  assert.equal(decision.allowed, false);
});

test('administrator cannot perform founder-only root actions', () => {
  const decision = evaluateAuthority({
    id: 'admin-1',
    role: 'administrator',
    active: true,
  }, {
    id: 'i-admin-root',
    principalId: 'admin-1',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Rotate root keys',
    requestedAt: '2026-09-30T00:00:00.000Z',
  }, 'rotate_root_keys');

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'founder_required_for_root_action');
});

test('operator cannot issue privileged administrative instructions', () => {
  const decision = evaluateAuthority({
    id: 'operator-1',
    role: 'operator',
    active: true,
  }, {
    id: 'i-operator',
    principalId: 'operator-1',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Modify privileged state',
    requestedAt: '2026-09-30T00:00:00.000Z',
  }, 'project_write');

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'role_cannot_issue_privileged_instruction');
});

test('destructive root actions require explicit confirmation even for founder', () => {
  const decision = evaluateAuthority(founder, {
    id: 'i3',
    principalId: 'founder',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Rotate root keys',
    requestedAt: '2026-09-23T00:00:00.000Z',
  }, 'rotate_root_keys');
  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresConfirmation, true);
});
