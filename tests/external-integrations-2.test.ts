import assert from 'node:assert/strict';
import test from 'node:test';
import { PerplexityAdapter } from '../packages/adapters/src/perplexity-adapter.js';
import { KlingAdapter } from '../packages/adapters/src/kling-adapter.js';
import { N8nAdapter, parseN8nWebhooks } from '../packages/adapters/src/n8n-adapter.js';
import { GoogleWorkspaceWriteAdapter, buildRfc2822 } from '../packages/adapters/src/google-workspace-write-adapter.js';
import { resolveModelProviders } from '../packages/core/src/model-provider-config.js';
import { SENSITIVE_TOOL_ACTIONS } from '../packages/orchestrator/src/sensitive-action-policy.js';

type Call = { url: string; init: RequestInit };
function fakeFetch(responder: (call: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const { status = 200, body } = responder(call);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}
const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);
const noop = async () => {};

test('Perplexity: Agent API with preset, answer + citations + sources + cost, web content flagged as data', async () => {
  const { impl, calls } = fakeFetch(() => ({ body: {
    status: 'completed', model: 'perplexity/x',
    output: [
      { type: 'search_results', results: [{ id: 1, url: 'https://ec.europa.eu/ai-act', title: 'AI Act', snippet: 'x', date: '2026-09-01' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Respuesta [1]', annotations: [{ url: 'https://ec.europa.eu/ai-act', title: 'AI Act', start_index: 0, end_index: 3 }] }] },
    ],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30, cost: { currency: 'USD', input_cost: 0.001, output_cost: 0.002, total_cost: 0.003 } },
  } }));
  const tool = new PerplexityAdapter({ token: 'pplx', fetchImpl: impl });
  const result = await tool.execute({ tool: 'perplexity', action: 'research.ask', input: { question: '¿Qué exige hoy la AI Act a los chatbots?' } }, noop);
  assert.equal(calls[0]!.url, 'https://api.perplexity.ai/v1/agent');
  assert.equal(header(calls[0]!, 'authorization'), 'Bearer pplx');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { input: '¿Qué exige hoy la AI Act a los chatbots?', preset: 'fast' });
  const output = result.output as { answer: string; citations: unknown[]; sources: unknown[]; costUsd: number; trust: string };
  assert.equal(output.answer, 'Respuesta [1]');
  assert.equal(output.citations.length, 1);
  assert.equal(output.sources.length, 1);
  assert.equal(output.costUsd, 0.003);
  assert.match(output.trust, /no instrucciones/);
  assert.equal((await tool.execute({ tool: 'perplexity', action: 'research.ask', input: { question: '' } }, noop)).ok, false);
});

test('Perplexity also available as OpenAI-compatible model provider only with key + model', () => {
  assert.deepEqual(resolveModelProviders({ PERPLEXITY_API_KEY: 'k' }).map((p) => p.id), []);
  const [provider] = resolveModelProviders({ PERPLEXITY_API_KEY: 'k', JANUS_PERPLEXITY_MODEL: 'perplexity/model' });
  assert.equal(provider!.baseUrl + provider!.chatPath, 'https://api.perplexity.ai/router/v1/chat/completions');
});

test('Kling: API-key Bearer, model version in path, settings, task polling with video outputs', async () => {
  const { impl, calls } = fakeFetch((call) => call.url.includes('/tasks')
    ? { body: { code: 0, data: [{ id: 'T123', status: 'succeeded', outputs: [{ type: 'video', url: 'https://cdn/k.mp4', watermark_url: 'https://cdn/k-wm.mp4', duration: 5 }] }] } }
    : { body: { code: 0, message: 'SUCCEED', data: { id: 'T123', status: 'submitted' } } });
  const kling = new KlingAdapter({ token: 'kl', fetchImpl: impl });
  const created = await kling.execute({ tool: 'kling', action: 'video.create', input: { prompt: 'Dron sobre Huissen al atardecer', duration: 5, aspectRatio: '9:16', resolution: '1080P' } }, noop);
  assert.equal(created.ok, true);
  assert.equal(calls[0]!.url, 'https://api-singapore.klingai.com/text-to-video/kling-3.0');
  assert.equal(header(calls[0]!, 'authorization'), 'Bearer kl');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { prompt: 'Dron sobre Huissen al atardecer', settings: { duration: 5, aspect_ratio: '9:16', resolution: '1080p' } });
  const task = await kling.execute({ tool: 'kling', action: 'task.get', input: { taskId: 'T123' } }, noop);
  assert.equal(calls[1]!.url, 'https://api-singapore.klingai.com/tasks?task_ids=T123');
  assert.deepEqual((task.output as { videos: unknown[] }).videos, [{ url: 'https://cdn/k.mp4', watermarkUrl: 'https://cdn/k-wm.mp4', duration: 5 }]);
  const failing = new KlingAdapter({ token: 'kl', fetchImpl: fakeFetch(() => ({ body: { code: 1201, message: 'balance' } })).impl });
  assert.match(String((await failing.execute({ tool: 'kling', action: 'video.create', input: { prompt: 'x' } }, noop)).error), /Kling error 1201/);
  assert.equal((await kling.execute({ tool: 'kling', action: 'video.create', input: { prompt: 'x', model: '../../admin' } }, noop)).ok, true);
  assert.equal(calls[calls.length - 1]!.url, 'https://api-singapore.klingai.com/text-to-video/kling-3.0');
});

