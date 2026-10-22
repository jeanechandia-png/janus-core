import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ToolGateway, ToolRequest, ToolResult } from '../packages/gateways/src/contracts.js';
import { ThreadsInsightsAdapter, THREADS_EARLIEST_TIMESTAMP } from '../packages/adapters/src/threads-insights-adapter.js';
import { mergeFounderReferenceLibraries, parseFounderReferenceLibrary } from '../packages/core/src/founder-reference-library.js';
import { buildFounderSocialSourceRegistry, cleanSocialUrl } from '../packages/core/src/founder-social-sources.js';
import { validateFounderSocialIdentityBinding } from '../packages/core/src/founder-social-identity-binding.js';
import { createSocialChannelSnapshot } from '../packages/core/src/business-operations.js';
import { diffMetrics, flattenInsights, planSocialWatch, runSocialWatch, type StoredWatchSnapshot, type WatchSourceInput } from '../packages/core/src/social-watch.js';

const noop = async () => {};
const TOKEN = 'THREADS-SECRET-TOKEN-123';
type Call = { url: URL; init: RequestInit };
function fakeFetch(responder: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: new URL(String(url)), init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return { impl, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const req = (action: string, input: Record<string, unknown> = {}): ToolRequest => ({ tool: 'threads-insights', action, input });

/* ------------------------------- Threads: adaptador de solo lectura ------------------------------- */

test('Threads: perfil por /me con los campos documentados; el token no aparece en la salida', async () => {
  const { impl, calls } = fakeFetch(() => json({ id: '1234567', username: 'la_tribuna_virtual', name: 'La Tribuna', is_verified: false }));
  const adapter = new ThreadsInsightsAdapter({ accessToken: TOKEN, fetchImpl: impl });
  const res = await adapter.execute(req('threads.account.profile'), noop);
  assert.equal(res.ok, true);
  assert.equal(calls[0]!.url.origin + calls[0]!.url.pathname, 'https://graph.threads.com/v1.0/me');
  assert.equal(calls[0]!.url.searchParams.get('fields'), 'id,username,name,is_verified');
  assert.deepEqual({ userId: res.output!.userId, username: res.output!.username }, { userId: '1234567', username: 'la_tribuna_virtual' });
  assert.equal(JSON.stringify(res).includes(TOKEN), false);
});

test('Threads: insights con métricas verificadas; rechaza métricas, ids y fechas inválidas sin llamar a la red', async () => {
  const { impl, calls } = fakeFetch(() => json({ data: [{ name: 'views', period: 'day', total_value: { value: 120 } }] }));
  const adapter = new ThreadsInsightsAdapter({ accessToken: TOKEN, fetchImpl: impl });
  const ok = await adapter.execute(req('threads.account.insights', { userId: '1234567', metrics: ['views', 'likes', 'nope'], since: THREADS_EARLIEST_TIMESTAMP + 10 }), noop);
  assert.equal(ok.ok, true);
  assert.equal(calls[0]!.url.pathname, '/v1.0/1234567/threads_insights');
  assert.equal(calls[0]!.url.searchParams.get('metric'), 'views,likes');
  assert.deepEqual(ok.output!.requestedMetrics, ['views', 'likes']);

  const antes = calls.length;
  for (const input of [
    { userId: 'abc', metrics: ['views'] },
    { userId: '123', metrics: ['impressions'] },
    { userId: '123', metrics: ['views'], since: 1000 },
    { userId: '123', metrics: ['followers_count'], since: THREADS_EARLIEST_TIMESTAMP + 1 },
    { userId: '123', metrics: ['views'], breakdown: 'planet' },
  ]) {
    const res = await adapter.execute(req('threads.account.insights', input), noop);
    assert.equal(res.ok, false, JSON.stringify(input));
  }
  assert.equal(calls.length, antes);
});

test('Threads: solo lectura (sin acciones de publicar/responder) y sin token falla cerrado', async () => {
  const { impl, calls } = fakeFetch(() => json({}));
  const adapter = new ThreadsInsightsAdapter({ fetchImpl: impl, tokenProvider: async () => undefined });
  assert.deepEqual(adapter.capabilities, ['threads.account.profile', 'threads.account.insights']);
  const publish = await adapter.execute(req('threads.post.publish', { text: 'hola' }), noop);
  assert.equal(publish.ok, false);
  const sinToken = await adapter.execute(req('threads.account.profile'), noop);
  assert.equal(sinToken.ok, false);
  assert.match(sinToken.error ?? '', /not authenticated/);
  assert.equal(calls.length, 0);
});

test('Threads: errores de red o de API nunca filtran el token', async () => {
  const net = new ThreadsInsightsAdapter({ accessToken: TOKEN, fetchImpl: (async (u: string | URL) => { throw new Error(`fetch failed for ${String(u)}`); }) as typeof fetch });
  const r1 = await net.execute(req('threads.account.profile'), noop);
  assert.equal(r1.ok, false);
  assert.equal(JSON.stringify(r1).includes(TOKEN), false);

  const api = new ThreadsInsightsAdapter({ accessToken: TOKEN, fetchImpl: (async () => json({ error: { message: `Invalid OAuth access_token=${TOKEN} expired`, code: 190 } }, 400)) as typeof fetch });
  const r2 = await api.execute(req('threads.account.profile'), noop);
  assert.equal(r2.ok, false);
  assert.match(r2.error ?? '', /code 190/);
  assert.equal(JSON.stringify(r2).includes(TOKEN), false);
  assert.throws(() => new ThreadsInsightsAdapter({ graphBase: 'http://graph.threads.com' }), /https/);
});

/* --------------------------------- Registro: Threads, ámbito, capa local --------------------------------- */

test('registro: Threads se reconoce, el ámbito sale de las etiquetas y la URL limpia no altera la original', () => {
  const library = parseFounderReferenceLibrary(JSON.parse(readFileSync(new URL('../config/founder-reference-library.json', import.meta.url), 'utf8')));
  const registry = buildFounderSocialSourceRegistry(library);
  const threads = registry.sources.find((s) => s.platform === 'threads')!;
  assert.equal(threads.publicHandle, 'la_tribuna_virtual');
  assert.equal(threads.sourceUrl, 'https://www.threads.com/@la_tribuna_virtual?igshid=NTc4MTIwNjQ2YQ==');
  assert.equal(threads.cleanUrl, 'https://www.threads.com/@la_tribuna_virtual');
  assert.equal(threads.scope, 'business');
  assert.deepEqual(threads.permittedReadActions, ['threads.account.profile', 'threads.account.insights']);
  assert.equal(registry.policy.publishingAllowed, false);

  const fb = registry.sources.filter((s) => s.platform === 'facebook');
  assert.ok(fb.length >= 5);
  assert.ok(fb.every((s) => s.canonicalTarget === null && s.bindingState === 'canonical_target_unresolved'));
  assert.equal(fb.find((s) => s.shareToken === '1C3ja3pvM7')?.cleanUrl, 'https://www.facebook.com/share/1C3ja3pvM7/');
  // Instagram: las tres cuentas ya estaban registradas; no se duplican.
  const ig = registry.sources.filter((s) => s.platform === 'instagram').map((s) => s.publicHandle).sort();
  assert.deepEqual(ig, ['infinityseedgroup', 'jean_echandia', 'la_tribuna_virtual']);
  assert.equal(cleanSocialUrl('https://www.instagram.com/x?stkn=a&psln=b&utm_source=qr&k=1#h'), 'https://www.instagram.com/x?k=1');
});

test('el repositorio público NO contiene la referencia personal; la capa local la añade sin colisiones', () => {
  const publicRaw = readFileSync(new URL('../config/founder-reference-library.json', import.meta.url), 'utf8');
  assert.equal(publicRaw.includes('1FEMENbNiD'), false);

  const base = parseFounderReferenceLibrary(JSON.parse(publicRaw));
  const overlay = parseFounderReferenceLibrary({
    schemaVersion: 1, ownerPrincipalId: base.ownerPrincipalId, updatedAt: '2026-10-23T00:00:00.000Z',
    records: [{ id: 'social-facebook-share-1FEMENbNiD', subject: 'founder-reference:social:facebook:1FEMENbNiD', kind: 'reference', classification: 'current', label: 'Facebook — personal del Founder', value: 'https://www.facebook.com/share/1FEMENbNiD/?mibextid=wwXIfr', retention: 'preserve', tags: ['social', 'facebook', 'scope:personal'] }],
  });
  const merged = mergeFounderReferenceLibraries(base, overlay);
  assert.equal(merged.records.length, base.records.length + 1);
  const personal = buildFounderSocialSourceRegistry(merged).sources.find((s) => s.shareToken === '1FEMENbNiD')!;
  assert.equal(personal.scope, 'personal');

  assert.throws(() => mergeFounderReferenceLibraries(base, { ...overlay, ownerPrincipalId: 'otro' }), /different owner/);
  assert.throws(() => mergeFounderReferenceLibraries(base, { ...overlay, records: [base.records[0]!] }), /Duplicate/);
});

test('vinculación admite Threads pero no mezcla plataformas; el hub acepta el canal', () => {
  const ok = validateFounderSocialIdentityBinding({ referenceId: 'social-threads-la-tribuna-virtual', platform: 'threads', sourceUrl: 'https://www.threads.com/@la_tribuna_virtual', graphEntityId: '1234567', evidenceRefs: ['threads.account.profile:2026-10-23'], verifiedAt: '2026-10-23T00:00:00.000Z', verifiedBy: 'founder' });
  assert.equal(ok.state, 'graph_bound');
  assert.throws(() => validateFounderSocialIdentityBinding({ referenceId: 'x', platform: 'threads', sourceUrl: 'https://www.instagram.com/x', graphEntityId: '1', evidenceRefs: ['e'], verifiedAt: '2026-10-23T00:00:00.000Z', verifiedBy: 'founder' }), /sourceUrl does not match/);
  const snap = createSocialChannelSnapshot({ id: 'c1', platform: 'threads', channelId: '1234567', verifiedAt: '2026-10-23T00:00:00.000Z', source: 'threads-graph-api', metrics: { views: 1 }, monetizationState: 'unknown' });
  assert.equal(snap.platform, 'threads');
});

/* ------------------------------------- Plan, lectura y alertas ------------------------------------- */

const src = (over: Partial<WatchSourceInput> & { referenceId: string; platform: WatchSourceInput['platform'] }): WatchSourceInput => ({ label: over.referenceId, scope: 'business', cleanUrl: 'https://x.example/', ...over });
const ENV_FULL = { adapters: new Set(['meta-insights', 'threads-insights']), credentials: { meta: true, threads: true } };

test('plan: cada cuenta dice honestamente qué le falta', () => {
  const plan = Object.fromEntries(planSocialWatch([
    src({ referenceId: 'fb-personal', platform: 'facebook', scope: 'personal' }),
    src({ referenceId: 'fb-share', platform: 'facebook' }),
    src({ referenceId: 'fb-ok', platform: 'facebook', currentBinding: { canonicalTargetUrl: 'https://www.facebook.com/x', graphEntityId: '99' } }),
    src({ referenceId: 'ig-unbound', platform: 'instagram' }),
    src({ referenceId: 'ig-ok', platform: 'instagram', currentBinding: { graphEntityId: '17841' } }),
    src({ referenceId: 'th-ok', platform: 'threads', currentBinding: { graphEntityId: '1234567' } }),
  ], { ...ENV_FULL, metrics: { instagram: ['reach'] } }).map((p) => [p.referenceId, p]));

  assert.equal(plan['fb-personal']!.readiness, 'manual_only');
  assert.equal(plan['fb-share']!.readiness, 'needs_canonical_target');
  assert.equal(plan['fb-ok']!.readiness, 'needs_metrics');
  assert.equal(plan['ig-unbound']!.readiness, 'needs_graph_binding');
  assert.match(plan['ig-unbound']!.nextStep, /profesional/);
  assert.equal(plan['ig-ok']!.readiness, 'ready');
  assert.deepEqual(plan['ig-ok']!.input, { entityId: '17841', metrics: ['reach'] });
  assert.equal(plan['th-ok']!.readiness, 'ready');
  assert.equal(plan['th-ok']!.action, 'threads.account.insights');
  assert.deepEqual(plan['th-ok']!.input!.userId, '1234567');
});

test('plan: sin credencial o sin adaptador no hay lectura', () => {
  const sources = [src({ referenceId: 'ig', platform: 'instagram', currentBinding: { graphEntityId: '1' } }), src({ referenceId: 'th', platform: 'threads', currentBinding: { graphEntityId: '1' } })];
  const sinCred = planSocialWatch(sources, { adapters: ENV_FULL.adapters, credentials: { meta: false, threads: false } });
  assert.deepEqual(sinCred.map((p) => p.readiness), ['needs_auth', 'needs_auth']);
  const sinAdaptador = planSocialWatch(sources, { adapters: new Set(['threads-insights']), credentials: { meta: true, threads: true } });
  assert.deepEqual(sinAdaptador.map((p) => p.readiness), ['adapter_missing', 'ready']);
});

test('aplanado de insights: total_value, último valor de una serie, desgloses ignorados', () => {
  assert.deepEqual(flattenInsights([
    { name: 'views', total_value: { value: 120 } },
    { name: 'reach', values: [{ value: 5, end_time: 'a' }, { value: 9, end_time: 'b' }] },
    { name: 'follower_demographics', total_value: { breakdowns: [] } },
    { name: 'raro', values: [{ value: 'x' }] },
    { values: [{ value: 1 }] },
  ]), { views: 120, reach: 9 });
  assert.deepEqual(flattenInsights('nada'), {});
});

test('diferencias: alerta por caídas y subidas fuertes, con base mínima y seguidores más sensibles', () => {
  const changes = diffMetrics({ views: 1000, likes: 100, followers_count: 1000, replies: 2, reposts: 50 }, { views: 500, likes: 95, followers_count: 940, replies: 0, reposts: 130 });
  const by = Object.fromEntries(changes.map((c) => [c.metric, c]));
  assert.equal(by.views!.flag, 'caida');
  assert.equal(by.likes!.flag, null);
  assert.equal(by.followers_count!.flag, 'caida');
  assert.equal(by.replies!.flag, null);
  assert.equal(by.reposts!.flag, 'subida');
  assert.deepEqual(diffMetrics(undefined, { views: 1 }), []);
});

test('lectura de punta a punta: primera foto sin alertas, segunda foto con alerta; lo no listo se omite con motivo', async () => {
  const store = new Map<string, StoredWatchSnapshot>();
  let views = 1000;
  const executed: ToolRequest[] = [];
  const tools: Pick<ToolGateway, 'execute'> = {
    execute: async (r: ToolRequest): Promise<ToolResult> => {
      executed.push(r);
      if (r.tool === 'meta-insights') return { ok: false, error: 'Meta Graph API 400 code 100: bad metric' };
      return { ok: true, output: { data: [{ name: 'views', total_value: { value: views } }, { name: 'followers_count', total_value: { value: 2000 } }] } };
    },
  };
  const sources = [
    src({ referenceId: 'th', platform: 'threads', label: 'Threads — La Tribuna', currentBinding: { graphEntityId: '1234567' } }),
    src({ referenceId: 'ig', platform: 'instagram', label: 'Instagram — Infinity', currentBinding: { graphEntityId: '17841' } }),
    src({ referenceId: 'fb', platform: 'facebook', label: 'Facebook — Infinity' }),
  ];
  const plan = planSocialWatch(sources, { ...ENV_FULL, metrics: { instagram: ['reach'] } });
  const deps = { tools, loadPrevious: (id: string) => store.get(id), save: (s: StoredWatchSnapshot) => { store.set(s.referenceId, s); }, now: () => new Date('2026-10-23T08:00:00Z') };

  const first = await runSocialWatch(plan, deps);
  assert.deepEqual(first.summary, { read: 1, skipped: 1, failed: 1, alerts: 1 });
  const th1 = first.items.find((i) => i.referenceId === 'th')!;
  assert.equal(th1.firstSnapshot, true);
  assert.deepEqual(th1.alerts, []);
  assert.equal(first.items.find((i) => i.referenceId === 'fb')!.status, 'skipped');
  assert.match(first.items.find((i) => i.referenceId === 'fb')!.detail ?? '', /Página concreta/);
  assert.equal(first.items.find((i) => i.referenceId === 'ig')!.status, 'failed');
  assert.equal(store.has('ig'), false, 'una lectura fallida no guarda foto');

  views = 400;
  const second = await runSocialWatch(plan, deps);
  const th2 = second.items.find((i) => i.referenceId === 'th')!;
  assert.match(th2.alerts[0] ?? '', /views cae 60%/);
  assert.ok(executed.every((r) => /insights$/.test(r.action)), 'solo acciones de lectura');
});
