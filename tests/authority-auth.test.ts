import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import type { AuthorityPublicCredential } from '../packages/core/src/authority.js';
import {
  AuthorityAuthenticationError,
  LocalAuthorityAuthService,
  type AuthorityCredentialStore,
} from '../packages/security/src/authority-auth.js';

class MemoryCredentialStore implements AuthorityCredentialStore {
  readonly records = new Map<string, AuthorityPublicCredential>();

  get(principalId: string) {
    return this.records.get(principalId) ?? null;
  }

  list(activeOnly = false) {
    const values = [...this.records.values()];
    return activeOnly
      ? values.filter((credential) => credential.principal.active && !credential.revokedAt)
      : values;
  }

  upsert(credential: AuthorityPublicCredential) {
    this.records.set(credential.principal.id, structuredClone(credential));
  }

  revoke(principalId: string, revokedAt: string) {
    const current = this.records.get(principalId);
    if (!current || !current.principal.active) return false;
    this.records.set(principalId, {
      ...current,
      principal: { ...current.principal, active: false },
      revokedAt,
    });
    return true;
  }
}

function p256KeyPair() {
  return generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function signature(payload: string, privateKey: string) {
  return sign('sha256', Buffer.from(payload, 'utf8'), privateKey).toString('base64url');
}

test('P-256 challenge authenticates founder once and creates ephemeral session', () => {
  const store = new MemoryCredentialStore();
  const keys = p256KeyPair();
  const auth = new LocalAuthorityAuthService(store);

  auth.ensureFounderCredential(keys.publicKey);
  const challenge = auth.issueChallenge('founder');
  const session = auth.verifyChallenge({
    challengeId: challenge.id,
    principalId: 'founder',
    signature: signature(challenge.signingPayload, keys.privateKey),
  });

  assert.equal(session.principal.role, 'founder_director');
  assert.equal(auth.authenticateSession(session.token)?.id, 'founder');
  assert.equal(store.records.get('founder')?.publicKeyPem.includes('PRIVATE KEY'), false);

  assert.throws(
    () => auth.verifyChallenge({
      challengeId: challenge.id,
      principalId: 'founder',
      signature: signature(challenge.signingPayload, keys.privateKey),
    }),
    (error: unknown) => (
      error instanceof AuthorityAuthenticationError
      && error.code === 'invalid_challenge'
    ),
  );
});

test('challenge rejects a signature from a different private key', () => {
  const store = new MemoryCredentialStore();
  const founder = p256KeyPair();
  const attacker = p256KeyPair();
  const auth = new LocalAuthorityAuthService(store);
  auth.ensureFounderCredential(founder.publicKey);

  const challenge = auth.issueChallenge('founder');
  assert.throws(
    () => auth.verifyChallenge({
      challengeId: challenge.id,
      principalId: 'founder',
      signature: signature(challenge.signingPayload, attacker.privateKey),
    }),
    (error: unknown) => (
      error instanceof AuthorityAuthenticationError
      && error.code === 'invalid_signature'
    ),
  );
});

test('founder can delegate administrator and revocation invalidates admin sessions', () => {
  const store = new MemoryCredentialStore();
  const founder = p256KeyPair();
  const admin = p256KeyPair();
  const auth = new LocalAuthorityAuthService(store);
  auth.ensureFounderCredential(founder.publicKey, 'Founder');

  const founderChallenge = auth.issueChallenge('founder');
  const founderSession = auth.verifyChallenge({
    challengeId: founderChallenge.id,
    principalId: 'founder',
    signature: signature(founderChallenge.signingPayload, founder.privateKey),
  });

  const delegated = auth.delegateAdministrator(founderSession.token, {
    principalId: 'admin-1',
    displayName: 'Administrator',
    publicKeyPem: admin.publicKey,
  });
  assert.equal(delegated.principal.role, 'administrator');
  assert.equal(delegated.delegatedBy, 'founder');

  const adminChallenge = auth.issueChallenge('admin-1');
  const adminSession = auth.verifyChallenge({
    challengeId: adminChallenge.id,
    principalId: 'admin-1',
    signature: signature(adminChallenge.signingPayload, admin.privateKey),
  });
  assert.equal(auth.authenticateSession(adminSession.token)?.role, 'administrator');

  assert.throws(
    () => auth.delegateAdministrator(adminSession.token, {
      principalId: 'admin-2',
      publicKeyPem: p256KeyPair().publicKey,
    }),
    (error: unknown) => (
      error instanceof AuthorityAuthenticationError
      && error.code === 'founder_required'
    ),
  );

  const revoked = auth.revokeAdministrator(founderSession.token, 'admin-1');
  assert.equal(revoked.principal.active, false);
  assert.ok(revoked.revokedAt);
  assert.equal(auth.authenticateSession(adminSession.token), undefined);
});


test('founder can delegate a least-privilege operator and revocation invalidates operator sessions', () => {
  const store = new MemoryCredentialStore();
  const founder = p256KeyPair();
  const operator = p256KeyPair();
  const auth = new LocalAuthorityAuthService(store);
  auth.ensureFounderCredential(founder.publicKey, 'Founder');

  const founderChallenge = auth.issueChallenge('founder');
  const founderSession = auth.verifyChallenge({
    challengeId: founderChallenge.id,
    principalId: 'founder',
    signature: signature(founderChallenge.signingPayload, founder.privateKey),
  });

  const delegated = auth.delegateOperator(founderSession.token, {
    principalId: 'operator-1',
    displayName: 'Operator One',
    publicKeyPem: operator.publicKey,
  });
  assert.equal(delegated.principal.role, 'operator');
  assert.equal(delegated.delegatedBy, 'founder');
  assert.equal(auth.status().activeOperators, 1);

  const operatorChallenge = auth.issueChallenge('operator-1');
  const operatorSession = auth.verifyChallenge({
    challengeId: operatorChallenge.id,
    principalId: 'operator-1',
    signature: signature(operatorChallenge.signingPayload, operator.privateKey),
  });
  assert.equal(auth.authenticateSession(operatorSession.token)?.role, 'operator');

  assert.throws(
    () => auth.delegateOperator(operatorSession.token, {
      principalId: 'operator-2',
      publicKeyPem: p256KeyPair().publicKey,
    }),
    (error: unknown) => (
      error instanceof AuthorityAuthenticationError
      && error.code === 'founder_required'
    ),
  );

  const revoked = auth.revokeOperator(founderSession.token, 'operator-1');
  assert.equal(revoked.principal.active, false);
  assert.ok(revoked.revokedAt);
  assert.equal(auth.authenticateSession(operatorSession.token), undefined);
  assert.equal(auth.status().activeOperators, 0);
});
