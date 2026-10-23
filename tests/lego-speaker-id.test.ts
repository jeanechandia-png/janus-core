import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ALLOWED_PURPOSES, EncryptedVault, EnrollmentRejectedError, FileVaultStorage, HttpSpeakerEmbedder, MemoryVaultStorage,
  SpeakerIdentifier, UtteranceAudioBuffer, createConsent, parseVaultKey, trimToSpeech, pcmDurationMs,
  type SpeakerEmbedder, type VaultStorage,
} from '../packages/modules/speaker-id/src/index.js';

const RATE = 16_000;

/** Deterministic pseudo-random noise so the test is reproducible. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2 ** 32; };
}

/** Synthetic "voice": harmonic stack on f0 with a per-voice spectral tilt, small jitter, noise, leading silence. */
function synth(f0: number, ms: number, seed: number, tilt = 1): Uint8Array {
  const random = lcg(seed);
  const jitter = 1 + (random() - 0.5) * 0.02;
  const lead = Math.round(RATE * 0.3);
  const total = lead + Math.round((RATE * ms) / 1000);
  const out = new Int16Array(total);
  for (let n = lead; n < total; n += 1) {
    let value = 0;
    for (let h = 1; h <= 10; h += 1) value += (Math.sin((2 * Math.PI * f0 * jitter * h * n) / RATE) / h ** tilt);
    out[n] = Math.round((value * 0.18 + (random() - 0.5) * 0.01) * 32767);
  }
  return new Uint8Array(out.buffer);
}

const FREQS = Array.from({ length: 48 }, (_, i) => 80 * 1.07 ** i);

/** Stand-in for a real model: centred log-magnitudes of a Goertzel filter bank. Good enough to test the LOGIC. */
const fakeEmbedder: SpeakerEmbedder = {
  async embed(pcm) {
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const samples = pcm.byteLength / 2;
    const logs = FREQS.map((freq) => {
      const w = (2 * Math.PI * freq) / RATE;
      const coeff = 2 * Math.cos(w);
      let s1 = 0; let s2 = 0;
      for (let n = 0; n < samples; n += 1) { const s = view.getInt16(n * 2, true) / 32768 + coeff * s1 - s2; s2 = s1; s1 = s; }
      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      return Math.log(power / samples + 1e-9);
    });
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    return { vector: Float32Array.from(logs.map((v) => v - mean)), modelId: 'fake-goertzel-v1' };
  },
};

const KEY = new Uint8Array(32).fill(7);
const POLICY = { matchThreshold: 0.6, minMargin: 0.1, minEnrollConsistency: 0.5 };

const JEAN = { id: 'jean', displayName: 'Jean', role: 'primary_owner' as const };
const KENDRA = { id: 'kendra', displayName: 'Kendra', role: 'household_minor' as const };
const STATEMENT = 'Autorizo el reconocimiento y almacenamiento local de esta voz para personalizar a Janus.';

function build(storage: VaultStorage = new MemoryVaultStorage()) {
  const vault = new EncryptedVault(storage, KEY);
  return { vault, storage, identifier: new SpeakerIdentifier({ embedder: fakeEmbedder, vault, policy: POLICY, now: () => new Date('2026-10-18T10:00:00Z') }) };
}

async function setup() {
  const ctx = build();
  await ctx.identifier.grantConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT });
  await ctx.identifier.grantConsent({ subject: KENDRA, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'parent' }, purposes: ['personalization', 'context_routing'], statement: STATEMENT });
  await ctx.identifier.enroll('jean', [synth(110, 3200, 1, 1), synth(110, 3200, 2, 1), synth(110, 3200, 3, 1)]);
  await ctx.identifier.enroll('kendra', [synth(260, 3200, 11, 1.6), synth(260, 3200, 12, 1.6), synth(260, 3200, 13, 1.6)]);
  return ctx;
}

test('consent rules: adults consent for themselves; minors need a different parent/guardian; purposes are limited', () => {
  assert.ok(createConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT }).policyVersion);
  const minor = createConsent({ subject: KENDRA, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'parent' }, purposes: ['personalization'], statement: STATEMENT });
  assert.equal(minor.subjectIsMinor, true);
  assert.throws(() => createConsent({ subject: KENDRA, grantedBy: { id: 'kendra', displayName: 'Kendra', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT }), /parent or legal guardian/);
  assert.throws(() => createConsent({ subject: KENDRA, grantedBy: { id: 'tio', displayName: 'Tío', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT }), /parent or legal guardian/);
  assert.throws(() => createConsent({ subject: JEAN, grantedBy: { id: 'otro', displayName: 'Otro', relation: 'parent' }, purposes: ['personalization'], statement: STATEMENT }), /own voiceprint/);
  assert.throws(() => createConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: 'sí' }), /statement/);
  assert.throws(() => createConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['authentication' as never], statement: STATEMENT }), /limited to/);
  assert.deepEqual([...ALLOWED_PURPOSES], ['personalization', 'context_routing']);
});

