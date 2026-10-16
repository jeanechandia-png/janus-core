import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseWriteAdapter, destructiveSqlReason } from '../packages/adapters/src/supabase-write-adapter.js';
import { VercelReleaseAdapter } from '../packages/adapters/src/vercel-release-adapter.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { SENSITIVE_TOOL_ACTIONS, enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';
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
const noop = async () => {};
const REF = 'abcdefghij0123456789';

test('Supabase write: allowlist, separate token, migration POST, no rows returned', async () => {
  const { impl, calls } = fakeFetch((call) => (call.url.endsWith('/query') ? { status: 201, body: [{ email: 'cliente@x.nl', id: 1 }] } : { body: {} }));
  const adapter = new SupabaseWriteAdapter({ token: 'sbp_w', allowedProjectRefs: [REF], fetchImpl: impl });

  const other = await adapter.execute({ tool: 'supabase-write', action: 'migration.apply', input: { projectRef: 'zzzzzzzzzz0123456789', sql: 'select 1' } }, noop);
  assert.match(String(other.error), /allowlist/);
  assert.equal(calls.length, 0);

  const migration = await adapter.execute({ tool: 'supabase-write', action: 'migration.apply', input: { projectRef: REF, name: 'add_notes', sql: 'create table notes (id int);' } }, noop);
  assert.equal(migration.ok, true);
  assert.equal(calls[0]!.url, `https://api.supabase.com/v1/projects/${REF}/database/migrations`);
  assert.equal(calls[0]!.init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { query: 'create table notes (id int);', name: 'add_notes' });

  const sql = await adapter.execute({ tool: 'supabase-write', action: 'sql.execute', input: { projectRef: REF, sql: 'select email, id from users limit 1' } }, noop);
  assert.equal(sql.ok, true);
  const out = sql.output as { rowCount: number; rowsReturned: boolean; columns: string[] };
  assert.equal(out.rowCount, 1);
  assert.equal(out.rowsReturned, false);
  assert.deepEqual(out.columns, ['email', 'id']);
  assert.ok(!JSON.stringify(sql).includes('cliente@x.nl'));

  assert.equal((await new SupabaseWriteAdapter({ allowedProjectRefs: [REF], fetchImpl: impl }).execute({ tool: 'supabase-write', action: 'sql.execute', input: { projectRef: REF, sql: 'select 1' } }, noop)).ok, false);
  assert.equal((await adapter.execute({ tool: 'supabase-write', action: 'migration.apply', input: { projectRef: REF, name: 'Bad Name!', sql: 'select 1' } }, noop)).ok, false);
});

test('Supabase write: destructive SQL refused unless explicitly approved', async () => {
  assert.ok(destructiveSqlReason('DROP TABLE users'));
  assert.ok(destructiveSqlReason('truncate users'));
  assert.ok(destructiveSqlReason('delete from users'));
  assert.ok(destructiveSqlReason('update users set a = 1'));
  assert.ok(destructiveSqlReason('alter table users drop column a'));
  assert.equal(destructiveSqlReason("delete from users where id = 1; select 'drop table x'"), null);
  assert.equal(destructiveSqlReason('-- drop table x\nselect 1'), null);

  const { impl, calls } = fakeFetch(() => ({ body: {} }));
  const adapter = new SupabaseWriteAdapter({ token: 't', allowedProjectRefs: [REF], fetchImpl: impl });
  const refused = await adapter.execute({ tool: 'supabase-write', action: 'sql.execute', input: { projectRef: REF, sql: 'delete from users' } }, noop);
  assert.match(String(refused.error), /Destructive SQL refused/);
  assert.equal(calls.length, 0);
  const approved = await adapter.execute({ tool: 'supabase-write', action: 'sql.execute', input: { projectRef: REF, sql: 'delete from users', allowDestructive: true } }, noop);
  assert.equal(approved.ok, true);
  assert.equal(calls.length, 1);
});

test('Vercel release: allowlisted project, separate token, redeploy via deploymentId', async () => {
  const { impl, calls } = fakeFetch(() => ({ body: { id: 'dpl_new', readyState: 'QUEUED', url: 'janus-x.vercel.app' } }));
  const adapter = new VercelReleaseAdapter({ token: 'vrel', allowedProjects: ['infinity-iba'], defaultTeamId: 'team_1', fetchImpl: impl });
  const blocked = await adapter.execute({ tool: 'vercel-release', action: 'deployment.redeploy', input: { project: 'other', deploymentId: 'dpl_1' } }, noop);
  assert.match(String(blocked.error), /allowlist/);
  assert.equal(calls.length, 0);
  const done = await adapter.execute({ tool: 'vercel-release', action: 'deployment.redeploy', input: { project: 'infinity-iba', deploymentId: 'dpl_1', target: 'production' } }, noop);
  assert.equal(done.ok, true);
  assert.equal(calls[0]!.url, 'https://api.vercel.com/v13/deployments?forceNew=1&teamId=team_1');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), { name: 'infinity-iba', deploymentId: 'dpl_1', target: 'production' });
  assert.equal((done.output as { newDeploymentId: string }).newDeploymentId, 'dpl_new');
  assert.equal((await new VercelReleaseAdapter({ allowedProjects: ['infinity-iba'], fetchImpl: impl }).execute({ tool: 'vercel-release', action: 'deployment.redeploy', input: { project: 'infinity-iba', deploymentId: 'dpl_1' } }, noop)).ok, false);
});

test('Sensitive policy + gateway: new writes are forced to approval and need an authority permit', async () => {
  for (const key of ['supabase-write.migration.apply', 'supabase-write.sql.execute', 'vercel-release.deployment.redeploy']) assert.ok(SENSITIVE_TOOL_ACTIONS[key], key);
  const plan = {
    steps: [
      { id: 's1', label: 'm', tool: 'supabase-write', action: 'migration.apply', input: {}, risk: 'low', reversible: true, requiresApproval: false },
      { id: 's2', label: 'r', tool: 'vercel-release', action: 'deployment.redeploy', input: {}, risk: 'low', reversible: true, requiresApproval: false },
    ],
  } as unknown as JanusPlan;
  const enforced = enforceSensitiveActionPolicy(plan);
  assert.equal(enforced.enforced.length, 2);
  assert.ok(enforced.plan.steps.every((step) => step.risk === 'high' && step.requiresApproval && step.reversible === false));

  const { impl, calls } = fakeFetch(() => ({ body: {} }));
  const gateway = new DefaultToolGateway();
  gateway.register(new SupabaseWriteAdapter({ token: 't', allowedProjectRefs: [REF], fetchImpl: impl }));
  const noPermit = await gateway.execute({ tool: 'supabase-write', action: 'migration.apply', input: { projectRef: REF, sql: 'select 1' }, idempotencyKey: 'k1' }, noop);
  assert.equal(noPermit.ok, false);
  assert.match(String(noPermit.error), /authority permit/);
  const noKey = await gateway.execute({ tool: 'supabase-write', action: 'sql.execute', input: { projectRef: REF, sql: 'select 1' } }, noop);
  assert.match(String(noKey.error), /idempotency key/);
  assert.equal(calls.length, 0);
});
