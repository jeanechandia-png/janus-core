import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalVoiceClone } from '../packages/identity-lego/local-adapters.js';

test('local clone uses the enrolled Qwen voice', async () => {
  let selected = '';
  const clone = createLocalVoiceClone({
    qwen: {
      baseUrl: 'http://127.0.0.1:8020',
      fetchImpl: async (_url, init) => {
        selected = JSON.parse(String(init?.body)).voiceId;
        return new Response(new Uint8Array([1, 0]), {
          headers: { 'content-type': 'audio/pcm;rate=24000;channels=1;format=s16le' },
        });
      },
    },
    voiceIds: { jean: 'jean-local' },
  });
  const pcm = await clone.synthesize({
    subject: 'jean',
    text: 'Hola',
    consent: { subject: 'jean', purpose: 'voice-synthesis', grantedBy: 'jean', grantedAt: '2026-11-01T00:00:00Z' },
  });
  assert.equal(selected, 'jean-local');
  assert.deepEqual(pcm, new Uint8Array([1, 0]));
});
test('rejects remote Qwen by default', () => {
  assert.throws(() => createLocalVoiceClone({
    qwen: { baseUrl: 'https://example.org' }, voiceIds: { jean: 'jean-local' },
  }));
});