test('vault: encrypted at rest, owner-only file, wrong key and tampering are rejected', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-vault-'));
  const path = join(dir, 'voiceprints.vault');
  const { identifier } = build(new FileVaultStorage(path));
  await identifier.grantConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT });
  await identifier.enroll('jean', [synth(110, 3200, 1), synth(110, 3200, 2), synth(110, 3200, 3)]);

  const raw = readFileSync(path, 'utf8');
  assert.ok(!raw.includes('centroid') && !raw.includes('Jean') && !raw.includes('jean'), 'plaintext leaked into the file');
  assert.equal(statSync(path).mode & 0o777, 0o600);

  assert.equal((await new EncryptedVault(new FileVaultStorage(path), KEY).read()).subjects.jean!.template!.sampleCount, 3);
  await assert.rejects(new EncryptedVault(new FileVaultStorage(path), new Uint8Array(32).fill(9)).read(), /cannot be decrypted/);

  const tampered = JSON.parse(raw) as { ct: string };
  tampered.ct = Buffer.from(Buffer.from(tampered.ct, 'base64').map((b, i) => (i === 3 ? b ^ 1 : b))).toString('base64');
  const memory = new MemoryVaultStorage();
  await memory.save(new Uint8Array(Buffer.from(JSON.stringify(tampered))));
  await assert.rejects(new EncryptedVault(memory, KEY).read(), /cannot be decrypted/);

  assert.equal(parseVaultKey(Buffer.alloc(32, 1).toString('base64')).byteLength, 32);
  assert.equal(parseVaultKey(Buffer.alloc(32, 1).toString('hex')).byteLength, 32);
  assert.throws(() => parseVaultKey('short'), /32 bytes/);
  assert.throws(() => parseVaultKey(undefined), /required/);
});

test('enrolment needs consent, enough clean speech and consistent recordings', async () => {
  const { identifier } = build();
  await assert.rejects(identifier.enroll('jean', [synth(110, 3200, 1), synth(110, 3200, 2), synth(110, 3200, 3)]), /No active consent/);
  await identifier.grantConsent({ subject: JEAN, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: STATEMENT });
  await assert.rejects(identifier.enroll('jean', [synth(110, 3200, 1)]), /At least 3 recordings/);
  await assert.rejects(identifier.enroll('jean', [synth(110, 3200, 1), synth(110, 3200, 2), synth(110, 800, 3)]), /too little speech/);
  const mixed = identifier.enroll('jean', [synth(110, 3200, 1), synth(110, 3200, 2), synth(260, 3200, 3, 1.6)]);
  await assert.rejects(mixed, (error: unknown) => error instanceof EnrollmentRejectedError && /not consistent/.test(error.message));
  const report = await identifier.enroll('jean', [synth(110, 3200, 1), synth(110, 3200, 2), synth(110, 3200, 3)]);
  assert.equal(report.samples, 3);
  assert.ok(report.minPairSimilarity > 0.9);
});

test('identification: Jean and Kendra are recognised, strangers and silence are not, and a match never authorises', async () => {
  const { identifier } = await setup();
  const jean = await identifier.identify(synth(110, 2600, 101));
  assert.equal(jean.decision, 'match');
  assert.equal(jean.subjectId, 'jean');
  assert.equal(jean.role, 'primary_owner');
  const kendra = await identifier.identify(synth(260, 2600, 202, 1.6));
  assert.equal(kendra.decision, 'match');
  assert.equal(kendra.subjectId, 'kendra');
  assert.equal(kendra.role, 'household_minor');
  for (const result of [jean, kendra]) {
    assert.equal(result.authorizes, false);
    assert.equal(result.assurance, 'convenience');
  }
  const stranger = await identifier.identify(synth(175, 2600, 303, 0.8));
  assert.notEqual(stranger.decision, 'match');
  assert.equal(stranger.subjectId, undefined);
  const silent = await identifier.identify(new Uint8Array(RATE * 2 * 3));
  assert.equal(silent.decision, 'insufficient_audio');
  const short = await identifier.identify(synth(110, 400, 5));
  assert.equal(short.decision, 'insufficient_audio');
});

