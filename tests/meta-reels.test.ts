import assert from 'node:assert/strict';
import test from 'node:test';

import { MetaInsightsAdapter } from '../packages/adapters/src/meta-insights-adapter.js';

function fakeFetch(routes: Record<string, unknown>, calls: string[]): typeof fetch {
  return (async (input: URL | string) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    const key = Object.keys(routes).find((path) => url.pathname.endsWith(path));
    if (!key) return new Response(JSON.stringify({ error: { message: 'not found', code: 100 } }), { status: 400 });
    const body = routes[key];
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
}

test('lee el perfil de Instagram (seguidores y publicaciones) sin exponer el token', async () => {
  const calls: string[] = [];
  const adapter = new MetaInsightsAdapter({
    apiVersion: 'v23.0', accessToken: 'secreto',
    fetchImpl: fakeFetch({ '/17841400000000001': { username: 'infinityseedgroup', followers_count: 1234, media_count: 87 } }, calls),
  });
  const result = await adapter.execute({ tool: 'meta-insights', action: 'instagram.account.profile', input: { entityId: '17841400000000001' } }, () => {});
  assert.equal(result.ok, true);
  assert.equal(result.output?.followersCount, 1234);
  assert.equal(result.output?.username, 'infinityseedgroup');
  assert.match(calls[0]!, /fields=username%2Cname%2Cfollowers_count%2Cmedia_count/);
  assert.doesNotMatch(JSON.stringify(result), /secreto/);
});

test('reels recientes: filtra REELS, pide métricas vigentes (views) y degrada si faltan insights', async () => {
  const calls: string[] = [];
  const adapter = new MetaInsightsAdapter({
    apiVersion: 'v23.0', accessToken: 'secreto',
    fetchImpl: fakeFetch({
      '/17841400000000001/media': { data: [
        { id: 'm1', media_product_type: 'REELS', caption: 'Reel 1', permalink: 'https://www.instagram.com/reel/1/', timestamp: '2026-10-12T10:00:00+0000', like_count: 10, comments_count: 2 },
        { id: 'm2', media_product_type: 'FEED', caption: 'Foto' },
        { id: 'm3', media_product_type: 'REELS', caption: 'Reel 3', like_count: 5, comments_count: 1 },
      ] },
      '/m1/insights': { data: [
        { name: 'views', values: [{ value: 3400 }] },
        { name: 'shares', total_value: { value: 12 } },
      ] },
      '/m3/insights': new Response(JSON.stringify({ error: { message: 'unsupported', code: 100 } }), { status: 400 }),
    }, calls),
  });
  const result = await adapter.execute({ tool: 'meta-insights', action: 'instagram.reels.recent', input: { entityId: '17841400000000001', limit: 5 } }, () => {});
  assert.equal(result.ok, true);
  const reels = result.output?.reels as Array<{ id: string; metrics: Record<string, number | null>; insightsAvailable: boolean }>;
  assert.deepEqual(reels.map((reel) => reel.id), ['m1', 'm3']);
  assert.equal(reels[0]!.metrics.views, 3400);
  assert.equal(reels[0]!.metrics.shares, 12);
  assert.equal(reels[0]!.metrics.likes, 10);
  assert.equal(reels[1]!.insightsAvailable, false);
  assert.equal(reels[1]!.metrics.likes, 5);
  const insightCall = calls.find((call) => call.includes('/m1/insights'))!;
  assert.match(insightCall, /metric=views/);
  assert.doesNotMatch(insightCall, /plays/);
});

test('acciones existentes de Meta siguen funcionando (aditivo)', async () => {
  const adapter = new MetaInsightsAdapter({ apiVersion: 'v23.0', accessToken: 't', fetchImpl: fakeFetch({ '/123/insights': { data: [] } }, []) });
  assert.ok(adapter.capabilities.includes('instagram.account.insights'));
  assert.ok(adapter.capabilities.includes('facebook.page.insights'));
  const result = await adapter.execute({ tool: 'meta-insights', action: 'instagram.account.insights', input: { entityId: '123', metrics: ['reach'] } }, () => {});
  assert.equal(result.ok, true);
});
