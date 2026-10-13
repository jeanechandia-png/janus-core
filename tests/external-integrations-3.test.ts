import assert from 'node:assert/strict';
import test from 'node:test';
import { NetlifyDeployAdapter } from '../packages/adapters/src/netlify-deploy-adapter.js';
import { NetlifyReleaseAdapter } from '../packages/adapters/src/netlify-release-adapter.js';
import { SupabaseManagementAdapter } from '../packages/adapters/src/supabase-management-adapter.js';
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
const noop = async () => {};
const SITE = '334784f0-2fee-47a6-bd70-150fc28238fc';

test('Netlify read: original published-deploy check unchanged; new sites/deploys reads are GET-only', async () => {
  const { impl, calls } = fakeFetch((call) => {
    if (call.url.endsWith(`/sites/${SITE}`)) return { body: { id: SITE, published_deploy: { id: 'd1', state: 'ready', branch: 'release/rc25', commit_ref: 'a'.repeat(40) } } };
    if (call.url.includes('/sites?')) return { body: [{ id: SITE, name: 'infinity-chatbox', ssl_url: 'https://infinity-chatbox.netlify.app', custom_domain: 'infinitychatbox.nl', published_deploy: { id: 'd1' } }] };
    if (call.url.includes('/deploys?')) return { body: [{ id: 'd1', state: 'ready', context: 'production', commit_ref: null, title: 'release', created_at: '2026-10-12T23:59:00Z' }] };
    return { body: { id: 'd1', state: 'error', error_message: 'Build failed' } };
  });
  const netlify = new NetlifyDeployAdapter({ token: 'n', fetchImpl: impl });
  const published = await netlify.execute({ tool: 'netlify', action: 'site.published_deploy', input: { siteId: SITE } }, noop);
  assert.equal((published.output as { commitSha: string }).commitSha, 'a'.repeat(40));
  const sites = await netlify.execute({ tool: 'netlify', action: 'sites.list', input: {} }, noop);
  assert.equal((sites.output as { sites: Array<{ customDomain: string }> }).sites[0]!.customDomain, 'infinitychatbox.nl');
  const deploys = await netlify.execute({ tool: 'netlify', action: 'deploys.list', input: { siteId: SITE, perPage: 500 } }, noop);
  assert.equal(calls[2]!.url, `https://api.netlify.com/api/v1/sites/${SITE}/deploys?page=1&per_page=100`);
  assert.equal((deploys.output as { deploys: Array<{ commitSha: null }> }).deploys[0]!.commitSha, null);
  const one = await netlify.execute({ tool: 'netlify', action: 'deploy.get', input: { siteId: SITE, deployId: 'd1' } }, noop);
  assert.equal((one.output as { errorMessage: string }).errorMessage, 'Build failed');
  assert.ok(calls.every((call) => (call.init.method ?? 'GET') === 'GET'));
  assert.equal((await netlify.execute({ tool: 'netlify', action: 'deploy.restore', input: {} }, noop)).ok, false);
});

test('Netlify release: only allowlisted sites, separate token, POST restore, and approval-gated', async () => {
  const { impl, calls } = fakeFetch(() => ({ body: { id: 'd0', state: 'ready', commit_ref: 'b'.repeat(40) } }));
  const release = new NetlifyReleaseAdapter({ token: 'rel', allowedSiteIds: [SITE], fetchImpl: impl });
  const blocked = await release.execute({ tool: 'netlify-release', action: 'deploy.restore', input: { siteId: 'other-site', deployId: 'd0' } }, noop);
  assert.match(String(blocked.error), /allowlist/);
  assert.equal(calls.length, 0);
  const restored = await release.execute({ tool: 'netlify-release', action: 'deploy.restore', input: { siteId: SITE, deployId: 'd0' } }, noop);
  assert.equal(restored.ok, true);
  assert.equal(calls[0]!.url, `https://api.netlify.com/api/v1/sites/${SITE}/deploys/d0/restore`);
  assert.equal(calls[0]!.init.method, 'POST');
  assert.ok(SENSITIVE_TOOL_ACTIONS['netlify-release.deploy.restore']);
  assert.equal((await new NetlifyReleaseAdapter({ allowedSiteIds: [SITE], fetchImpl: impl }).execute({ tool: 'netlify-release', action: 'deploy.restore', input: { siteId: SITE, deployId: 'd0' } }, noop)).ok, false);
});

test('Supabase: read-only health/advisors/migrations; never SQL, never table data', async () => {
  const REF = 'abcdefghijklmnopqrst';
  const { impl, calls } = fakeFetch((call) => {
    if (call.url.endsWith('/v1/projects')) return { body: [{ id: REF, name: 'infinity-chatbox', region: 'eu-central-1', status: 'ACTIVE_HEALTHY' }] };
    if (call.url.includes('/health')) return { body: [{ name: 'db', healthy: true, status: 'ACTIVE_HEALTHY' }, { name: 'auth', healthy: false, status: 'UNHEALTHY', error: 'timeout' }] };
    if (call.url.includes('/advisors/security')) return { body: { lints: [{ name: 'rls_disabled_in_public', title: 'RLS disabled', level: 'ERROR', facing: 'EXTERNAL', categories: ['SECURITY'], remediation: 'https://supabase.com/docs/x', cache_key: 'k', description: 'd', detail: 'x' }] } };
    return { body: [{ version: '20261012000000', name: 'tenant_isolation' }] };
  });
  const supabase = new SupabaseManagementAdapter({ token: 'sbp', fetchImpl: impl });
  const projects = await supabase.execute({ tool: 'supabase', action: 'projects.list', input: {} }, noop);
  assert.equal((projects.output as { projects: Array<{ ref: string }> }).projects[0]!.ref, REF);
  const health = await supabase.execute({ tool: 'supabase', action: 'project.health', input: { projectRef: REF, services: ['db', 'auth', 'drop table'] } }, noop);
  assert.equal(calls[1]!.url, `https://api.supabase.com/v1/projects/${REF}/health?services=db,auth`);
  assert.equal((health.output as { allHealthy: boolean }).allHealthy, false);
  const security = await supabase.execute({ tool: 'supabase', action: 'advisors.security', input: { projectRef: REF } }, noop);
  assert.deepEqual((security.output as { counts: Record<string, number> }).counts, { ERROR: 1 });
  const migrations = await supabase.execute({ tool: 'supabase', action: 'migrations.list', input: { projectRef: REF } }, noop);
  assert.equal((migrations.output as { migrations: Array<{ name: string }> }).migrations[0]!.name, 'tenant_isolation');
  assert.ok(calls.every((call) => (call.init.method ?? 'GET') === 'GET'));
  assert.ok(calls.every((call) => !/database\/query|\/rest\/v1|sql/i.test(call.url)));
  assert.equal((await supabase.execute({ tool: 'supabase', action: 'database.query', input: { sql: 'select 1' } }, noop)).ok, false);
  assert.equal((await supabase.execute({ tool: 'supabase', action: 'project.health', input: { projectRef: '../x' } }, noop)).ok, false);
});
