export type ExpertiseDomain = 'coding' | 'agentic_workflow';

export type KnowledgeFreshness =
  | 'fresh_verified'
  | 'local_snapshot'
  | 'stale_but_usable'
  | 'requires_online_validation';

export interface ExpertisePolicy {
  domain: ExpertiseDomain;
  currentKnowledgeRequired: boolean;
  primarySourcesPreferred: boolean;
  localFirst: boolean;
  providerIndependent: boolean;
  mandatoryVerification: readonly string[];
}

export interface KnowledgeAssessmentInput {
  online: boolean;
  lastVerifiedAt?: string;
  localSnapshotAvailable?: boolean;
  maxAgeDays?: number;
  staleUsableDays?: number;
  now?: Date;
}

export interface KnowledgeAssessment {
  state: KnowledgeFreshness;
  canContinueOffline: boolean;
  requiresRevalidationOnReconnect: boolean;
  reason: string;
}

const POLICIES: Record<ExpertiseDomain, ExpertisePolicy> = {
  coding: {
    domain: 'coding',
    currentKnowledgeRequired: true,
    primarySourcesPreferred: true,
    localFirst: true,
    providerIndependent: true,
    mandatoryVerification: ['tests', 'typecheck', 'security', 'regression'],
  },
  agentic_workflow: {
    domain: 'agentic_workflow',
    currentKnowledgeRequired: true,
    primarySourcesPreferred: true,
    localFirst: true,
    providerIndependent: true,
    mandatoryVerification: ['graph_validation', 'tool_permissions', 'idempotency', 'recovery', 'observability'],
  },
};

export function expertisePolicy(domain: ExpertiseDomain): ExpertisePolicy {
  return { ...POLICIES[domain], mandatoryVerification: [...POLICIES[domain].mandatoryVerification] };
}

export function assessKnowledgeFreshness(
  domain: ExpertiseDomain,
  input: KnowledgeAssessmentInput,
): KnowledgeAssessment {
  const policy = POLICIES[domain];
  const now = input.now ?? new Date();
  const maxAgeDays = input.maxAgeDays ?? 30;
  const staleUsableDays = Math.max(maxAgeDays, input.staleUsableDays ?? 180);
  const verified = input.lastVerifiedAt ? new Date(input.lastVerifiedAt) : undefined;
  const validVerifiedAt = verified && !Number.isNaN(verified.getTime()) ? verified : undefined;
  const ageDays = validVerifiedAt
    ? Math.max(0, (now.getTime() - validVerifiedAt.getTime()) / 86_400_000)
    : Number.POSITIVE_INFINITY;

  if (!policy.currentKnowledgeRequired || ageDays <= maxAgeDays) {
    return {
      state: 'fresh_verified',
      canContinueOffline: true,
      requiresRevalidationOnReconnect: false,
      reason: 'Knowledge is within the verified freshness window.',
    };
  }

  if (input.localSnapshotAvailable && ageDays <= staleUsableDays) {
    return {
      state: ageDays <= maxAgeDays ? 'local_snapshot' : 'stale_but_usable',
      canContinueOffline: true,
      requiresRevalidationOnReconnect: ageDays > maxAgeDays,
      reason: ageDays > maxAgeDays
        ? 'Local knowledge is stale but usable for offline continuation; revalidate before external delivery.'
        : 'A verified local snapshot is available.',
    };
  }

  if (!input.online && input.localSnapshotAvailable) {
    return {
      state: 'stale_but_usable',
      canContinueOffline: true,
      requiresRevalidationOnReconnect: true,
      reason: 'Offline continuity takes priority; use the local snapshot and queue online revalidation.',
    };
  }

  return {
    state: 'requires_online_validation',
    canContinueOffline: false,
    requiresRevalidationOnReconnect: true,
    reason: input.online
      ? 'Current knowledge must be validated before relying on it.'
      : 'No usable local knowledge snapshot is available for this technical domain.',
  };
}

export function requiresFreshResearch(domain: ExpertiseDomain, lastVerifiedAt?: string, maxAgeDays = 30, now = new Date()): boolean {
  if (!POLICIES[domain].currentKnowledgeRequired || !lastVerifiedAt) return true;
  const verified = new Date(lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return true;
  return now.getTime() - verified.getTime() > maxAgeDays * 86_400_000;
}
