import assert from 'node:assert/strict';
import test from 'node:test';
import { VoiceAuthority } from '../packages/security/src/voice-authority.js';
import type { AuthorityPrincipal } from '../packages/core/src/authority.js';

const founder: AuthorityPrincipal = { id: 'founder', role: 'founder_director', active: true };

test('voice tickets bind one authenticated session and are single-use, short-lived and session-specific', () => {
  let now = 0;
  const sessions = new Map([['one', founder], ['two', founder]]);
  const authority = new VoiceAuthority((token) => sessions.get(token), () => now);
  assert.throws(() => authority.ticket('phone', 'missing'));
  const ticket = authority.ticket('phone', 'one');
  assert.throws(() => authority.consume(ticket, 'other'));
  assert.throws(() => authority.consume(ticket, 'phone'));
  const lease = authority.consume(authority.ticket('phone', 'one'), 'phone');
  lease();
  assert.throws(() => authority.bind('phone', 'two'));
  const expired = authority.ticket('phone', 'one'); now = 30_000;
  assert.throws(() => authority.consume(expired, 'phone'));
  sessions.delete('one');
  assert.throws(lease);
  authority.bind('phone', 'two');
  assert.throws(lease, 'an old audio stream cannot inherit a new login');
});

test('operator and child tokens never become Founder voice authority', () => {
  const authority = new VoiceAuthority((token) => token === 'operator'
    ? { id: 'helper', role: 'operator', active: true } : undefined);
  assert.throws(() => authority.bind('phone', 'operator'));
  assert.throws(() => authority.bind('phone', 'kdv_child'));
  assert.throws(() => authority.bind('../phone', 'operator'));
});
