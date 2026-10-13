import {
  verifyReleaseHeadCustody,
  type AssistantReleaseTargetManifest,
  type ReleaseCustodyDelivery,
} from './assistant-release-target.js';

/**
 * What the hosting provider reports as LIVE for a site. Chronology is not
 * publication: the newest commit on a release branch may be an unpublished
 * candidate. Only the provider's published deploy says what visitors see.
 */
export interface PublishedDeploymentObservation {
  provider: 'netlify';
  siteId: string;
  deployId: string;
  state: string | null;
  context: string | null;
  branch: string | null;
  commitSha: string | null;
  title: string | null;
  publishedAt: string | null;
  observedAt: string;
}

export type PublishedReleaseAssessmentCode =
  | 'not_bound'
  | 'site_mismatch'
  | 'not_ready'
  | 'branch_mismatch'
  | 'commit_unverifiable'
  | 'unpublished_commits_above_production';

export type PublishedReleaseAssessment =
  | {
    ok: true;
    relation: 'head_is_published' | 'janus_deliveries_above_published';
    publishedCommitSha: string;
    deployId: string;
    custodyChain: string[];
  }
  | {
    ok: false;
    code: PublishedReleaseAssessmentCode;
    reason: string;
    deployId?: string;
    publishedCommitSha?: string | null;
  };

/**
 * Decide whether Janus may write onto the release branch, using the live
 * production deploy as the anchor:
 *
 * - the branch HEAD must be exactly the published commit, or
 * - the only commits above it must be Janus' own read-back-verified deliveries.
 *
 * Anything else means the branch holds work that is not live (a candidate
 * awaiting the Founder's authorization) and Janus fails closed rather than
 * stacking its bundle on top of unapproved work.
 */
export function assessPublishedRelease(input: {
  manifest: AssistantReleaseTargetManifest;
  observation: PublishedDeploymentObservation;
  observedHeadSha: string;
  deliveries: readonly ReleaseCustodyDelivery[];
}): PublishedReleaseAssessment {
  const binding = input.manifest.deployment;
  const observation = input.observation;
  if (!binding) {
    return { ok: false, code: 'not_bound', reason: 'release manifest declares no deployment binding' };
  }
  if (binding.provider !== observation.provider || binding.siteId !== observation.siteId) {
    return {
      ok: false,
      code: 'site_mismatch',
      reason: 'observed deployment belongs to ' + observation.provider + ':' + observation.siteId
        + ', manifest binds ' + binding.provider + ':' + binding.siteId,
      deployId: observation.deployId,
    };
  }
  if (observation.state !== 'ready') {
    return {
      ok: false,
      code: 'not_ready',
      reason: 'published deploy ' + observation.deployId + ' is not ready (state ' + String(observation.state) + ')',
      deployId: observation.deployId,
    };
  }
  if (observation.branch && observation.branch !== input.manifest.releaseRef) {
    return {
      ok: false,
      code: 'branch_mismatch',
      reason: 'published deploy ' + observation.deployId + ' was built from ' + observation.branch
        + ', manifest declares ' + input.manifest.releaseRef,
      deployId: observation.deployId,
    };
  }
  const published = observation.commitSha?.trim().toLowerCase() ?? '';
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(published)) {
    return {
      ok: false,
      code: 'commit_unverifiable',
      reason: 'published deploy ' + observation.deployId
        + ' carries no structured commit reference; Janus does not infer the live commit from titles or chronology',
      deployId: observation.deployId,
      publishedCommitSha: null,
    };
  }

  const custody = verifyReleaseHeadCustody({
    manifest: { ...input.manifest, releaseHeadSha: published },
    observedHeadSha: input.observedHeadSha,
    deliveries: input.deliveries,
  });
  if (!custody.ok) {
    return {
      ok: false,
      code: 'unpublished_commits_above_production',
      reason: 'release branch ' + input.manifest.releaseRef + ' is at ' + input.observedHeadSha.toLowerCase()
        + ' but production deploy ' + observation.deployId + ' publishes ' + published
        + '; the commits in between are not live and are not Janus deliveries',
      deployId: observation.deployId,
      publishedCommitSha: published,
    };
  }
  return {
    ok: true,
    relation: custody.mode === 'manifest_head' ? 'head_is_published' : 'janus_deliveries_above_published',
    publishedCommitSha: published,
    deployId: observation.deployId,
    custodyChain: custody.chain,
  };
}

export function publishedDeploymentObservationFromOutput(
  output: Record<string, unknown> | undefined,
): PublishedDeploymentObservation {
  const text = (key: string): string | null => {
    const value = output?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const deployId = text('deployId');
  const siteId = text('siteId');
  if (output?.provider !== 'netlify' || !deployId || !siteId) {
    throw new Error('published deployment observation is malformed');
  }
  return {
    provider: 'netlify',
    siteId,
    deployId,
    state: text('state'),
    context: text('context'),
    branch: text('branch'),
    commitSha: text('commitSha'),
    title: text('title'),
    publishedAt: text('publishedAt'),
    observedAt: text('observedAt') ?? new Date().toISOString(),
  };
}
