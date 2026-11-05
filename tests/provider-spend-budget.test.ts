import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { ElevenLabsTtsAdapter, ElevenLabsTtsError } from '../packages/adapters/src/elevenlabs-tts-adapter.js';

test('persistent spending guard survives restarts and refuses daily overage atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-spend-'));
  try {
    const path = join(dir, 'spend.db');
    const first = new SqliteStore(path);
    assert.equal(first.reserveProviderDailyCharacters('elevenlabs', '2026-11-05', 60, 100), true);
    assert.equal(first.reserveProviderDailyCharacters('elevenlabs', '2026-11-05', 50, 100), false);
    assert.equal(first.getProviderDailyCharacters('elevenlabs', '2026-11-05'), 60);
    first.close();
    const restarted = new SqliteStore(path);
    assert.equal(restarted.reserveProviderDailyCharacters('elevenlabs', '2026-11-05', 41, 100), false);
    assert.equal(restarted.reserveProviderDailyCharacters('elevenlabs', '2026-11-05', 40, 100), true);
    assert.equal(restarted.getProviderDailyCharacters('elevenlabs', '2026-11-05'), 100);
    assert.equal(restarted.reserveProviderDailyCharacters('elevenlabs', '2026-11-06', 50, 100), true);
    restarted.close();
  } finally { rmSync(dir, { recursive:true, force:true }); }
});

test('original provider call is blocked on restart, but can still serve next UTC day', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-voice-budget-'));
  const makeAdapter = (store: SqliteStore, day: string, fetchImpl: typeof fetch) => new ElevenLabsTtsAdapter({
    apiKeyProvider: async () => 'fake-key',
    voiceMap: { 'janus-voice': 'AbCdEf1234567890xyz' },
    fetchImpl, maxCharsPerRequest: 100, dailyCharBudget: 100,
    reserveDailyChars: (d,n,limit) => store.reserveProviderDailyCharacters('elevenlabs',d,n,limit),
    usedDailyChars: d => store.getProviderDailyCharacters('elevenlabs',d),
    now: () => new Date(day + 'T12:00:00Z'),
  });
  const consume = async (adapter: ElevenLabsTtsAdapter, text: string) => {
    for await (const _ of adapter.synthesize(text,'janus-voice')) { /* consume */ }
  };
  let called=0;
  const fetchImpl: typeof fetch = async () => {
    called++;
    return new Response(new Uint8Array(1920), { status:200 });
  };
  try {
    const db = join(dir,'voice.db');
    const first=new SqliteStore(db);
    await consume(makeAdapter(first,'2026-11-05',fetchImpl),'A'.repeat(80));
    first.close();
    const restarted=new SqliteStore(db);
    const gateway=makeAdapter(restarted,'2026-11-05',fetchImpl);
    assert.equal(gateway.usage().charactersRequested,80);
    await assert.rejects(() => consume(gateway,'B'.repeat(40)),(e:unknown) =>
      e instanceof ElevenLabsTtsError && e.code === 'budget_exhausted');
    assert.equal(called,1);
    await consume(makeAdapter(restarted,'2026-11-06',fetchImpl),'C'.repeat(40));
    assert.equal(called,2);
    restarted.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
