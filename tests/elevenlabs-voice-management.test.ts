import test from 'node:test';
import assert from 'node:assert/strict';
import { ElevenLabsVoiceManagementAdapter } from '../packages/adapters/src/elevenlabs-voice-management-adapter.js';

const VOICE = 'AbCdEf1234567890';

test('read-only catalog enumerates personal voices but does not proclaim cloned ownership', async () => {
  const visited: Array<{ url: string; method: string; key: string }> = [];
  const adapter = new ElevenLabsVoiceManagementAdapter({
    apiKeyProvider: async () => 'test-secret',
    fetchImpl: async (input, init) => {
      visited.push({ url: String(input), method: init?.method || 'GET',
        key: String((init?.headers as Record<string,string>)['xi-api-key']) });
      return new Response(JSON.stringify({
        voices: [{ voice_id: VOICE, name: 'Jean?', category: 'cloned', is_owner: true,
          fine_tuning: { state: 'fine_tuned' } }], has_more: false,
      }), { status: 200 });
    },
  });
  const voices = await adapter.listPersonalVoices();
  assert.equal(voices.length, 1);
  assert.equal(voices[0]?.verifiedFounderClone, false);
  assert.equal(voices[0]?.ownedByAccount, true);
  assert.ok(visited[0]?.url.includes('/v2/voices?'));
  assert.ok(visited[0]?.url.includes('voice_type=personal'));
  assert.equal(visited[0]?.method, 'GET');
  assert.equal(visited[0]?.key, 'test-secret');
});

test('missing vault credentials prevent network access', async () => {
  let called = false;
  const a = new ElevenLabsVoiceManagementAdapter({
    apiKeyProvider: async () => undefined,
    fetchImpl: async () => { called = true; throw new Error('no network'); },
  });
  await assert.rejects(() => a.listPersonalVoices(), /credenciales/i);
  assert.equal(called, false);
});

test('cloud clone requires explicit Founder-approved one-time original samples', async () => {
  let calls = 0;
  const adapter = new ElevenLabsVoiceManagementAdapter({
    apiKeyProvider: async () => 'test-key',
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(String(url), 'https://api.elevenlabs.io/v1/voices/add');
      assert.equal(init?.method, 'POST');
      const form = init?.body as FormData;
      assert.equal(form.get('name'), 'JANUS - voz del Founder');
      assert.equal(form.getAll('files').length, 1);
      return new Response(JSON.stringify({ voice_id: VOICE, requires_verification: true }), { status: 200 });
    },
  });
  const hash = 'f'.repeat(64);
  const samples = [{ filename:'founder-original.wav', data: new Blob([new Uint8Array(3000)], { type: 'audio/wav' }),
    provenance: 'original-recording' as const, sha256: hash }];
  const auth = { approvedByFounder: true as const, ownershipConfirmed: true as const,
    allowedRecipient:'elevenlabs' as const, scope:'voice-clone-janus-only' as const,
    approvalReceiptId: 'signed-founder-approval-001', approvalAt: '2026-11-04T18:00:00Z',
    sampleHashes: [hash] };
  await assert.rejects(() => adapter.createInstantClone(samples, { ...auth, approvedByFounder: false as never }), /autorización/i);
  await assert.rejects(() => adapter.createInstantClone(samples, { ...auth, sampleHashes: ['0'.repeat(64)] }), /no coinciden/);
  await assert.rejects(() => adapter.createInstantClone([{ ...samples[0]!, provenance: 'provider-output' as never }], auth), /originales/);
  assert.equal(calls, 0);
  const result = await adapter.createInstantClone(samples, auth);
  assert.equal(calls, 1);
  assert.equal(result.stage, 'needs-verification');
  assert.equal(result.requiresProviderVerification, true);
  assert.equal(result.voiceId, VOICE);
});

test('ElevenLabs host is strict; no accidental exfiltration to an arbitrary URL', () => {
  assert.throws(() => new ElevenLabsVoiceManagementAdapter({ apiKeyProvider: async () => 'key',
    baseUrl: 'https://evil.example' }), /HTTPS de ElevenLabs/);
});
