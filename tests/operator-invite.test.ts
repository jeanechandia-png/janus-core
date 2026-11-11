import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  OperatorInviteError,
  assertInviteUsable,
  createOperatorInvite,
  hashInviteCode,
  isInviteCodeShape,
  publicOperatorInvite,
} from '../packages/core/src/operator-invite.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import {
  AuthorityAuthenticationError,
  LocalAuthorityAuthService,
  type AuthorityCredentialStore,
} from '../packages/security/src/authority-auth.js';

type AuthorityPublicCredential = NonNullable<ReturnType<AuthorityCredentialStore['get']>>;
const now = new Date('2026-11-10T12:00:00.000Z');
const pem = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } }).publicKey;

test('la invitación guarda solo la huella del código y normaliza los datos', () => {
  const { invite, code } = createOperatorInvite({ principalId: ' Ana ', displayName: '  Ana   Ruiz ', locale: 'tr', createdBy: 'founder', now });
  assert.ok(isInviteCodeShape(code));
  assert.equal(invite.codeHash, hashInviteCode(code));
  assert.ok(!JSON.stringify(invite).includes(code), 'el código no se guarda');
  assert.equal(invite.principalId, 'ana');
  assert.equal(invite.displayName, 'Ana Ruiz');
  assert.equal(invite.locale, 'es', 'idioma no admitido → español');
  assert.equal(invite.status, 'pending');
  assert.equal(Date.parse(invite.expiresAt) - now.getTime(), 72 * 3_600_000);
  assert.equal('codeHash' in publicOperatorInvite(invite, now), false);
});

test('rechaza identificadores inválidos o reservados y limita la vigencia', () => {
  for (const principalId of ['', 'a', 'con espacio', '../x', 'ñandú']) {
    assert.throws(() => createOperatorInvite({ principalId, displayName: 'X', createdBy: 'founder', now }), OperatorInviteError);
  }
  assert.throws(() => createOperatorInvite({ principalId: 'founder', displayName: 'X', createdBy: 'founder', now, reservedPrincipalIds: ['founder'] }), OperatorInviteError);
  assert.throws(() => createOperatorInvite({ principalId: 'bram', displayName: '', createdBy: 'founder', now }), OperatorInviteError);
  const long = createOperatorInvite({ principalId: 'bram', displayName: 'Bram', locale: 'nl', createdBy: 'founder', now, ttlMs: 365 * 86_400_000 }).invite;
  assert.equal(Date.parse(long.expiresAt) - now.getTime(), 7 * 86_400_000, 'máximo 7 días');
  assert.equal(long.locale, 'nl');
});

test('una invitación usada, anulada, caducada o inexistente no se puede canjear', () => {
  const { invite } = createOperatorInvite({ principalId: 'bram', displayName: 'Bram', createdBy: 'founder', now });
  assert.doesNotThrow(() => assertInviteUsable(invite, now));
  const code = (fn: () => void) => { try { fn(); } catch (error) { return (error as OperatorInviteError).code; } return 'ok'; };
  assert.equal(code(() => assertInviteUsable(null, now)), 'invalid_code');
  assert.equal(code(() => assertInviteUsable({ ...invite, status: 'redeemed' }, now)), 'already_used');
  assert.equal(code(() => assertInviteUsable({ ...invite, status: 'revoked' }, now)), 'revoked');
  assert.equal(code(() => assertInviteUsable(invite, new Date(invite.expiresAt))), 'expired');
  assert.equal(publicOperatorInvite(invite, new Date(invite.expiresAt)).expired, true);
});

test('SQLite: el canje es atómico (solo gana uno) y una invitación nueva anula la anterior', () => {
  const store = new SqliteStore(':memory:');
  const first = createOperatorInvite({ principalId: 'ana', displayName: 'Ana', createdBy: 'founder', now });
  store.insertOperatorInvite(first.invite);
  assert.equal(store.getOperatorInviteByHash(hashInviteCode(first.code))?.id, first.invite.id);
  assert.equal(store.getOperatorInviteByHash(hashInviteCode('x'.repeat(43))), null);
  const redeemed = { ...first.invite, status: 'redeemed' as const, redeemedAt: now.toISOString() };
  assert.equal(store.transitionOperatorInvite(redeemed, 'pending', now.toISOString()), true);
  assert.equal(store.transitionOperatorInvite(redeemed, 'pending', now.toISOString()), false, 'segundo canje rechazado');
  assert.equal(store.getOperatorInvite(first.invite.id)?.status, 'redeemed');

  const expired = createOperatorInvite({ principalId: 'bram', displayName: 'Bram', createdBy: 'founder', now, ttlMs: 5 * 60_000 });
  store.insertOperatorInvite(expired.invite);
  const later = new Date(now.getTime() + 6 * 60_000).toISOString();
  assert.equal(store.transitionOperatorInvite({ ...expired.invite, status: 'redeemed', redeemedAt: later }, 'pending', later), false, 'caducada: no se canjea aunque el reloj del proceso falle');

  const second = createOperatorInvite({ principalId: 'bram', displayName: 'Bram', createdBy: 'founder', now });
  assert.equal(store.revokePendingOperatorInvites('bram', now.toISOString()), 1);
  store.insertOperatorInvite(second.invite);
  assert.equal(store.getOperatorInvite(expired.invite.id)?.status, 'revoked');
  assert.equal(store.listOperatorInvites().filter((x) => x.principalId === 'bram' && x.status === 'pending').length, 1);
  store.close?.();
});

test('seguridad: la invitación solo crea colaboradores y nunca toca al Founder ni a un administrador', () => {
  const map = new Map<string, AuthorityPublicCredential>();
  const credentialStore: AuthorityCredentialStore = {
    get: (id) => map.get(id) ?? null,
    list: () => [...map.values()],
    upsert: (credential) => { map.set(credential.principal.id, credential); },
    revoke: (id) => map.delete(id),
  };
  const auth = new LocalAuthorityAuthService(credentialStore);
  auth.ensureFounderCredential(pem(), 'CEO');
  const created = auth.enrollOperatorFromInvitation({ principalId: 'ana', publicKeyPem: pem(), displayName: 'Ana', authorizedBy: 'founder' });
  assert.equal(created.principal.role, 'operator');
  assert.equal(created.delegatedBy, 'founder');
  const expectCode = (fn: () => void, expected: string) => assert.throws(fn, (error) => error instanceof AuthorityAuthenticationError && error.code === expected);
  expectCode(() => auth.enrollOperatorFromInvitation({ principalId: 'founder', publicKeyPem: pem(), authorizedBy: 'founder' }), 'invalid_principal');
  expectCode(() => auth.enrollOperatorFromInvitation({ principalId: 'bram', publicKeyPem: pem(), authorizedBy: 'ana' }), 'founder_required');
  expectCode(() => auth.enrollOperatorFromInvitation({ principalId: 'bram', publicKeyPem: 'no es una llave', authorizedBy: 'founder' }), 'invalid_public_key');
  map.set('admin-1', { ...created, principal: { id: 'admin-1', role: 'administrator', active: true } });
  expectCode(() => auth.enrollOperatorFromInvitation({ principalId: 'admin-1', publicKeyPem: pem(), authorizedBy: 'founder' }), 'invalid_principal');
  assert.equal(map.get('founder')?.principal.role, 'founder_director');
});
