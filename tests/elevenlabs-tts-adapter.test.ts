import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ELEVENLABS_PCM_MIME,
  ElevenLabsTtsAdapter,
  ElevenLabsTtsError,
  isSafeProviderVoiceId,
} from '../packages/adapters/src/elevenlabs-tts-adapter.js';

const PROVIDER_VOICE = 'AbCdEf1234567890xyz';

function pcm(bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i += 1) out[i] = i % 251;
  return out;
}

function streamOf(parts: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

async function collect(iterable: AsyncIterable<{ bytes: Uint8Array; mimeType: string }>) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}

function adapterWith(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return new ElevenLabsTtsAdapter({
    apiKeyProvider: async () => 'test-key-not-real',
    voiceMap: { 'janus-voice': PROVIDER_VOICE },
    fetchImpl,
    ...extra,
  });
}

test('ElevenLabs adapter streams aligned PCM and sends the key only as a header', async () => {
  const total = 24_000 * 2 / 10; // 100 ms
  const data = pcm(total);
  let seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    seen = {
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    };
    // Trozos con tamaños impares para comprobar la realineación a fotogramas.
    return new Response(streamOf([data.slice(0, 1001), data.slice(1001, 2999), data.slice(2999)]), {
      status: 200,
      headers: { 'content-type': 'audio/pcm' },
    });
  };

  const chunks = await collect(
    adapterWith(fetchImpl, { modelId: 'eleven_flash_v2_5', languageCode: 'es', chunkMs: 40 }).synthesize(' Hola Jean ', 'janus-voice'),
  );

  assert.equal(seen?.url, `https://api.elevenlabs.io/v1/text-to-speech/${PROVIDER_VOICE}/stream?output_format=pcm_24000`);
  assert.equal(seen?.headers['xi-api-key'], 'test-key-not-real');
  assert.equal(seen?.body.text, 'Hola Jean');
  assert.equal(seen?.body.model_id, 'eleven_flash_v2_5');
  assert.equal(seen?.body.language_code, 'es');
  assert.ok(!JSON.stringify(seen?.body).includes('test-key-not-real'));

  assert.ok(chunks.every((chunk) => chunk.mimeType === ELEVENLABS_PCM_MIME));
  assert.ok(chunks.every((chunk) => chunk.bytes.byteLength % 2 === 0));
  const joined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.bytes.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk.bytes, offset);
    offset += chunk.bytes.byteLength;
  }
  assert.deepEqual(joined, data);
  assert.equal(chunks[0]?.bytes.byteLength, 1_920);
});

test('ElevenLabs adapter never leaves the machine for an unmapped Janus voice', async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response(new Uint8Array(2));
  };
  const adapter = adapterWith(fetchImpl);

  assert.equal(adapter.canServe('janus-voice'), true);
  assert.equal(adapter.canServe('kendra-profile'), false);
  await assert.rejects(
    () => collect(adapter.synthesize('hola', 'kendra-profile')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'voice_not_mapped' && error.scope === 'request',
  );
  assert.equal(called, false);
});

test('ElevenLabs adapter enforces per-request cap and the daily character budget', async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(streamOf([pcm(1920)]), { status: 200 });
  };
  let current = new Date('2026-11-04T10:00:00Z');
  const adapter = adapterWith(fetchImpl, { maxCharsPerRequest: 60, dailyCharBudget: 100, now: () => current });

  await assert.rejects(
    () => collect(adapter.synthesize('x'.repeat(61), 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'text_too_long' && error.scope === 'request',
  );
  await collect(adapter.synthesize('a'.repeat(60), 'janus-voice'));
  await assert.rejects(
    () => collect(adapter.synthesize('b'.repeat(50), 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'budget_exhausted' && error.scope === 'provider',
  );
  assert.equal(calls, 1);
  assert.deepEqual(adapter.usage(), {
    day: '2026-11-04',
    charactersRequested: 60,
    dailyCharBudget: 100,
    requests: 1,
  });

  current = new Date('2026-11-05T00:00:01Z');
  await collect(adapter.synthesize('b'.repeat(50), 'janus-voice'));
  assert.equal(calls, 2);
  assert.equal(adapter.usage().day, '2026-11-05');
});

test('ElevenLabs adapter classifies HTTP failures without leaking the credential', async () => {
  const make = (status: number, body: string) =>
    adapterWith(async () => new Response(body, { status }));

  await assert.rejects(
    () => collect(make(401, 'bad key test-key-not-real').synthesize('hola', 'janus-voice')),
    (error: unknown) => {
      assert.ok(error instanceof ElevenLabsTtsError);
      assert.equal(error.code, 'auth');
      assert.equal(error.scope, 'provider');
      assert.ok(!error.message.includes('test-key-not-real'));
      return true;
    },
  );
  await assert.rejects(
    () => collect(make(429, 'slow down').synthesize('hola', 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'rate_limited',
  );
  await assert.rejects(
    () => collect(make(422, '{"detail":"invalid"}').synthesize('hola', 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'http' && error.scope === 'request',
  );
  await assert.rejects(
    () => collect(make(503, 'down').synthesize('hola', 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'http' && error.scope === 'provider',
  );
});

test('ElevenLabs adapter reports a missing credential and truncated frames', async () => {
  const noKey = new ElevenLabsTtsAdapter({
    apiKeyProvider: async () => undefined,
    voiceMap: { 'janus-voice': PROVIDER_VOICE },
    fetchImpl: async () => {
      throw new Error('must not be called');
    },
  });
  await assert.rejects(
    () => collect(noKey.synthesize('hola', 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'not_configured',
  );

  const truncated = adapterWith(async () => new Response(streamOf([pcm(1921)]), { status: 200 }));
  await assert.rejects(
    () => collect(truncated.synthesize('hola', 'janus-voice')),
    (error: unknown) => error instanceof ElevenLabsTtsError && error.code === 'truncated_audio',
  );
});

test('ElevenLabs adapter only accepts https elevenlabs.io hosts and safe provider voice ids', () => {
  const base = { apiKeyProvider: async () => 'k', voiceMap: { v: PROVIDER_VOICE } };
  assert.throws(() => new ElevenLabsTtsAdapter({ ...base, baseUrl: 'http://api.elevenlabs.io' }), /https/);
  assert.throws(() => new ElevenLabsTtsAdapter({ ...base, baseUrl: 'https://evil.example.com' }), /elevenlabs\.io/);
  assert.doesNotThrow(() => new ElevenLabsTtsAdapter({ ...base, baseUrl: 'https://api.eu.residency.elevenlabs.io' }));

  assert.equal(isSafeProviderVoiceId(PROVIDER_VOICE), true);
  assert.equal(isSafeProviderVoiceId('../../etc/passwd'), false);
  const unsafe = new ElevenLabsTtsAdapter({ ...base, voiceMap: { bad: 'a/b?c=d' } });
  assert.equal(unsafe.canServe('bad'), false);
});