test('n8n: API key header, pagination, and triggers ONLY allowlisted https webhooks', async () => {
  const { impl, calls } = fakeFetch((call) => call.url.includes('/hooks/')
    ? { body: { received: true } }
    : { body: { data: [{ id: 'w1', name: 'Leads IBA', active: true }], nextCursor: 'abc' } });
  const n8n = new N8nAdapter({ baseUrl: 'https://n8n.infinityseed.group', token: 'n8nkey', webhooks: { leads: 'https://n8n.infinityseed.group/webhook/hooks/leads' }, fetchImpl: impl });
  const list = await n8n.execute({ tool: 'n8n', action: 'workflows.list', input: { active: true, limit: 999 } }, noop);
  assert.equal(calls[0]!.url, 'https://n8n.infinityseed.group/api/v1/workflows?limit=250&active=true');
  assert.equal(header(calls[0]!, 'x-n8n-api-key'), 'n8nkey');
  assert.equal((list.output as { nextCursor: string }).nextCursor, 'abc');
  const fired = await n8n.execute({ tool: 'n8n', action: 'workflow.trigger', input: { webhook: 'leads', payload: { name: 'Robin' } } }, noop);
  assert.equal(fired.ok, true);
  assert.equal(header(calls[1]!, 'x-n8n-api-key'), null);
  assert.equal((await n8n.execute({ tool: 'n8n', action: 'workflow.trigger', input: { webhook: 'https://evil.example/x' } }, noop)).ok, false);
  assert.throws(() => parseN8nWebhooks('{"x":"http://insecure"}'), /https/);
  assert.deepEqual(parseN8nWebhooks(undefined), {});
  assert.match(String((await new N8nAdapter({ token: 'k', fetchImpl: impl }).execute({ tool: 'n8n', action: 'workflows.list', input: {} }, noop)).error), /N8N_BASE_URL/);
});

test('Google write: Gmail DRAFT only (never sends), Calendar event with no guest e-mails by default', async () => {
  const { impl, calls } = fakeFetch((call) => call.url.includes('gmail') ? { body: { id: 'r-1' } } : { body: { id: 'ev1', htmlLink: 'https://calendar.google.com/ev1' } });
  const google = new GoogleWorkspaceWriteAdapter({ token: 'gw', fetchImpl: impl });
  const draft = await google.execute({ tool: 'google-workspace-write', action: 'gmail.draft.create', input: { to: 'contact@infinityseed.group', subject: 'Propuesta ChatBox — Ñandú', body: 'Hola,\nadjunto…' } }, noop);
  assert.equal(draft.ok, true);
  assert.equal(calls[0]!.url, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts');
  const raw = Buffer.from(JSON.parse(String(calls[0]!.init.body)).message.raw, 'base64url').toString('utf8');
  assert.match(raw, /^To: contact@infinityseed\.group\r\nSubject: =\?UTF-8\?B\?/);
  assert.equal((draft.output as { sent: boolean }).sent, false);
  assert.equal(calls.some((call) => call.url.includes('/send')), false);
  assert.equal((await google.execute({ tool: 'google-workspace-write', action: 'gmail.draft.create', input: { to: 'x@y.z\r\nBcc: spy@evil.com', subject: 's', body: 'b' } }, noop)).ok, false);
  assert.doesNotMatch(buildRfc2822({ to: ['a@b.cd'], subject: 'Hola\r\nBcc: spy@evil.com', body: 'x' }), /\r\nBcc:/);
  const event = await google.execute({ tool: 'google-workspace-write', action: 'calendar.event.create', input: { summary: 'Reunión Robin', start: '2026-10-20T10:00:00', end: '2026-10-20T11:00:00', attendees: ['robin@example.nl'] } }, noop);
  assert.equal(event.ok, true);
  assert.equal(calls[1]!.url, 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none');
  assert.equal(JSON.parse(String(calls[1]!.init.body)).start.timeZone, 'Europe/Amsterdam');
  assert.equal((await google.execute({ tool: 'google-workspace-write', action: 'calendar.event.create', input: { summary: 's', start: '2026-10-20T11:00:00', end: '2026-10-20T10:00:00' } }, noop)).ok, false);
});

test('every new external write / paid generation is on the sensitive-action list', () => {
  for (const operation of ['kling.video.create', 'n8n.workflow.trigger', 'google-workspace-write.gmail.draft.create', 'google-workspace-write.calendar.event.create', 'runway.video.create', 'asana.task.create']) {
    assert.ok(SENSITIVE_TOOL_ACTIONS[operation], operation);
  }
  assert.equal(SENSITIVE_TOOL_ACTIONS['perplexity.research.ask'], undefined);
});
