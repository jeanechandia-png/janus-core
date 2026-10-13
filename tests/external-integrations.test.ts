import assert from 'node:assert/strict';
import test from 'node:test';
import { AnthropicMessagesModelAdapter } from '../packages/adapters/src/anthropic-messages-model-adapter.js';
import { ChatCompletionsModelAdapter } from '../packages/adapters/src/chat-completions-model-adapter.js';
import { AsanaAdapter } from '../packages/adapters/src/asana-adapter.js';
import { VercelAdapter } from '../packages/adapters/src/vercel-adapter.js';
import { RunwayAdapter } from '../packages/adapters/src/runway-adapter.js';
import { FallbackModelRouter } from '../packages/gateways/src/model-router.js';
import { BudgetedModelGateway, ModelBudgetExceededError } from '../packages/gateways/src/budgeted-model-gateway.js';
import { describeModelProviders, resolveModelProviders } from '../packages/core/src/model-provider-config.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';
import type { JanusPlan } from '../packages/orchestrator/src/plan.js';

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

test('providers: only fully configured ones are enabled, local/custom first, order override, no secrets exposed', () => {
  const env = {
    JANUS_MODEL_BASE_URL: 'http://127.0.0.1:8080', JANUS_MODEL_NAME: 'local-llm',
    JANUS_OPENAI_API_KEY: 'sk-x', JANUS_OPENAI_MODEL: 'gpt-model',
    JANUS_ANTHROPIC_API_KEY: 'ant-x', // model missing -> disabled
    JANUS_GEMINI_API_KEY: 'g-x', JANUS_GEMINI_MODEL: 'gemini-model',
  };
  assert.deepEqual(resolveModelProviders(env).map((p) => p.id), ['custom', 'openai', 'gemini']);
  assert.deepEqual(resolveModelProviders({ ...env, JANUS_MODEL_ORDER: 'gemini, openai' }).map((p) => p.id), ['gemini', 'openai', 'custom']);
  const gemini = resolveModelProviders(env).find((p) => p.id === 'gemini')!;
  assert.equal(gemini.baseUrl + gemini.chatPath, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  const described = describeModelProviders(env);
  assert.deepEqual(described.find((p) => p.id === 'anthropic')?.missing, ['JANUS_ANTHROPIC_MODEL']);
  assert.equal(JSON.stringify(described).includes('ant-x') || JSON.stringify(described).includes('sk-x'), false);
});

test('Claude adapter: native Messages API headers/body, system split, JSON instruction, usage', async () => {
  const { impl, calls } = fakeFetch(() => ({ body: { model: 'claude-x', content: [{ type: 'text', text: '{"ok":true}' }], usage: { input_tokens: 12, output_tokens: 4 } } }));
  const adapter = new AnthropicMessagesModelAdapter({ model: 'claude-x', apiKey: 'ant-key', fetchImpl: impl });
  const response = await adapter.complete({ messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'U1' }, { role: 'user', content: 'U2' }], responseFormat: 'json' });
  assert.equal(calls[0]!.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(header(calls[0]!, 'x-api-key'), 'ant-key');
  assert.equal(header(calls[0]!, 'anthropic-version'), '2023-06-01');
  const body = JSON.parse(String(calls[0]!.init.body));
  assert.equal(body.system, 'S');
  assert.equal(body.messages.length, 1);
  assert.match(body.messages[0].content, /U1\n\nU2\n\nRespond with a single valid JSON object only\./);
  assert.equal(response.text, '{"ok":true}');
  assert.deepEqual(response.usage, { input_tokens: 12, output_tokens: 4 });
  await assert.rejects(new AnthropicMessagesModelAdapter({ model: 'm', fetchImpl: impl }).complete({ messages: [] }), /not authenticated/);
});

