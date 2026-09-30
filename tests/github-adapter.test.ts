import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubAdapter } from '../packages/adapters/src/github-adapter.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('GitHub adapter reads repository metadata without exposing credentials', async () => {
  let authorization: string | null = null;
  const adapter = new GitHubAdapter({
    token: 'test-secret',
    fetchImpl: async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization');
      return jsonResponse({
        full_name: 'owner/repo',
        private: true,
        default_branch: 'main',
        description: 'demo',
        updated_at: '2026-09-13T00:00:00Z',
        html_url: 'https://github.com/owner/repo',
      });
    },
  });

  const result = await adapter.execute(
    { tool: 'github', action: 'repo.get', input: { owner: 'owner', repo: 'repo' } },
    async () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.output?.fullName, 'owner/repo');
  assert.equal(result.output?.private, true);
  assert.equal(authorization, 'Bearer test-secret');
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});

test('GitHub adapter decodes a file safely', async () => {
  const adapter = new GitHubAdapter({
    fetchImpl: async () => jsonResponse({
      type: 'file',
      content: Buffer.from('hello Janus').toString('base64'),
      encoding: 'base64',
      sha: 'abc',
      size: 11,
      html_url: 'https://github.com/owner/repo/blob/main/README.md',
    }),
  });

  const result = await adapter.execute(
    {
      tool: 'github',
      action: 'file.read',
      input: { owner: 'owner', repo: 'repo', path: 'README.md' },
    },
    async () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.output?.content, 'hello Janus');
});

test('GitHub adapter returns API errors as tool errors', async () => {
  const adapter = new GitHubAdapter({
    fetchImpl: async () => jsonResponse({ message: 'Not Found' }, 404),
  });

  const result = await adapter.execute(
    { tool: 'github', action: 'repo.get', input: { owner: 'owner', repo: 'missing' } },
    async () => {},
  );

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /GitHub 404: Not Found/);
});


test('GitHub adapter resolves an explicit branch head', async () => {
  const adapter = new GitHubAdapter({
    fetchImpl: async (input) => {
      assert.match(String(input), /git\/ref\/heads\/release\/assistant-control$/);
      return jsonResponse({ object: { sha: 'head123' } });
    },
  });

  const result = await adapter.execute(
    {
      tool: 'github',
      action: 'branch.get',
      input: { owner: 'owner', repo: 'repo', ref: 'release/assistant-control' },
    },
    async () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.output?.sha, 'head123');
});

test('GitHub adapter publishes a file only after branch revalidation', async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  let headReads = 0;
  const adapter = new GitHubAdapter({
    token: 'write-secret',
    fetchImpl: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, body });

      if (url.includes('/git/ref/heads/release')) {
        headReads += 1;
        return jsonResponse({ object: { sha: 'head123' } });
      }
      if (method === 'GET' && url.includes('/contents/.infinity/assistant-control/iba.json')) {
        return jsonResponse({ message: 'Not Found' }, 404);
      }
      if (method === 'PUT' && url.includes('/contents/.infinity/assistant-control/iba.json')) {
        assert.equal(body.branch, 'release');
        assert.equal(
          Buffer.from(body.content, 'base64').toString('utf8'),
          '{"bundle":"v2"}\n',
        );
        return jsonResponse({
          content: {
            sha: 'file456',
            html_url: 'https://github.com/owner/repo/blob/release/.infinity/assistant-control/iba.json',
          },
          commit: {
            sha: 'commit456',
            html_url: 'https://github.com/owner/repo/commit/commit456',
          },
        }, 201);
      }
      throw new Error('unexpected request ' + method + ' ' + url);
    },
  });

  const result = await adapter.execute(
    {
      tool: 'github',
      action: 'file.publish',
      input: {
        owner: 'owner',
        repo: 'repo',
        path: '.infinity/assistant-control/iba.json',
        ref: 'release',
        content: '{"bundle":"v2"}\n',
        expectedHeadSha: 'head123',
        message: 'Update assistant config',
      },
    },
    async () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.output?.commitSha, 'commit456');
  assert.equal(result.output?.unchanged, false);
  assert.equal(headReads, 2);
  assert.equal(calls.filter((call) => call.method === 'PUT').length, 1);
  assert.equal(JSON.stringify(calls).includes('write-secret'), false);
});

test('GitHub adapter skips a publish when target content is already identical', async () => {
  let putCalls = 0;
  const desired = '{"bundle":"same"}\n';
  const adapter = new GitHubAdapter({
    token: 'write-secret',
    fetchImpl: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/git/ref/heads/release')) {
        return jsonResponse({ object: { sha: 'head123' } });
      }
      if (method === 'GET' && url.includes('/contents/config.json')) {
        return jsonResponse({
          type: 'file',
          content: Buffer.from(desired).toString('base64'),
          encoding: 'base64',
          sha: 'file123',
          html_url: 'https://github.com/owner/repo/blob/release/config.json',
        });
      }
      if (method === 'PUT') {
        putCalls += 1;
        throw new Error('PUT should not be called');
      }
      throw new Error('unexpected request');
    },
  });

  const result = await adapter.execute(
    {
      tool: 'github',
      action: 'file.publish',
      input: {
        owner: 'owner',
        repo: 'repo',
        path: 'config.json',
        ref: 'release',
        content: desired,
        expectedHeadSha: 'head123',
        message: 'No-op publish',
      },
    },
    async () => {},
  );

  assert.equal(result.ok, true);
  assert.equal(result.output?.unchanged, true);
  assert.equal(result.output?.commitSha, 'head123');
  assert.equal(putCalls, 0);
});

test('GitHub adapter refuses publish when branch head changed from expected state', async () => {
  const adapter = new GitHubAdapter({
    token: 'write-secret',
    fetchImpl: async () => jsonResponse({ object: { sha: 'new-head' } }),
  });

  const result = await adapter.execute(
    {
      tool: 'github',
      action: 'file.publish',
      input: {
        owner: 'owner',
        repo: 'repo',
        path: 'config.json',
        ref: 'release',
        content: '{}\n',
        expectedHeadSha: 'old-head',
        message: 'Unsafe publish',
      },
    },
    async () => {},
  );

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /branch head changed before publish/);
});
