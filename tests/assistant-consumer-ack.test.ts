import assert from 'node:assert/strict';
import test from 'node:test';
import { AssistantConsumerStatusAdapter } from '../packages/adapters/src/assistant-consumer-status-adapter.js';
import type { AssistantConfigDelivery } from '../packages/core/src/assistant-config-publisher.js';
import {
  DEFAULT_ASSISTANT_CONSUMER_STATUS_URLS,
  evaluateConsumerAcknowledgement,
  resolveConsumerStatusUrls,
} from '../packages/core/src/assistant-consumer-ack.js';

const URL_OK = 'https://infinitychatbox.nl/api/v1/assistant-control/status';
const SUM = 'ab'.repeat(32);

function delivery(over: Partial<AssistantConfigDelivery> = {}): AssistantConfigDelivery {
  return {
    id: 'del-1', surfaceId: 'landing.infinity-chatbox', profileId: 'infinity-landing-assistant', profileRevision: 2,
    bundleChecksum: SUM, targetKind: 'repository', target: 'o/r', status: 'published_verified',
    createdAt: '2026-10-13T17:00:00Z', updatedAt: '2026-10-13T17:00:00Z', createdBy: 'founder', attempts: 1, ...over,
  };
}

function body(control: Record<string, unknown>) {
  return { ok: true, applied: control.status === 'loaded', assistantControl: control };
}

const loaded = { status: 'loaded', surfaceId: 'landing.infinity-chatbox', profileRevision: 2, bundleChecksum: SUM, error: null };

test('applied only when the live consumer reports this exact bundle loaded', () => {
  const result = evaluateConsumerAcknowledgement({ delivery: delivery(), statusBody: body(loaded), sourceUrl: URL_OK, observedAt: '2026-10-13T18:00:00Z' });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.acknowledgementSource, 'janus-probe:' + URL_OK + '@2026-10-13T18:00:00Z');
});

test('missing, invalid, other surface, other revision or other checksum is never applied', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ ...loaded, status: 'missing' }, 'not_loaded'],
    [{ ...loaded, status: 'invalid', error: 'checksum' }, 'not_loaded'],
    [{ ...loaded, surfaceId: 'landing.iba' }, 'surface_mismatch'],
    [{ ...loaded, profileRevision: 1 }, 'revision_mismatch'],
    [{ ...loaded, bundleChecksum: 'cd'.repeat(32) }, 'checksum_mismatch'],
  ];
  for (const [control, code] of cases) {
    const result = evaluateConsumerAcknowledgement({ delivery: delivery(), statusBody: body(control), sourceUrl: URL_OK, observedAt: 'now' });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, code);
  }
  const malformed = evaluateConsumerAcknowledgement({ delivery: delivery(), statusBody: { ok: true, applied: true }, sourceUrl: URL_OK, observedAt: 'now' });
  assert.equal(!malformed.ok && malformed.code, 'malformed');
});

test('a top-level applied:true without matching evidence is not trusted', () => {
  const result = evaluateConsumerAcknowledgement({
    delivery: delivery(),
    statusBody: { ok: true, applied: true, assistantControl: { ...loaded, bundleChecksum: null } },
    sourceUrl: URL_OK, observedAt: 'now',
  });
  assert.equal(result.ok, false);
});

test('unpublished deliveries cannot be observed as applied', () => {
  const result = evaluateConsumerAcknowledgement({ delivery: delivery({ status: 'desired' }), statusBody: body(loaded), sourceUrl: URL_OK, observedAt: 'now' });
  assert.equal(!result.ok && result.code, 'not_published');
});

test('status URL map has the verified ChatBox default and rejects non-https overrides', () => {
  assert.equal(DEFAULT_ASSISTANT_CONSUMER_STATUS_URLS['landing.infinity-chatbox'], URL_OK);
  assert.equal(resolveConsumerStatusUrls('{"landing.iba":"https://iba.example/api/status"}')['landing.iba'], 'https://iba.example/api/status');
  assert.throws(() => resolveConsumerStatusUrls('{"x":"http://insecure"}'));
  assert.throws(() => resolveConsumerStatusUrls('not json'));
});

test('consumer adapter: GET-only, allowlisted https, no redirects, no credentials', async () => {
  const seen: RequestInit[] = [];
  const adapter = new AssistantConsumerStatusAdapter({
    allowedUrls: [URL_OK],
    fetchImpl: (async (_url: string | URL, init?: RequestInit) => {
      seen.push(init ?? {});
      return new Response(JSON.stringify(body(loaded)), { status: 200 });
    }) as typeof fetch,
  });
  const ok = await adapter.execute({ tool: 'assistant-consumer', action: 'status.read', input: { url: URL_OK } }, () => {});
  assert.equal(ok.ok, true);
  const first = seen[0] ?? {};
  assert.equal(first.method, 'GET');
  assert.equal(first.redirect, 'error');
  assert.equal(first.credentials, 'omit');
  for (const url of ['https://evil.example/status', 'http://infinitychatbox.nl/api/v1/assistant-control/status', 'https://user:pw@infinitychatbox.nl/api/v1/assistant-control/status']) {
    const denied = await adapter.execute({ tool: 'assistant-consumer', action: 'status.read', input: { url } }, () => {});
    assert.equal(denied.ok, false);
  }
  assert.equal(seen.length, 1, 'denied URLs must never be fetched');
});

test('consumer adapter fails closed on HTTP errors, oversized or non-JSON bodies', async () => {
  for (const [status, text] of [[500, '{}'], [200, 'not json'], [200, JSON.stringify({ pad: 'x'.repeat(70_000) })]] as const) {
    const adapter = new AssistantConsumerStatusAdapter({
      allowedUrls: [URL_OK],
      fetchImpl: (async () => new Response(text, { status })) as typeof fetch,
    });
    const result = await adapter.execute({ tool: 'assistant-consumer', action: 'status.read', input: { url: URL_OK } }, () => {});
    assert.equal(result.ok, false);
  }
});
