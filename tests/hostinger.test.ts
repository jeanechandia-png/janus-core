import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { HostingerAdapter } from '../packages/adapters/src/hostinger-adapter.js';
import { HostingerReleaseAdapter, parseHostingerSites } from '../packages/adapters/src/hostinger-release-adapter.js';
import { buildZip, validateArchivePath } from '../packages/adapters/src/zip-writer.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { SENSITIVE_TOOL_ACTIONS } from '../packages/orchestrator/src/sensitive-action-policy.js';

const noop = async () => {};
type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function hostingerFetch(options: { deployStatus?: number; patchOffsetOk?: boolean } = {}) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call: Call = { url: String(url), method: init.method ?? 'GET', headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v])), body: init.body };
    calls.push(call);
    if (call.url.endsWith('/api/hosting/v1/files/upload-urls')) return Response.json({ url: 'https://up.example-host.test/files', auth_key: 'AK', rest_auth_key: 'RK' });
    if (call.url.startsWith('https://up.example-host.test') && call.method === 'POST') return new Response('', { status: 201 });
    if (call.url.startsWith('https://up.example-host.test') && call.method === 'PATCH') {
      const size = String((call.body as Uint8Array).length);
      return new Response(null, { status: 204, headers: { 'upload-offset': options.patchOffsetOk === false ? '1' : size } });
    }
    if (call.url.includes('/deploy')) return Response.json({ message: 'ok' }, { status: options.deployStatus ?? 200 });
    if (call.url.endsWith('/api/hosting/v1/websites')) return Response.json({ data: [{ domain: 'infinityseed.nl', username: 'u123', is_enabled: true, secret_internal: 'x' }] });
    return Response.json({}, { status: 404 });
  }) as typeof fetch;
  return { impl, calls };
}

const SITES = { 'infinityseed.nl': 'u123' };
const FILES = { 'index.html': '<h1>Hola Ñandú €</h1>', 'css/site.css': 'body{margin:0}' };

test('Hostinger read: lists only whitelisted fields', async () => {
  const { impl, calls } = hostingerFetch();
  const result = await new HostingerAdapter({ token: 'tk', fetchImpl: impl }).execute({ tool: 'hostinger', action: 'websites.list', input: {} }, noop);
  assert.equal(result.ok, true);
  assert.deepEqual((result.output as { websites: unknown[] }).websites, [{ domain: 'infinityseed.nl', username: 'u123', is_enabled: true }]);
  assert.equal(calls[0]!.headers.authorization, 'Bearer tk');
  assert.equal((await new HostingerAdapter({ fetchImpl: impl }).execute({ tool: 'hostinger', action: 'websites.list', input: {} }, noop)).ok, false);
  assert.equal((await new HostingerAdapter({ token: 'tk', fetchImpl: impl }).execute({ tool: 'hostinger', action: 'site.deploy', input: {} }, noop)).ok, false);
});

test('Hostinger release: upload-urls → TUS create → TUS patch → deploy, with auth headers', async () => {
  const { impl, calls } = hostingerFetch();
  const adapter = new HostingerReleaseAdapter({ token: 'rel', sites: SITES, fetchImpl: impl, now: () => new Date('2026-10-16T21:05:09.123Z') });
  const result = await adapter.execute({ tool: 'hostinger-release', action: 'site.deploy', input: { domain: 'InfinitySeed.nl', files: FILES } }, noop);
  assert.equal(result.ok, true, String(result.error));
  assert.equal(calls.length, 4);
  assert.equal(calls[0]!.url, 'https://developers.hostinger.com/api/hosting/v1/files/upload-urls');
  assert.equal(calls[0]!.headers.authorization, 'Bearer rel');
  assert.deepEqual(JSON.parse(String(calls[0]!.body)), { username: 'u123', domain: 'infinityseed.nl' });
  assert.equal(calls[1]!.url, 'https://up.example-host.test/files/janus_20261016_210509.zip?override=true');
  assert.equal(calls[1]!.method, 'POST');
  assert.equal(calls[1]!.headers['x-auth'], 'AK');
  assert.equal(calls[1]!.headers['x-auth-rest'], 'RK');
  assert.equal(calls[1]!.headers['upload-offset'], '0');
  assert.equal(calls[2]!.method, 'PATCH');
  assert.equal(calls[2]!.headers['content-type'], 'application/offset+octet-stream');
  assert.equal(calls[1]!.headers['upload-length'], String((calls[2]!.body as Uint8Array).length));
  assert.equal(calls[3]!.url, 'https://developers.hostinger.com/api/hosting/v1/accounts/u123/websites/infinityseed.nl/deploy');
  assert.deepEqual(JSON.parse(String(calls[3]!.body)), { archive_path: 'janus_20261016_210509.zip' });
  assert.ok(!JSON.stringify(result).includes('AK'));
});

