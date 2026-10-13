import assert from 'node:assert/strict';
import test from 'node:test';
import { NetlifyDeployAdapter } from '../packages/adapters/src/netlify-deploy-adapter.js';
import {
  createAssistantReleaseTargetManifest,
  parseAssistantReleaseTargetManifest,
} from '../packages/core/src/assistant-release-target.js';
import {
  assessPublishedRelease,
  publishedDeploymentObservationFromOutput,
  type PublishedDeploymentObservation,
} from '../packages/core/src/published-release.js';

const SITE = '334784f0-2fee-47a6-bd70-150fc28238fc';
const PUBLISHED = 'f0324f96'.padEnd(40, '0');
const CANDIDATE = '7485f058'.padEnd(40, '1');
const JANUS = 'aa'.repeat(20);

function manifest(withDeployment = true) {
  return createAssistantReleaseTargetManifest({
    schemaVersion: 1,
    surfaceId: 'landing.infinity-chatbox',
    product: 'infinity-chatbox',
    repository: 'owner/product',
    releaseRef: 'release/rc25',
    releaseHeadSha: '0cb2745a'.padEnd(40, '2'),
    updatedAt: '2026-10-13T17:00:00.000Z',
    evidenceRefs: ['netlify:site/' + SITE],
    ...(withDeployment ? { deployment: { provider: 'netlify' as const, siteId: SITE } } : {}),
  });
}

function observation(over: Partial<PublishedDeploymentObservation> = {}): PublishedDeploymentObservation {
  return {
    provider: 'netlify',
    siteId: SITE,
    deployId: 'deploy-prod',
    state: 'ready',
    context: 'production',
    branch: 'release/rc25',
    commitSha: PUBLISHED,
    title: 'whatever the title says is never evidence ' + CANDIDATE,
    publishedAt: '2026-10-12T23:59:00.000Z',
    observedAt: '2026-10-13T17:00:00.000Z',
    ...over,
  };
}

test('existing manifests without deployment keep their checksum (backward compatible)', () => {
  // Exact production manifest observed on infinity-chatbox-platform@infinity/assistant-control-metadata (de219f8e).
  const live = JSON.stringify({
    schemaVersion: 1,
    surfaceId: 'landing.infinity-chatbox',
    product: 'infinity-chatbox',
    repository: 'jeanechandia-png/infinity-chatbox-platform',
    releaseRef: 'release/rc25-canonical-landing-20260925',
    releaseHeadSha: '0cb2745aa8de00a96654789da4deb5f8f9b5d5cc',
    updatedAt: '2026-10-09T00:00:00.000Z',
    evidenceRefs: [
      'github:jeanechandia-png/infinity-chatbox-platform@release/rc25-canonical-landing-20260925#0cb2745aa8de00a96654789da4deb5f8f9b5d5cc',
      'github:app/api/v1/assistant-control/status/route.ts#96407cb758ebf2701b56278d329d1cb312fd1aeb',
      'github:app/api/v1/chat/route.ts@release/rc25-canonical-landing-20260925',
    ],
    checksum: '45d3cf5b2173af42c4af8f74c1cb7a91e476d9d3182a6a9e21d035f6672b03d7',
  });
  assert.equal(parseAssistantReleaseTargetManifest(live).deployment, undefined);
});

test('deployment binding is covered by the checksum and round-trips', () => {
  const bound = manifest();
  assert.notEqual(bound.checksum, manifest(false).checksum);
  assert.deepEqual(parseAssistantReleaseTargetManifest(JSON.stringify(bound)), bound);
  const tampered = { ...bound, deployment: { provider: 'netlify', siteId: 'other-site' } };
  assert.throws(() => parseAssistantReleaseTargetManifest(JSON.stringify(tampered)), /checksum/);
  assert.throws(() => createAssistantReleaseTargetManifest({
    ...manifest(false), deployment: { provider: 'netlify', siteId: '../x' },
  }), /siteId/);
});

