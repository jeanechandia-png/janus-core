import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNotPresenceEvidence,
  createLikenessConsent,
  decideLikenessUse,
  revokeLikenessConsent,
  sha256,
} from '../packages/core/src/likeness-consent.js';
import { checkVoiceReference, enrollVoiceClone, parseWav } from '../packages/voice/src/voice-clone-enrollment.js';

function wav(seconds: number, sampleRate = 24_000): Buffer {
  const data = Buffer.alloc(Math.round(seconds * sampleRate) * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const audio = wav(30);
const consent = createLikenessConsent({
  id: 'consent-founder-voice-1',
  principalId: 'founder',
  grantedBy: 'founder',
  modalities: ['voice', 'avatar'],
  uses: ['janus_private_assistant', 'internal_lab_test'],
  products: ['janus'],
  grantedAt: '2026-10-20T10:00:00.000Z',
  expiresAt: '2027-10-20T10:00:00.000Z',
  references: [
    { modality: 'voice', localRef: '/janus/private/voice/reference.wav', sha256: sha256(audio), transcript: 'Hola, soy Jean.', capturedAt: '2026-10-20T10:00:00.000Z' },
    { modality: 'face', localRef: 'secure-store:janus/founder/face-reference', sha256: 'a'.repeat(64), capturedAt: '2026-10-20T10:00:00.000Z' },
  ],
});

test('only the person themself can grant likeness consent', () => {
  assert.throws(() => createLikenessConsent({ ...consent, grantedBy: 'someone-else' }), /themself/);
});

test('remote reference URLs are refused', () => {
  assert.throws(() => createLikenessConsent({
    ...consent,
    references: [{ modality: 'voice', localRef: 'https://example.com/voice.wav', sha256: sha256(audio), transcript: 'x', capturedAt: consent.grantedAt }],
    modalities: ['voice'],
  }), /stay local/);
});

test('use is allowed only within scope and carries an AI disclosure', () => {
  const ok = decideLikenessUse([consent], { principalId: 'founder', modality: 'voice', use: 'janus_private_assistant', product: 'janus', now: '2026-11-01T00:00:00.000Z' });
  assert.equal(ok.allowed, true);
  assert.match(ok.disclosure ?? '', /IA/);
  const outOfScope = decideLikenessUse([consent], { principalId: 'founder', modality: 'voice', use: 'marketing_content', product: 'janus', now: '2026-11-01T00:00:00.000Z' });
  assert.equal(outOfScope.allowed, false);
  const otherProduct = decideLikenessUse([consent], { principalId: 'founder', modality: 'voice', use: 'janus_private_assistant', product: 'chatbox', now: '2026-11-01T00:00:00.000Z' });
  assert.equal(otherProduct.allowed, false);
});

test('revocation stops every future use', () => {
  const revoked = revokeLikenessConsent(consent, '2026-10-21T00:00:00.000Z');
  assert.notEqual(revoked.auditHash, consent.auditHash);
  assert.equal(decideLikenessUse([revoked], { principalId: 'founder', modality: 'voice', use: 'janus_private_assistant', product: 'janus', now: '2026-11-01T00:00:00.000Z' }).allowed, false);
});

test('synthetic output can never authenticate', () => {
  assert.throws(() => assertNotPresenceEvidence('synthetic'), /never valid presence/);
  assert.doesNotThrow(() => assertNotPresenceEvidence('live_capture'));
});

test('wav parsing and quality gates', () => {
  const info = parseWav(audio);
  assert.equal(info.sampleRate, 24_000);
  assert.equal(Math.round(info.durationSeconds), 30);
  assert.equal(checkVoiceReference(info).ok, true);
  assert.equal(checkVoiceReference(parseWav(wav(3))).ok, false);
  assert.equal(checkVoiceReference(parseWav(wav(30, 8_000))).ok, false);
});

test('enrollment produces a local voice_clone entry only for the approved recording', () => {
  const result = enrollVoiceClone({
    voiceId: 'jean-clone-es',
    referencePath: '/janus/private/voice/reference.wav',
    transcript: 'Hola, soy Jean.',
    language: 'Spanish',
    modelPath: '/models/Qwen3-TTS-Base',
    consent,
    product: 'janus',
    now: '2026-11-01T00:00:00.000Z',
    readFile: () => audio,
  });
  assert.equal(result.entry.mode, 'voice_clone');
  assert.equal(result.entry.consent_id, consent.id);
  assert.throws(() => enrollVoiceClone({
    voiceId: 'x', referencePath: '/janus/private/voice/other.wav', transcript: 'Hola', language: 'Spanish', modelPath: '/m',
    consent, product: 'janus', now: '2026-11-01T00:00:00.000Z', readFile: () => wav(31),
  }), /not the one approved/);
});
