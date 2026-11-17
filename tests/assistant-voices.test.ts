import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveAssistantVoiceProfiles, selectAssistantVoice } from '../packages/voice/src/assistant-profiles.js';
import { ElevenLabsTtsAdapter } from '../packages/adapters/src/elevenlabs-tts-adapter.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

const config = { profiles: {
  janus: { providerVoiceId: 'TestMale123456789', modelId: 'eleven_multilingual_v2' },
  melanie: { providerVoiceId: 'TestFemale1234567', voiceSettings: { stability: 0.5, similarityBoost: 0.8, speed: 0.95 } },
} };
const consume = async (source: AsyncIterable<unknown>) => { for await (const _ of source) { /* consume */ } };

test('assistant roles preserve Janus and Melanie identities; arbitrary/cloud/child voice identifiers are rejected', () => {
  const profiles = resolveAssistantVoiceProfiles({}, config);
  assert.equal(selectAssistantVoice(profiles, undefined).id, 'janus');
  assert.equal(selectAssistantVoice(profiles, 'melanie').providerVoiceId, config.profiles.melanie.providerVoiceId);
  assert.equal(selectAssistantVoice(profiles, 'janus-default').id, 'janus');
  for (const id of ['kendra', 'lumi', config.profiles.janus.providerVoiceId, '__proto__']) assert.throws(() => selectAssistantVoice(profiles, id), /no autorizado/);
  assert.throws(() => resolveAssistantVoiceProfiles({ JANUS_MELANIE_VOICE_ID: 'janus-default' }), /distintos/);
});

test('both ElevenLabs voices use their exact mapped IDs and settings with one durable budget across restarts', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-voice-budget-'));
  let store = new SqliteStore(join(dir, 'voice.db'));
  try {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const profiles = resolveAssistantVoiceProfiles({}, config);
    const make = () => new ElevenLabsTtsAdapter({
      apiKeyProvider: async () => 'fixture-only',
      voiceMap: Object.fromEntries(profiles.map(p => [p.voiceId, p.providerVoiceId!])),
      voiceOptions: Object.fromEntries(profiles.map(p => [p.voiceId, { modelId: p.modelId, voiceSettings: p.voiceSettings }])),
      dailyCharBudget: 100,
      now: () => new Date('2026-11-17T12:00:00Z'),
      usageStore: {
        read: day => store.voiceProviderUsage('elevenlabs', day),
        reserve: (day, chars, budget) => store.reserveVoiceProviderUsage('elevenlabs', day, chars, budget),
      },
      fetchImpl: async (url, init) => { calls.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return new Response(new Uint8Array(1920)); },
    });
    await consume(make().synthesize('a'.repeat(40), 'janus-default'));
    store.close(); store = new SqliteStore(join(dir, 'voice.db'));
    const adapter = make();
    assert.equal(adapter.usage().charactersRequested, 40, 'restart does not reset spending');
    await consume(adapter.synthesize('b'.repeat(40), 'melanie-default'));
    assert.match(calls[0]!.url, /TestMale123456789/);
    assert.match(calls[1]!.url, /TestFemale1234567/);
    assert.deepEqual(calls[1]!.body.voice_settings, { stability: 0.5, similarity_boost: 0.8, speed: 0.95 });
    assert.equal(adapter.usage().charactersRequested, 80);
    await assert.rejects(() => consume(adapter.synthesize('c'.repeat(30), 'janus-default')), /Presupuesto/);
    assert.equal(calls.length, 2);
    const parallel = await Promise.allSettled([consume(adapter.synthesize('d'.repeat(15), 'janus-default')), consume(adapter.synthesize('e'.repeat(15), 'melanie-default'))]);
    assert.equal(parallel.filter(p => p.status === 'fulfilled').length, 1);
    assert.equal(adapter.usage().charactersRequested, 95);
    assert.equal(calls.length, 3, 'only one concurrent request leaves the process');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
