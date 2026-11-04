import assert from 'node:assert/strict';
import test from 'node:test';
import type { SpeechOutputChunk, TextToSpeechGateway } from '../packages/gateways/src/contracts.js';
import { FallbackTextToSpeechGateway, type FallbackTtsEvent } from '../packages/voice/src/fallback-tts-gateway.js';

const chunk = (tag: number): SpeechOutputChunk => ({ bytes: new Uint8Array([tag, 0]), mimeType: 'audio/pcm;rate=24000;channels=1;format=s16le' });

function gateway(
  impl: (text: string, voiceId: string) => AsyncIterable<SpeechOutputChunk>,
): TextToSpeechGateway & { calls: number } {
  const wrapper = {
    calls: 0,
    synthesize(text: string, voiceId: string) {
      wrapper.calls += 1;
      return impl(text, voiceId);
    },
  };
  return wrapper;
}

async function collect(iterable: AsyncIterable<SpeechOutputChunk>): Promise<number[]> {
  const tags: number[] = [];
  for await (const item of iterable) tags.push(item.bytes[0]!);
  return tags;
}

const failingProvider = (scope?: 'request' | 'provider') =>
  gateway(async function* () {
    throw Object.assign(new Error('boom'), { code: 'http', ...(scope ? { scope } : {}) });
  });

const local = (tag = 9) =>
  gateway(async function* () {
    yield chunk(tag);
  });

test('uses the primary provider while it works and never touches the fallback', async () => {
  const primary = gateway(async function* () {
    yield chunk(1);
    yield chunk(2);
  });
  const fallback = local();
  const router = new FallbackTextToSpeechGateway({ primary, fallback });

  assert.deepEqual(await collect(router.synthesize('hola', 'v')), [1, 2]);
  assert.equal(fallback.calls, 0);
  assert.equal(router.status().primaryServed, 1);
});

test('falls back to local when the provider fails before audio and cools down afterwards', async () => {
  let clock = 1_000_000;
  const primary = failingProvider('provider');
  const fallback = local();
  const events: FallbackTtsEvent[] = [];
  const router = new FallbackTextToSpeechGateway({
    primary,
    fallback,
    cooldownMs: 30_000,
    now: () => clock,
    onEvent: (event) => events.push(event),
  });

  assert.deepEqual(await collect(router.synthesize('uno', 'v')), [9]);
  assert.equal(primary.calls, 1);
  assert.equal(router.status().primary, 'cooling_down');
  assert.deepEqual(events.map((event) => event.type), ['cooldown-opened', 'fallback']);

  // Dentro del enfriamiento no se vuelve a llamar al proveedor.
  clock += 10_000;
  assert.deepEqual(await collect(router.synthesize('dos', 'v')), [9]);
  assert.equal(primary.calls, 1);

  // Pasado el enfriamiento se reintenta el proveedor.
  clock += 21_000;
  await collect(router.synthesize('tres', 'v'));
  assert.equal(primary.calls, 2);
  assert.equal(router.status().fallbackServed, 3);
});

test('a request-scoped error routes only that request to local and opens no cooldown', async () => {
  const primary = failingProvider('request');
  const fallback = local();
  const router = new FallbackTextToSpeechGateway({ primary, fallback });

  await collect(router.synthesize('hola', 'kendra'));
  assert.equal(router.status().primary, 'active');
  await collect(router.synthesize('hola', 'kendra'));
  assert.equal(primary.calls, 2, 'cada petición vuelve a evaluarse en el proveedor');
});

test('does not mix two voices when the provider dies mid-stream', async () => {
  const primary = gateway(async function* () {
    yield chunk(1);
    throw new Error('connection reset');
  });
  const fallback = local();
  const router = new FallbackTextToSpeechGateway({ primary, fallback });

  await assert.rejects(() => collect(router.synthesize('hola', 'v')), /connection reset/);
  assert.equal(fallback.calls, 0);
});

test('without a fallback the provider error propagates unchanged', async () => {
  const router = new FallbackTextToSpeechGateway({ primary: failingProvider('provider') });
  await assert.rejects(() => collect(router.synthesize('hola', 'v')), /boom/);
  assert.equal(router.status().fallbackConfigured, false);
});
