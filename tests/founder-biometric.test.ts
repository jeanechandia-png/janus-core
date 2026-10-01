import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  evaluateAuthority,
  type AuthorityPrincipal,
} from '../packages/core/src/authority.js';
import { EventHub } from '../packages/core/src/event-hub.js';
import { TaskRunner } from '../packages/core/src/task-runner.js';
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


test('TaskRunner treats a biometric read scope as privileged and fails closed without proof', async () => {
  const hub = new EventHub();
  const runner = new TaskRunner('Read founder private secret', {
    sink: hub.sink,
    authorityContext: {
      principal: founder,
      instruction: {
        id: 'runner-face-no-proof',
        principalId: 'founder',
        source: 'authenticated_human',
        authenticated: true,
        instruction: 'Read founder private secret',
        requestedAt: '2026-10-01T00:00:00.000Z',
      },
    },
    now: () => new Date('2026-10-01T00:00:00.000Z'),
  });

  const snapshot = await runner.execute([{
    id: 'secret-read',
    label: 'Read founder private secret',
    run: async ({ assertCanExecute }) => {
      await assertCanExecute({
        id: 'secret-read',
        label: 'Read founder private secret',
        tool: 'vault',
        operation: 'security.secrets.read',
        risk: 'low',
        reversible: true,
        requiresApproval: false,
      });
    },
  }]);

  assert.equal(snapshot.status, 'blocked');
  const authority = hub.replay(snapshot.runId)
    .find((event) => event.type === 'authority.evaluated');
  assert.equal(authority?.payload.requiresBiometric, true);
  assert.equal(authority?.payload.reason, 'founder_biometric_required');
});

test('TaskRunner consumes one valid face proof for the matching sensitive action', async () => {
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

  const hub = new EventHub();
  const runner = new TaskRunner('Read founder private secret', {
    sink: hub.sink,
    authorityContext: {
      principal: founder,
      instruction: {
        id: 'runner-face-proof',
        principalId: 'founder',
        source: 'authenticated_human',
        authenticated: true,
        instruction: 'Read founder private secret',
        requestedAt: now.toISOString(),
      },
      biometricProofIds: [ticket.proofId],
    },
    biometricVerifier: ({ proofId, principal, action, requestedAt }) => (
      biometrics.consumeProof({
        proofId,
        principalId: principal.id,
        action,
        requestedAt,
      })
    ),
    now: () => now,
  });

  const snapshot = await runner.execute([{
    id: 'secret-read',
    label: 'Read founder private secret',
    run: async ({ assertCanExecute }) => {
      await assertCanExecute({
        id: 'secret-read',
        label: 'Read founder private secret',
        tool: 'vault',
        operation: 'security.secrets.read',
        risk: 'low',
        reversible: true,
        requiresApproval: false,
      });
    },
  }]);

  assert.equal(snapshot.status, 'completed');
  const authority = hub.replay(snapshot.runId)
    .find((event) => event.type === 'authority.evaluated');
  assert.equal(authority?.payload.allowed, true);
  assert.equal(authority?.payload.requiresBiometric, true);
});


test('new Founder face key enrollment requires proof of possession and is single-use', () => {
  const keys = p256KeyPair();
  const attacker = p256KeyPair();
  const biometrics = new FounderBiometricService(new InMemoryBiometricKeyStore());

  const challenge = biometrics.issueEnrollmentChallenge({
    keyId: 'iphone-face-key-v1',
    publicKeyPem: keys.publicKey,
  });

  assert.throws(
    () => biometrics.verifyEnrollmentAndRegisterFaceKey({
      challengeId: challenge.id,
      keyId: 'iphone-face-key-v1',
      publicKeyPem: keys.publicKey,
      signature: signature(challenge.signingPayload, attacker.privateKey),
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'invalid_signature'
    ),
  );

  assert.throws(
    () => biometrics.verifyEnrollmentAndRegisterFaceKey({
      challengeId: challenge.id,
      keyId: 'iphone-face-key-v1',
      publicKeyPem: keys.publicKey,
      signature: signature(challenge.signingPayload, keys.privateKey),
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'invalid_challenge'
    ),
  );

  const retry = biometrics.issueEnrollmentChallenge({
    keyId: 'iphone-face-key-v1',
    publicKeyPem: keys.publicKey,
  });
  const registration = biometrics.verifyEnrollmentAndRegisterFaceKey({
    challengeId: retry.id,
    keyId: 'iphone-face-key-v1',
    publicKeyPem: keys.publicKey,
    signature: signature(retry.signingPayload, keys.privateKey),
  });

  assert.equal(registration.keyId, 'iphone-face-key-v1');
  assert.equal(registration.biometry, 'face');
  assert.equal(registration.binding, 'biometry-current-set');
  assert.equal(biometrics.status().activeFaceKeys, 1);
});

test('Founder biometric key IDs are append-only across revocation and rotation', () => {
  const firstKeys = p256KeyPair();
  const secondKeys = p256KeyPair();
  const biometrics = new FounderBiometricService(new InMemoryBiometricKeyStore());

  biometrics.registerFaceKey({
    keyId: 'iphone-face-key-v1',
    publicKeyPem: firstKeys.publicKey,
  });
  assert.equal(biometrics.revokeKey('iphone-face-key-v1'), true);

  assert.throws(
    () => biometrics.registerFaceKey({
      keyId: 'iphone-face-key-v1',
      publicKeyPem: secondKeys.publicKey,
    }),
    (error: unknown) => (
      error instanceof FounderBiometricError
      && error.code === 'invalid_key'
    ),
  );

  const registration = biometrics.registerFaceKey({
    keyId: 'iphone-face-key-v2',
    publicKeyPem: secondKeys.publicKey,
  });
  assert.equal(registration.keyId, 'iphone-face-key-v2');
  assert.equal(biometrics.status().activeFaceKeys, 1);
});
