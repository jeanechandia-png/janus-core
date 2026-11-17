import assert from 'node:assert/strict';
import test from 'node:test';
import { ElevenLabsTtsAdapter } from '../packages/adapters/src/elevenlabs-tts-http-adapter.js';

const PCM_MIME = 'audio/pcm;rate=24000;channels=1;format=s16le';
const VOICE_ID = 'raw1BVb72Zr3mbid15Oj';

test('ElevenLabs adapter pins authorized voice, sends secret only as header and yields typed PCM', async () => {
  let calls = 0;
  const pcm = new Uint8Array(4800); // 100 ms mono s16le, 24 kHz
  const adapter = new ElevenLabsTtsAdapter({
    apiKey: 'test-secret-only',
    voiceId: VOICE_ID,
    chunkMs: 40,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://api.elevenlabs.io/v1/text-to-speech/' + VOICE_ID + '?output_format=pcm_24000');
      assert.equal(init?.method, 'POST');
      assert.equal((init?.headers as Record<string, string>)['xi-api-key'], 'test-secret-only');
      assert.equal((init?.headers as Record<string, string>)['accept'], 'audio/pcm');
      assert.deepEqual(JSON.parse(String(init?.body)), { text: 'Hola', model_id: 'eleven_multilingual_v2' });
      assert.ok(!String(url).includes('test-secret-only'));
      return new Response(pcm.buffer, { status: 200, headers: { 'content-type': 'audio/pcm' } });
    },
  });
  const chunks = [];
  // An arbitrary client-provided ID may never redirect the billed API call.
  for await (const chunk of adapter.synthesize('Hola', 'untrusted-client-voice')) chunks.push(chunk);
  assert.equal(calls, 1);
  assert.deepEqual(chunks.map((chunk) => chunk.bytes.byteLength), [1920, 1920, 960]);
  assert.ok(chunks.every((chunk) => chunk.mimeType === PCM_MIME));
});

test('ElevenLabs adapter fails closed for missing credentials and excessive text', async () => {
  assert.throws(() => new ElevenLabsTtsAdapter({ apiKey: '', voiceId: VOICE_ID }), /credential is required/);
  assert.throws(() => new ElevenLabsTtsAdapter({ apiKey: 'secret', voiceId: 'invalid!' }), /voice ID/);
  const adapter = new ElevenLabsTtsAdapter({
    apiKey: 'secret',
    voiceId: VOICE_ID,
    maxCharacters: 8,
    fetchImpl: async () => { throw new Error('remote synthesis should not happen'); },
  });
  await assert.rejects(async () => {
    for await (const _ of adapter.synthesize('demasiado texto', 'janus-default')) { /* no output */ }
  }, /character budget/);
});

test('ElevenLabs adapter redacts upstream error bodies and refuses non-PCM payloads', async () => {
  const fail = new ElevenLabsTtsAdapter({
    apiKey: 'secret', voiceId: VOICE_ID,
    fetchImpl: async () => new Response('SENSITIVE STRING', { status: 429 }),
  });
  await assert.rejects(async () => {
    for await (const _ of fail.synthesize('hola', 'janus-default')) { /* no output */ }
  }, (error: unknown) => error instanceof Error && error.message.includes('HTTP 429') && !error.message.includes('SENSITIVE'));

  const invalid = new ElevenLabsTtsAdapter({
    apiKey: 'secret', voiceId: VOICE_ID,
    fetchImpl: async () => new Response('{"not":"pcm"}', { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(async () => {
    for await (const _ of invalid.synthesize('hola', 'janus-default')) { /* no output */ }
  }, /non-PCM response/);
});