test('withdrawing consent deletes the voiceprint; forget erases the subject; listings never expose vectors', async () => {
  const { identifier, vault } = await setup();
  const listing = await identifier.listSubjects();
  assert.deepEqual(listing.map((entry) => entry.subjectId).sort(), ['jean', 'kendra']);
  assert.ok(!JSON.stringify(listing).includes('centroid'));
  assert.match(listing.find((entry) => entry.subjectId === 'kendra')!.consentGrantedBy!, /Jean \(parent\)/);

  await identifier.revokeConsent('kendra');
  assert.equal((await vault.read()).subjects.kendra!.template, undefined);
  const afterRevoke = await identifier.identify(synth(260, 2600, 404, 1.6));
  assert.notEqual(afterRevoke.subjectId, 'kendra');
  await assert.rejects(identifier.enroll('kendra', [synth(260, 3200, 1, 1.6), synth(260, 3200, 2, 1.6), synth(260, 3200, 3, 1.6)]), /No active consent/);

  await identifier.forget('jean');
  const state = await vault.read();
  assert.equal(state.subjects.jean, undefined);
  assert.ok(state.audit.some((entry) => entry.event === 'forgotten' && entry.subjectId === 'jean'));
  assert.ok(state.audit.every((entry) => !/identify/.test(entry.event)), 'identifications must not be logged');
});

test('concurrent vault updates do not lose writes', async () => {
  const { vault } = build();
  await Promise.all(Array.from({ length: 12 }, (_, i) => vault.update((state) => { state.audit.push({ at: 't', event: 'enrolled', subjectId: `s${i}` }); })));
  assert.equal((await vault.read()).audit.length, 12);
});

test('HTTP embedder: loopback only by default, raw PCM request, strict response validation', async () => {
  assert.throws(() => new HttpSpeakerEmbedder({ baseUrl: 'https://voices.example.com' }), /loopback/);
  assert.doesNotThrow(() => new HttpSpeakerEmbedder({ baseUrl: 'https://voices.example.com', allowRemote: true }));
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const ok = (async (url: string | URL, init: RequestInit = {}) => { calls.push({ url: String(url), init }); return Response.json({ embedding: Array.from({ length: 192 }, (_, i) => i / 192), model_id: 'ecapa' }); }) as typeof fetch;
  const embedder = new HttpSpeakerEmbedder({ baseUrl: 'http://127.0.0.1:8791', fetchImpl: ok });
  const result = await embedder.embed(new Uint8Array(3200));
  assert.equal(result.vector.length, 192);
  assert.equal(result.modelId, 'ecapa');
  assert.equal(calls[0]!.url, 'http://127.0.0.1:8791/embed');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.match(String((calls[0]!.init.headers as Record<string, string>)['content-type']), /audio\/pcm;rate=16000/);
  const bad = (async () => Response.json({ embedding: [1, 2, 3] })) as unknown as typeof fetch;
  await assert.rejects(new HttpSpeakerEmbedder({ baseUrl: 'http://localhost:1', fetchImpl: bad }).embed(new Uint8Array(3200)), /invalid embedding/);
  const down = (async () => new Response('x', { status: 500 })) as typeof fetch;
  await assert.rejects(new HttpSpeakerEmbedder({ baseUrl: 'http://localhost:1', fetchImpl: down }).embed(new Uint8Array(3200)), /500/);
  await assert.rejects(embedder.embed(new Uint8Array(3)), /whole 16-bit/);
});

test('PCM helpers: silence is trimmed and the rolling buffer is bounded and drained', () => {
  const voiced = synth(110, 1000, 1);
  const trimmed = trimToSpeech(voiced);
  assert.ok(pcmDurationMs(trimmed.byteLength) < pcmDurationMs(voiced.byteLength));
  assert.equal(trimToSpeech(new Uint8Array(RATE * 2)).byteLength, 0);
  const buffer = new UtteranceAudioBuffer(500);
  for (let i = 0; i < 20; i += 1) buffer.push(new Uint8Array(RATE * 2 * 0.1));
  assert.ok(buffer.durationMs <= 600);
  assert.ok(buffer.drain().byteLength > 0);
  assert.equal(buffer.drain().byteLength, 0);
});
