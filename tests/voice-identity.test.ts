import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateVoiceAttempt,
  revokeVoiceEnrollment,
  validateVoiceTemplateRef,
  type VoiceConsent,
  type VoiceVerifierResult,
} from '../packages/core/src/voice-identity.js';
import type { BiometricTemplateRef } from '../packages/core/src/identity-presence.js';

const NOW = '2026-10-18T10:00:00.000Z';
const template: BiometricTemplateRef = {
  principalId: 'tenant-a/person-1', modality: 'voice', secureStoreRef: 'secure-store:tenant-a/person-1/voice-v1',
  modelId: 'sv-model', modelVersion: '1', enrolledAt: '2026-10-18T09:00:00.000Z',
};
const consent: VoiceConsent = { principalId: 'tenant-a/person-1', grantedBy: 'tenant-a/person-1', grantedAt: '2026-10-18T09:00:00.000Z', purpose: 'Identificar mi voz para el asistente' };
const good: VoiceVerifierResult = { matchScore: 0.9, antiSpoofScore: 0.93, speechSeconds: 4, modelId: 'sv-model', modelVersion: '1' };
const run = (over: Partial<Parameters<typeof evaluateVoiceAttempt>[0]> = {}, result = good) =>
  evaluateVoiceAttempt({ result, template, consent, sensitivity: 'low', now: NOW, ...over });

test('plantilla de voz debe estar en almacenamiento seguro y ser de voz', () => {
  assert.doesNotThrow(() => validateVoiceTemplateRef(template));
  assert.throws(() => validateVoiceTemplateRef({ ...template, modality: 'face' }), /modality voice/);
  assert.throws(() => validateVoiceTemplateRef({ ...template, secureStoreRef: 'sqlite:voice' }), /secure storage/);
});

test('acción de bajo riesgo se acepta con voz verificada', () => {
  assert.equal(run().decision, 'accepted');
});

test('la voz sola nunca basta para acciones sensibles', () => {
  assert.equal(run({ sensitivity: 'sensitive' }).decision, 'needs_second_factor');
  assert.equal(run({ sensitivity: 'sensitive', otherVerifiedFactors: ['trusted_device'] }).decision, 'needs_second_factor');
  assert.equal(run({ sensitivity: 'sensitive', otherVerifiedFactors: ['pin'] }).decision, 'accepted');
});

test('sin anti-suplantación se rechaza aunque la similitud sea alta', () => {
  assert.equal(run({}, { ...good, antiSpoofScore: undefined }).decision, 'rejected');
  assert.equal(run({}, { ...good, antiSpoofScore: 0.3 }).decision, 'rejected');
});

test('voz dudosa ofrece método alternativo tras fallos repetidos', () => {
  const weak = { ...good, matchScore: 0.5 };
  assert.equal(run({}, weak).decision, 'rejected');
  assert.equal(run({ consecutiveFailures: 1 }, weak).decision, 'fallback_alternative');
});

test('habla atípica relaja similitud pero no anti-suplantación', () => {
  const borderline = { ...good, matchScore: 0.77 };
  assert.equal(run({}, borderline).decision, 'rejected');
  assert.equal(run({ atypicalSpeechMode: true }, borderline).decision, 'accepted');
  assert.equal(run({ atypicalSpeechMode: true }, { ...borderline, antiSpoofScore: 0.5 }).decision, 'rejected');
});

test('revocar cierra consentimiento, marca plantilla y pide borrado', () => {
  const r = revokeVoiceEnrollment(consent, template, NOW);
  assert.equal(r.deleteTemplateRef, template.secureStoreRef);
  assert.throws(() => run({ consent: r.consent, now: '2026-10-18T10:01:00.000Z' }), /revoked/);
  assert.throws(() => run({ template: r.template, now: '2026-10-18T10:01:00.000Z' }), /revoked/);
});

test('modelo distinto al de la inscripción exige alternativa', () => {
  assert.equal(run({}, { ...good, modelVersion: '2' }).decision, 'fallback_alternative');
});
