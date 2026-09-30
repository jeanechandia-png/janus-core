import assert from 'node:assert/strict';
import test from 'node:test';
import { MetaInsightsAdapter } from '../packages/adapters/src/meta-insights-adapter.js';
import { YouTubeInsightsAdapter } from '../packages/adapters/src/youtube-insights-adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Meta insights adapter remains read-only and uses an explicitly configured API version', async () => {
  let observedUrl = '';
  let observedAuth = '';
  const adapter = new MetaInsightsAdapter({
    apiVersion: 'v26.0',
    accessToken: 'meta-secret',
    fetchImpl: async (input, init) => {
      observedUrl = String(input);
      observedAuth = String((init?.headers as Record<string, string> | undefined)?.authorization ?? '');
      return jsonResponse({
        data: [{ name: 'reach', values: [{ value: 10 }] }],
      });
    },
  });

  const result = await adapter.execute({
    tool: 'meta-insights',
    action: 'instagram.account.insights',
    input: {
      entityId: 'ig-123',
      metrics: ['reach'],
      period: 'day',
    },
  }, async () => {});

  assert.equal(result.ok, true);
  assert.match(observedUrl, /graph\.facebook\.com\/v26\.0\/ig-123\/insights/);
  assert.match(observedUrl, /metric=reach/);
  assert.equal(observedAuth, 'Bearer meta-secret');
  assert.equal(JSON.stringify(result).includes('meta-secret'), false);
  assert.equal(result.output?.platform, 'instagram');
});

test('Meta insights adapter refuses startup without an explicit Graph API version', () => {
  assert.throws(
    () => new MetaInsightsAdapter({ apiVersion: 'latest' }),
    /explicitly configured/,
  );
});

test('YouTube adapter returns channel statistics through OAuth without storing the token', async () => {
  let observedUrl = '';
  const adapter = new YouTubeInsightsAdapter({
    accessToken: 'youtube-secret',
    fetchImpl: async (input) => {
      observedUrl = String(input);
      return jsonResponse({
        items: [{
          id: 'channel-1',
          snippet: { title: 'Infinity' },
          statistics: { subscriberCount: '42', viewCount: '1000' },
        }],
      });
    },
  });

  const result = await adapter.execute({
    tool: 'youtube-insights',
    action: 'channel.statistics',
    input: { channelId: 'channel-1' },
  }, async () => {});

  assert.equal(result.ok, true);
  assert.match(observedUrl, /youtube\/v3\/channels/);
  assert.match(observedUrl, /id=channel-1/);
  assert.equal(result.output?.platform, 'youtube');
  assert.equal(JSON.stringify(result).includes('youtube-secret'), false);
});

test('YouTube analytics adapter supports revenue/engagement metric queries as read-only evidence', async () => {
  let observedUrl = '';
  const adapter = new YouTubeInsightsAdapter({
    accessToken: 'youtube-secret',
    fetchImpl: async (input) => {
      observedUrl = String(input);
      return jsonResponse({
        columnHeaders: [
          { name: 'views', dataType: 'INTEGER', columnType: 'METRIC' },
          { name: 'estimatedRevenue', dataType: 'FLOAT', columnType: 'METRIC' },
        ],
        rows: [[100, 2.5]],
      });
    },
  });

  const result = await adapter.execute({
    tool: 'youtube-insights',
    action: 'analytics.query',
    input: {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      metrics: ['views', 'estimatedRevenue'],
    },
  }, async () => {});

  assert.equal(result.ok, true);
  assert.match(observedUrl, /youtubeanalytics\.googleapis\.com\/v2\/reports/);
  assert.match(observedUrl, /estimatedRevenue/);
  assert.deepEqual(result.output?.metrics, ['views', 'estimatedRevenue']);
});
