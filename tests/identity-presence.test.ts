import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPresenceChallenge,
  isPresenceSessionValid,
  validateBiometricTemplateRef,
  verifyPresence,
} from '../packages/core/src/identity-presence.js';

test('biometric template must live in secure storage', () => {
  assert.doesNotThrow(() => validateBiometricTemplateRef({
    principalId: 'founder',
    modality: 'face',
    secureStoreRef: 'secure-enclave:janus/founder/face-v1',
    modelId: 'local-face-embedding',
    modelVersion: '1',
    enrolledAt: '2026-09-23T00:00:00.000Z',
  }));
  assert.throws(() => validateBiometricTemplateRef({
    principalId: 'founder',
    modality: 'face',
    secureStoreRef: 'sqlite:face-template',
    modelId: 'local-face-embedding',
    modelVersion: '1',
    enrolledAt: '2026-09-23T00:00:00.000Z',
  }), /secure storage/);
});

test('face plus liveness plus trusted device creates strong presence', () => {
  const session = verifyPresence({
    sessionId: 's1',
    principalId: 'founder',
    now: '2026-09-23T12:00:00.000Z',
    evidence: [
      { factor: 'trusted_device', verified: true, observedAt: '2026-09-23T11:59:58.000Z', deviceId: 'iphone-local' },
      { factor: 'face_match', verified: true, score: 0.92, observedAt: '2026-09-23T11:59:59.000Z' },
      { factor: 'liveness', verified: true, score: 0.94, observedAt: '2026-09-23T11:59:59.000Z' },
    ],
  });
  assert.equal(session.assurance, 'strong');
  assert.equal(isPresenceSessionValid(session, '2026-09-23T12:10:00.000Z'), true);
});

test('root assurance requires additional factor', () => {
  assert.throws(() => verifyPresence({
    sessionId: 's2',
    principalId: 'founder',
    requireRoot: true,
    now: '2026-09-23T12:00:00.000Z',
    evidence: [
      { factor: 'trusted_device', verified: true, observedAt: '2026-09-23T11:59:58.000Z' },
      { factor: 'face_match', verified: true, score: 0.95, observedAt: '2026-09-23T11:59:59.000Z' },
      { factor: 'liveness', verified: true, score: 0.95, observedAt: '2026-09-23T11:59:59.000Z' },
    ],
  }), /additional factor/);
});