test('branch HEAD equal to the live production commit is publishable', () => {
  const result = assessPublishedRelease({ manifest: manifest(), observation: observation(), observedHeadSha: PUBLISHED, deliveries: [] });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.relation, 'head_is_published');
});

test('a newer unpublished candidate above production blocks Janus (chronology is not publication)', () => {
  const result = assessPublishedRelease({ manifest: manifest(), observation: observation(), observedHeadSha: CANDIDATE, deliveries: [] });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'unpublished_commits_above_production');
});

test('only Janus verified deliveries may sit above the production commit', () => {
  const result = assessPublishedRelease({
    manifest: manifest(),
    observation: observation(),
    observedHeadSha: JANUS,
    deliveries: [{ id: 'd1', target: 'owner/product', targetRef: 'release/rc25', status: 'published_verified', expectedHeadSha: PUBLISHED, publishedCommitSha: JANUS }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.relation, 'janus_deliveries_above_published');
});

test('the live commit is never inferred from a title or chronology', () => {
  const result = assessPublishedRelease({ manifest: manifest(), observation: observation({ commitSha: null }), observedHeadSha: CANDIDATE, deliveries: [] });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, 'commit_unverifiable');
});

test('wrong site, not-ready deploy, other branch or missing binding fail closed', () => {
  const cases: Array<[Parameters<typeof assessPublishedRelease>[0], string]> = [
    [{ manifest: manifest(), observation: observation({ siteId: 'other' }), observedHeadSha: PUBLISHED, deliveries: [] }, 'site_mismatch'],
    [{ manifest: manifest(), observation: observation({ state: 'building' }), observedHeadSha: PUBLISHED, deliveries: [] }, 'not_ready'],
    [{ manifest: manifest(), observation: observation({ branch: 'main' }), observedHeadSha: PUBLISHED, deliveries: [] }, 'branch_mismatch'],
    [{ manifest: manifest(false), observation: observation(), observedHeadSha: PUBLISHED, deliveries: [] }, 'not_bound'],
  ];
  for (const [input, code] of cases) {
    const result = assessPublishedRelease(input);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, code);
  }
});

test('Netlify adapter reads only the published deploy and exposes the structured commit', async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const adapter = new NetlifyDeployAdapter({
    token: 'test-token',
    fetchImpl: (async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method });
      return new Response(JSON.stringify({
        id: SITE,
        published_deploy: { id: 'deploy-prod', state: 'ready', context: 'production', branch: 'release/rc25', commit_ref: PUBLISHED, title: 'x', published_at: '2026-10-12T23:59:00Z' },
      }), { status: 200 });
    }) as typeof fetch,
  });
  const result = await adapter.execute({ tool: 'netlify', action: 'site.published_deploy', input: { siteId: SITE } }, () => {});
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{ url: 'https://api.netlify.com/api/v1/sites/' + SITE, method: 'GET' }]);
  const observed = publishedDeploymentObservationFromOutput(result.output);
  assert.equal(observed.commitSha, PUBLISHED);
  assert.equal(observed.deployId, 'deploy-prod');
});

test('Netlify adapter fails closed without token, with bad site id, unsupported action or no published deploy', async () => {
  const empty = new NetlifyDeployAdapter({ token: '' });
  assert.equal((await empty.execute({ tool: 'netlify', action: 'site.published_deploy', input: { siteId: SITE } }, () => {})).ok, false);
  const adapter = new NetlifyDeployAdapter({
    token: 't',
    fetchImpl: (async () => new Response(JSON.stringify({ id: SITE, published_deploy: null }), { status: 200 })) as typeof fetch,
  });
  assert.equal((await adapter.execute({ tool: 'netlify', action: 'site.published_deploy', input: { siteId: '../etc' } }, () => {})).ok, false);
  assert.equal((await adapter.execute({ tool: 'netlify', action: 'deploy.publish', input: { siteId: SITE } }, () => {})).ok, false);
  const none = await adapter.execute({ tool: 'netlify', action: 'site.published_deploy', input: { siteId: SITE } }, () => {});
  assert.equal(none.ok, false);
  assert.match(none.error ?? '', /no published deploy/);
});
