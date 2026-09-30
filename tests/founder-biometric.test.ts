import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  evaluateAuthority,
  type AuthorityPrincipal,
} from '../packages/core/src/authority.js';
import {
  FounderBiometricError,
  FounderBiometricService,
  InMemoryBiometricKeyStore,
} from '../packages/security/src/founder-biometric.js';

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

const founder: AuthorityPrincipal = {
  id: 'founder',
  role: 'founder_director',
  active: true,
};

test('face-gated proof authorizes a founder-only sensitive action once', () => {
  const keys = p256KeyPair();
  let now = new Date('2026-10-01T00:00:00.000Z');
  const biometrics = new FounderBiometricService(
    new InMemoryBiometricKeyStore(),
    { now: () => now },
  );

  biometrics.registerFaceKey({
    keyId: 'iphone-face-key',
    publicKeyPem: keys.publicKey,
  });

  const challenge = biometrics.issueChallenge('security.secrets.read');
  const ticket = biometrics.verifyAssertion({
    challengeId: challenge.id,
    keyId: 'iphone-face-key',
    signature: signature(challenge.signingPayload, keys.privateKey),
  });

  now = new Date('2026-10-01T00:00:05.000Z');
  const attestation = biometrics.consumeProof({
    proofId: ticket.proofId,
    principalId: 'founder',
    action: 'security.secrets.read',
    requestedAt: now.toISOString(),
  });
  assert.ok(attestation);

  const decision = evaluateAuthority(founder, {
    id: 'instruction-face-1',
    principalId: 'founder',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Read founder secret',
    requestedAt: now.toISOString(),
    biometricAttestation: attestation,
  }, 'security.secrets.read');

  assert.equal(decision.allowed, true);
  assert.equal(decision.requiresBiometric, true);

  assert.equal(biometrics.consumeProof({
    proofId: ticket.proofId,
    principalId: 'founder',
    action: 'security.secrets.read',
    requestedAt: now.toISOString(),
  }), undefined);
});

test('sensitive founder action fails closed without a face attestation', () => {
  const decision = evaluateAuthority(founder, {
    id: 'instruction-face-2',
    principalId: 'founder',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Read founder secret',
    requestedAt: '2026-10-01T00:00:00.000Z',
  }, 'security.secrets.read');

  assert.equal(decision.allowed, false);
  assert.equal(decision.requiresBiometric, true);
  assert.equal(decision.reason, 'founder_biometric_required');
});

test('administrator cannot substitute for founder on biometric scope', () => {
  const decision = evaluateAuthority({
    id: 'julio',
    role: 'administrator',
    active: true,
  }, {
    id: 'instruction-admin-face',
    principalId: 'julio',
    source: 'authenticated_human',
    authenticated: true,
    instruction: 'Read founder secret',
    requestedAt: '2026-10-01T00:00:00.000Z',
  }, 'security.secrets.read');

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'founder_required_for_action');
});

test('face service rejects a non-face biometric key under founder policy', () => {
  const keys = p256KeyPair();
  const biometrics = new FounderBiometricService(new InMemoryBiometricKeyStore());

  assert.throws(
    () => biometrics.registerFaceKey({
      keyId: 'fingerprint-key',
      publicKeyPem: keys.publicKey,
      biometry: 'fingerprint',
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'face_required'
    ),
  );
});

test('challenge cannot be replayed and wrong signer is rejected', () => {
  const founderKeys = p256KeyPair();
  const attackerKeys = p256KeyPair();
  const biometrics = new FounderBiometricService(new InMemoryBiometricKeyStore());
  biometrics.registerFaceKey({
    keyId: 'iphone-face-key',
    publicKeyPem: founderKeys.publicKey,
  });

  const challenge = biometrics.issueChallenge('founder.private.export');
  assert.throws(
    () => biometrics.verifyAssertion({
      challengeId: challenge.id,
      keyId: 'iphone-face-key',
      signature: signature(challenge.signingPayload, attackerKeys.privateKey),
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'invalid_signature'
    ),
  );

  assert.throws(
    () => biometrics.verifyAssertion({
      challengeId: challenge.id,
      keyId: 'iphone-face-key',
      signature: signature(challenge.signingPayload, founderKeys.privateKey),
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'invalid_challenge'
    ),
  );
});