test('Gemini via OpenAI-compatible path; router falls back across providers but never around the effort budget', async () => {
  const gemini = fakeFetch(() => ({ body: { model: 'gemini-model', choices: [{ message: { content: 'hola' } }] } }));
  const adapter = new ChatCompletionsModelAdapter({ baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chatPath: '/chat/completions', model: 'gemini-model', apiKey: 'g', fetchImpl: gemini.impl });
  const down = { complete: async () => { throw new Error('openai 503'); } };
  const router = new FallbackModelRouter([{ id: 'openai', gateway: down }, { id: 'gemini', gateway: adapter }]);
  const response = await router.complete({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(gemini.calls[0]!.url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  assert.equal(response.text, 'hola');
  assert.deepEqual(router.lastAttempts().map((a) => [a.provider, a.ok]), [['openai', false], ['gemini', true]]);
  const budgetFirst = new FallbackModelRouter([{ id: 'a', gateway: new BudgetedModelGateway(adapter, 0) }, { id: 'b', gateway: adapter }]);
  await assert.rejects(budgetFirst.complete({ messages: [] }), ModelBudgetExceededError);
  await assert.rejects(new FallbackModelRouter([{ id: 'x', gateway: down }]).complete({ messages: [] }), /All model providers failed — x: openai 503/);
});

test('Asana: reads with Bearer PAT, validates gids, create posts {data} and returns the permalink', async () => {
  const { impl, calls } = fakeFetch((call) => call.init.method === 'POST'
    ? { status: 201, body: { data: { gid: '42', name: 'Llamar a Robin', permalink_url: 'https://app.asana.com/0/1/42' } } }
    : { body: { data: [{ gid: '7', name: 'Tarea', completed: false, due_on: '2026-10-20', assignee: { name: 'Jean' }, projects: [{ name: 'Janus' }] }] } });
  const asana = new AsanaAdapter({ token: 'pat', fetchImpl: impl });
  const list = await asana.execute({ tool: 'asana', action: 'tasks.list', input: { project: '1209' } }, noop);
  assert.equal(list.ok, true);
  assert.match(calls[0]!.url, /^https:\/\/app\.asana\.com\/api\/1\.0\/tasks\?project=1209&limit=50&completed_since=now&opt_fields=/);
  assert.equal(header(calls[0]!, 'authorization'), 'Bearer pat');
  assert.equal((list.output as { tasks: Array<{ assignee: string }> }).tasks[0]!.assignee, 'Jean');
  assert.equal((await asana.execute({ tool: 'asana', action: 'tasks.list', input: { project: '../x' } }, noop)).ok, false);
  const created = await asana.execute({ tool: 'asana', action: 'task.create', input: { name: 'Llamar a Robin', project: '1209', dueOn: '2026-10-20' } }, noop);
  assert.equal(created.ok, true);
  assert.deepEqual(JSON.parse(String(calls[1]!.init.body)), { data: { name: 'Llamar a Robin', projects: ['1209'], due_on: '2026-10-20' } });
  assert.equal(created.externalReference, 'https://app.asana.com/0/1/42');
  assert.equal((await new AsanaAdapter({ fetchImpl: impl }).execute({ tool: 'asana', action: 'workspaces.list', input: {} }, noop)).ok, false);
});

test('Vercel: read-only list/get with team scope; no write actions exist', async () => {
  const { impl, calls } = fakeFetch((call) => call.url.includes('/v13/')
    ? { body: { id: 'dpl_1', name: 'iba', url: 'iba.vercel.app', readyState: 'READY', target: 'production', alias: ['infinitybusinessassistant.nl'], gitSource: { sha: 'abc', ref: 'main' } } }
    : { body: { deployments: [{ uid: 'dpl_1', name: 'iba', url: 'iba.vercel.app', state: 'READY', target: 'production', createdAt: 1 }], pagination: {} } });
  const vercel = new VercelAdapter({ token: 'v', defaultTeamId: 'team_1', fetchImpl: impl });
  const list = await vercel.execute({ tool: 'vercel', action: 'deployments.list', input: { projectId: 'prj_1', target: 'production', limit: 99 } }, noop);
  assert.equal(list.ok, true);
  assert.equal(calls[0]!.url, 'https://api.vercel.com/v7/deployments?projectId=prj_1&target=production&limit=20&teamId=team_1');
  const one = await vercel.execute({ tool: 'vercel', action: 'deployment.get', input: { idOrUrl: 'dpl_1' } }, noop);
  assert.equal((one.output as { commitSha: string }).commitSha, 'abc');
  assert.deepEqual(vercel.capabilities, ['deployments.list', 'deployment.get']);
  assert.equal((await vercel.execute({ tool: 'vercel', action: 'deployment.promote', input: {} }, noop)).ok, false);
});

test('Runway: version header, credit balance, task status, generation returns task id and estimated credits', async () => {
  const { impl, calls } = fakeFetch((call) => {
    if (call.url.endsWith('/v1/organization')) return { body: { creditBalance: 1250, tier: {}, usage: {} } };
    if (call.url.includes('/v1/tasks/')) return { body: { id: 'a1b2c3d4-0000', status: 'SUCCEEDED', output: ['https://cdn/x.mp4'] } };
    return { body: { id: 'a1b2c3d4-1111', estimatedCost: { credits: 40 } } };
  });
  const runway = new RunwayAdapter({ token: 'rw', fetchImpl: impl });
  const org = await runway.execute({ tool: 'runway', action: 'organization.read', input: {} }, noop);
  assert.equal((org.output as { creditBalance: number }).creditBalance, 1250);
  assert.equal(header(calls[0]!, 'x-runway-version'), '2024-11-06');
  assert.equal(header(calls[0]!, 'authorization'), 'Bearer rw');
  const task = await runway.execute({ tool: 'runway', action: 'task.get', input: { taskId: 'a1b2c3d4-0000' } }, noop);
  assert.deepEqual((task.output as { output: string[] }).output, ['https://cdn/x.mp4']);
  const video = await runway.execute({ tool: 'runway', action: 'video.create', input: { model: 'gen4_turbo', promptImage: 'https://img/x.png', ratio: '1280:720', duration: 5, promptText: 'dron sobre Arnhem' } }, noop);
  assert.equal(video.ok, true);
  assert.equal(calls[2]!.url, 'https://api.dev.runwayml.com/v1/image_to_video');
  assert.deepEqual(JSON.parse(String(calls[2]!.init.body)), { model: 'gen4_turbo', promptImage: 'https://img/x.png', promptText: 'dron sobre Arnhem', ratio: '1280:720', duration: 5 });
  assert.equal((video.output as { estimatedCredits: number }).estimatedCredits, 40);
  assert.equal((await runway.execute({ tool: 'runway', action: 'video.create', input: { model: 'gen4_turbo', promptImage: 'http://insecure/x.png' } }, noop)).ok, false);
  assert.equal((await runway.execute({ tool: 'runway', action: 'image.create', input: { model: 'gen4_image', promptText: 'x' } }, noop)).ok, false);
});

test('sensitive actions are forced to explicit approval even if the planner marked them low risk', () => {
  const plan = {
    goal: 'g', source: 'model',
    steps: [
      { id: 's1', kind: 'tool', label: 'Leer', tool: 'asana', action: 'tasks.list', input: {}, risk: 'none', reversible: true, requiresApproval: false },
      { id: 's2', kind: 'tool', label: 'Generar', tool: 'runway', action: 'video.create', input: {}, risk: 'low', reversible: true, requiresApproval: false },
      { id: 's3', kind: 'tool', label: 'Crear', tool: 'asana', action: 'task.create', input: {}, risk: 'low', reversible: true, requiresApproval: false },
    ],
  } as unknown as JanusPlan;
  const { plan: guarded, enforced } = enforceSensitiveActionPolicy(plan);
  assert.deepEqual(enforced.map((item) => item.operation), ['runway.video.create', 'asana.task.create']);
  assert.equal(guarded.steps[0]!.requiresApproval, false);
  for (const step of guarded.steps.slice(1)) {
    assert.equal(step.requiresApproval, true);
    assert.equal(step.risk, 'high');
    assert.equal(step.reversible, false);
  }
});
