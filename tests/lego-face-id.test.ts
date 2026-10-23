import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EncryptedVault, EnrollmentRejectedError, FaceIdentifier, HttpFaceEmbedder, MemoryVaultStorage, assertImage,
  type FaceEmbedder,
} from '../packages/modules/face-id/src/index.js';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const KEY = Buffer.alloc(32, 7).toString('base64');

function fake(map: Record<number, { vec: number[]; faces?: number; quality?: number }>): FaceEmbedder {
  return {
    async embed(image) {
      const entry = map[image[4]!]!;
      return { vector: Float32Array.from(entry.vec), modelId: 'fake:1', faces: entry.faces ?? 1, ...(entry.quality !== undefined ? { quality: entry.quality } : {}) };
    },
  };
}
const photo = (id: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, id, 2, 3, 4]);
const jean = [1, 0, 0, 0]; const kendra = [0, 1, 0, 0];
const embedder = fake({ 1: { vec: [1, 0.05, 0, 0] }, 2: { vec: [1, -0.05, 0, 0] }, 3: { vec: [1, 0, 0.05, 0] }, 4: { vec: [0.05, 1, 0, 0] }, 5: { vec: [-0.05, 1, 0, 0] }, 6: { vec: [0, 1, 0.05, 0] }, 7: { vec: [0.97, 0.05, 0, 0] }, 8: { vec: [0.02, 1, 0, 0] }, 9: { vec: [0, 0, 1, 0] }, 10: { vec: [], faces: 0 }, 11: { vec: [1, 0, 0, 0], faces: 2 }, 12: { vec: [1, 0, 0, 0], quality: 0.1 }, 13: { vec: [0.7, 0.7, 0, 0] } });

async function setup() {
  const identifier = new FaceIdentifier({ embedder, vault: new EncryptedVault(new MemoryVaultStorage(), Buffer.from(KEY, 'base64')), policy: { minEnrollConsistency: 0.5, matchThreshold: 0.6, minMargin: 0.1 } });
  await identifier.grantConsent({ subject: { id: 'jean', displayName: 'Jean', role: 'primary_owner' }, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: 'Autorizo el reconocimiento de mi cara para personalizar a Janus.' });
  await identifier.grantConsent({ subject: { id: 'kendra', displayName: 'Kendra', role: 'household_minor' }, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'parent' }, purposes: ['personalization', 'context_routing'], statement: 'Como padre y tutor legal autorizo el reconocimiento de la cara de mi hija.' });
  await identifier.enroll('jean', [photo(1), photo(2), photo(3)]);
  await identifier.enroll('kendra', [photo(4), photo(5), photo(6)]);
  return identifier;
}

test('identifies household members in a closed set and never authorises', async () => {
  const identifier = await setup();
  const a = await identifier.identify(photo(7));
  assert.equal(a.decision, 'match'); assert.equal(a.subjectId, 'jean'); assert.equal(a.authorizes, false);
  const b = await identifier.identify(photo(8));
  assert.equal(b.decision, 'match'); assert.equal(b.subjectId, 'kendra'); assert.equal(b.role, 'household_minor');
  assert.equal((await identifier.identify(photo(9))).decision, 'unknown');
  assert.equal((await identifier.identify(photo(13))).decision, 'ambiguous');
  assert.equal((await identifier.identify(photo(10))).decision, 'no_face');
  assert.equal((await identifier.identify(photo(11))).decision, 'multiple_faces');
});

test('enrolment needs consent, one face, quality, and a guardian for minors', async () => {
  const identifier = new FaceIdentifier({ embedder, vault: new EncryptedVault(new MemoryVaultStorage(), Buffer.from(KEY, 'base64')) });
  await assert.rejects(identifier.enroll('x', [photo(1), photo(2), photo(3)]), EnrollmentRejectedError);
  await assert.rejects(identifier.grantConsent({ subject: { id: 'kid', displayName: 'Kid', role: 'household_minor' }, grantedBy: { id: 'kid', displayName: 'Kid', relation: 'self' }, purposes: ['personalization'], statement: 'Yo mismo autorizo el reconocimiento de mi cara.' }));
  await identifier.grantConsent({ subject: { id: 'jean', displayName: 'Jean', role: 'primary_owner' }, grantedBy: { id: 'jean', displayName: 'Jean', relation: 'self' }, purposes: ['personalization'], statement: 'Autorizo el reconocimiento de mi cara para personalizar a Janus.' });
  await assert.rejects(identifier.enroll('jean', [photo(1), photo(2), photo(11)]), /exactly one face/);
  await assert.rejects(identifier.enroll('jean', [photo(1), photo(2), photo(12)]), /quality/);
});

test('revoking consent deletes the template; forget erases the subject', async () => {
  const identifier = await setup();
  await identifier.revokeConsent('kendra');
  assert.equal((await identifier.identify(photo(8))).subjectId === 'kendra', false);
  await identifier.forget('jean');
  assert.equal((await identifier.listSubjects()).some((s) => s.subjectId === 'jean'), false);
});

test('images are validated by magic bytes and the embedder must be on loopback', async () => {
  assert.equal(assertImage(JPEG), 'jpeg');
  assert.throws(() => assertImage(new Uint8Array([1, 2, 3, 4, 5])));
  assert.throws(() => new HttpFaceEmbedder({ baseUrl: 'http://example.com:8792' }), /loopback/);
  const calls: string[] = [];
  const http = new HttpFaceEmbedder({ baseUrl: 'http://127.0.0.1:8792', fetchImpl: (async (url: string, init: RequestInit) => { calls.push(`${url} ${(init.headers as Record<string, string>)['content-type']}`); return new Response(JSON.stringify({ embedding: Array(128).fill(0.1), model_id: 'm', faces: 1, quality: 0.9 })); }) as typeof fetch });
  const out = await http.embed(JPEG);
  assert.equal(out.faces, 1); assert.equal(out.vector.length, 128);
  assert.deepEqual(calls, ['http://127.0.0.1:8792/embed image/jpeg']);
});