test('Hostinger release: guards (allowlist, index.html, secret paths, token, incomplete upload, deploy error)', async () => {
  const { impl, calls } = hostingerFetch();
  const adapter = new HostingerReleaseAdapter({ token: 'rel', sites: SITES, fetchImpl: impl });
  const run = (input: Record<string, unknown>) => adapter.execute({ tool: 'hostinger-release', action: 'site.deploy', input }, noop);
  assert.match(String((await run({ domain: 'evil.com', files: FILES })).error), /allowlist/);
  assert.match(String((await run({ domain: 'infinityseed.nl', files: { 'about.html': 'x' } })).error), /index\.html/);
  assert.match(String((await run({ domain: 'infinityseed.nl', files: { 'index.html': 'x', '.env': 'KEY=1' } })).error), /rejected/);
  assert.match(String((await run({ domain: 'infinityseed.nl', files: { 'index.html': 'x', '../x.html': 'x' } })).error), /rejected/);
  assert.equal((await run({ domain: 'infinityseed.nl', files: 'nope' })).ok, false);
  assert.equal(calls.length, 0);
  assert.equal((await new HostingerReleaseAdapter({ sites: SITES, fetchImpl: impl }).execute({ tool: 'hostinger-release', action: 'site.deploy', input: { domain: 'infinityseed.nl', files: FILES } }, noop)).ok, false);

  const partial = hostingerFetch({ patchOffsetOk: false });
  const incomplete = await new HostingerReleaseAdapter({ token: 'r', sites: SITES, fetchImpl: partial.impl }).execute({ tool: 'hostinger-release', action: 'site.deploy', input: { domain: 'infinityseed.nl', files: FILES } }, noop);
  assert.match(String(incomplete.error), /incomplete/);
  assert.ok(!partial.calls.some((call) => call.url.includes('/deploy')));

  const failing = hostingerFetch({ deployStatus: 422 });
  const failed = await new HostingerReleaseAdapter({ token: 'r', sites: SITES, fetchImpl: failing.impl }).execute({ tool: 'hostinger-release', action: 'site.deploy', input: { domain: 'infinityseed.nl', files: FILES } }, noop);
  assert.equal(failed.ok, false);
  assert.match(String(failed.error), /422/);
});

test('Hostinger: sites parser, approval policy and gateway permit', async () => {
  assert.deepEqual(parseHostingerSites('{"infinityseed.nl":"u1"}'), { 'infinityseed.nl': 'u1' });
  assert.deepEqual(parseHostingerSites(undefined), {});
  assert.throws(() => parseHostingerSites('{"not a domain":"u1"}'));
  assert.throws(() => parseHostingerSites('[1]'));
  assert.ok(SENSITIVE_TOOL_ACTIONS['hostinger-release.site.deploy']);
  const { impl, calls } = hostingerFetch();
  const gateway = new DefaultToolGateway();
  gateway.register(new HostingerReleaseAdapter({ token: 't', sites: SITES, fetchImpl: impl }));
  const denied = await gateway.execute({ tool: 'hostinger-release', action: 'site.deploy', input: { domain: 'infinityseed.nl', files: FILES }, idempotencyKey: 'k' }, noop);
  assert.match(String(denied.error), /authority permit/);
  assert.equal(calls.length, 0);
});

test('zip-writer: archive is a valid ZIP (python zipfile integrity + content) and paths are validated', () => {
  const zip = buildZip([{ path: 'index.html', content: new TextEncoder().encode('<h1>Ñandú €</h1>') }, { path: 'a/b.txt', content: new Uint8Array([1, 2, 3]) }]);
  const dir = mkdtempSync(join(tmpdir(), 'janus-zip-'));
  const file = join(dir, 't.zip');
  writeFileSync(file, zip);
  const out = execFileSync('python3', ['-I', '-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(sorted(z.namelist()));print(z.read("index.html").decode())', file]).toString();
  assert.match(out, /\['a\/b\.txt', 'index\.html'\]/);
  assert.match(out, /Ñandú €/);
  for (const bad of ['', '/abs', 'a\\b', 'a/../b', './a', 'a//b', '.env', 'x/.env.production', '.git/config', 'k/id_rsa']) assert.ok(validateArchivePath(bad), bad);
  for (const good of ['index.html', 'assets/img/logo.png', 'css/site.min.css', '.well-known/security.txt']) assert.equal(validateArchivePath(good), null, good);
});
