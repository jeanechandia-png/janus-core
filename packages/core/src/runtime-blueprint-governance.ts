import {
  createDecisionBlueprint,
  diffDecisionBlueprints,
  validateDecisionBlueprint,
  type BlueprintDiff,
  type BlueprintRevisionProposal,
  type DecisionBlueprint,
} from './decision-blueprint.js';
import type { ImprovementProposal } from './outcome-learning.js';

export type RuntimeImprovementProposal = ImprovementProposal | BlueprintRevisionProposal;

export interface RuntimeBlueprintGovernanceStore {
  getDecisionBlueprint(blueprintId: string, revision?: number): DecisionBlueprint | null;
  listDecisionBlueprints(blueprintId?: string): DecisionBlueprint[];
  upsertDecisionBlueprint(blueprint: DecisionBlueprint): void;
  listImprovementProposals(
    status?: ImprovementProposal['status'],
  ): RuntimeImprovementProposal[];
  upsertImprovementProposal(proposal: RuntimeImprovementProposal): void;
}

export interface RuntimeBlueprintVerification {
  ok: boolean;
  errors: string[];
  diff: BlueprintDiff;
}

export function resolveActiveRuntimeBlueprint(
  store: RuntimeBlueprintGovernanceStore,
  seed: DecisionBlueprint,
): DecisionBlueprint {
  const versions = store.listDecisionBlueprints(seed.id);
  if (versions.length === 0) {
    store.upsertDecisionBlueprint(seed);
    return seed;
  }

  const active = versions.filter((blueprint) => blueprint.status === 'active');
  if (active.length !== 1) {
    throw new Error(
      'Expected exactly one active Decision Blueprint for '
      + seed.id
      + '; found '
      + active.length,
    );
  }
  return active[0]!;
}

export function nextBlueprintRevision(
  store: RuntimeBlueprintGovernanceStore,
  blueprintId: string,
): number {
  const revisions = store
    .listDecisionBlueprints(blueprintId)
    .map((blueprint) => blueprint.revision);
  return revisions.length === 0 ? 1 : Math.max(...revisions) + 1;
}

export function verifyRuntimeBlueprintCandidate(input: {
  current: DecisionBlueprint;
  candidate: DecisionBlueprint;
  registeredTools: Record<string, readonly string[]>;
}): RuntimeBlueprintVerification {
  const errors: string[] = [];
  const validation = validateDecisionBlueprint(input.candidate);
  errors.push(...validation.errors);

  if (input.candidate.id !== input.current.id) {
    errors.push('Candidate Blueprint id must match the active Blueprint id');
  }
  if (input.candidate.revision <= input.current.revision) {
    errors.push('Candidate revision must be newer than the active revision');
  }
  if (input.candidate.status !== 'draft') {
    errors.push('Candidate Blueprint must be draft before verification');
  }
  if (input.candidate.supersedesRevision !== input.current.revision) {
    errors.push('Candidate must supersede the currently active revision');
  }

  const mandatoryGuardrails = new Map<string, string>([
    ['registered-capabilities-only', 'deny'],
    ['privileged-authority', 'deny'],
    ['high-risk-approval', 'require_approval'],
    ['verified-delivery', 'deny'],
  ]);
  for (const [id, effect] of mandatoryGuardrails) {
    const guardrail = input.candidate.guardrails.find((item) => item.id === id);
    if (!guardrail) {
      errors.push('Mandatory guardrail missing: ' + id);
    } else if (guardrail.effect !== effect) {
      errors.push('Mandatory guardrail effect changed: ' + id);
    }
  }

  const requiredRoles = ['planner', 'operator', 'verifier', 'synthesizer'] as const;
  for (const role of requiredRoles) {
    if (!input.candidate.agents.some((agent) => agent.role === role)) {
      errors.push('Mandatory runtime agent role missing: ' + role);
    }
  }

  const registered = new Map<string, Set<string>>();
  for (const [tool, actions] of Object.entries(input.registeredTools)) {
    registered.set(tool, new Set(actions));
  }
  for (const toolPolicy of input.candidate.tools) {
    const allowed = registered.get(toolPolicy.tool);
    if (!allowed) {
      errors.push('Candidate references unregistered tool: ' + toolPolicy.tool);
      continue;
    }
    for (const action of toolPolicy.actions) {
      if (!allowed.has(action)) {
        errors.push(
          'Candidate references unregistered action: '
          + toolPolicy.tool
          + '.'
          + action,
        );
      }
    }
    if (toolPolicy.revalidateBeforeExternalWrite !== true) {
      errors.push(
        'Tool policy must revalidate before external writes: ' + toolPolicy.tool,
      );
    }
  }

  for (const metricId of ['validated-plan-rate', 'verified-delivery-rate']) {
    if (!input.candidate.successMetrics.some((metric) => metric.id === metricId)) {
      errors.push('Mandatory success metric missing: ' + metricId);
    }
  }

  let diff: BlueprintDiff;
  try {
    diff = diffDecisionBlueprints(input.current, input.candidate);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    diff = {
      fromRevision: input.current.revision,
      toRevision: input.candidate.revision,
      changedFields: [],
    };
  }

  if (!diff.changedFields.some((field) => field !== 'status')) {
    errors.push('Candidate must change at least one policy field beyond status');
  }

  return { ok: errors.length === 0, errors, diff };
}

export function findRuntimeImprovementProposal(
  store: RuntimeBlueprintGovernanceStore,
  proposalId: string,
): RuntimeImprovementProposal {
  const proposal = store
    .listImprovementProposals()
    .find((item) => item.id === proposalId);
  if (!proposal) throw new Error('Improvement proposal not found: ' + proposalId);
  return proposal;
}

export function rejectRuntimeImprovementProposal(input: {
  store: RuntimeBlueprintGovernanceStore;
  proposalId: string;
}): RuntimeImprovementProposal {
  const proposal = findRuntimeImprovementProposal(input.store, input.proposalId);
  if (proposal.status === 'rejected') return proposal;
  if (proposal.status !== 'proposed') {
    throw new Error('Only a proposed improvement can be rejected');
  }

  const rejected = { ...proposal, status: 'rejected' as const };
  input.store.upsertImprovementProposal(rejected);
  return rejected;
}

export function approveRuntimeImprovementProposal(input: {
  store: RuntimeBlueprintGovernanceStore;
  proposalId: string;
  current: DecisionBlueprint;
  candidate: DecisionBlueprint;
  registeredTools: Record<string, readonly string[]>;
}): {
  proposal: RuntimeImprovementProposal;
  candidate: DecisionBlueprint;
  verification: RuntimeBlueprintVerification;
} {
  const proposal = findRuntimeImprovementProposal(input.store, input.proposalId);
  if (proposal.status === 'rejected' || proposal.status === 'applied') {
    throw new Error('Improvement proposal is not reviewable in status ' + proposal.status);
  }
  if (
    proposal.blueprintId !== input.current.id
    || proposal.fromRevision !== input.current.revision
  ) {
    throw new Error('Improvement proposal is stale relative to the active Blueprint');
  }

  if (proposal.status === 'approved') {
    const existingDrafts = input.store
      .listDecisionBlueprints(input.current.id)
      .filter(
        (blueprint) =>
          blueprint.status === 'draft'
          && blueprint.supersedesRevision === input.current.revision,
      );
    if (existingDrafts.length !== 1) {
      throw new Error('Approved proposal must have exactly one draft candidate');
    }
    const existing = existingDrafts[0]!;
    const verification = verifyRuntimeBlueprintCandidate({
      current: input.current,
      candidate: existing,
      registeredTools: input.registeredTools,
    });
    if (!verification.ok) {
      throw new Error(
        'Persisted candidate failed regression verification: '
        + verification.errors.join('; '),
      );
    }
    return { proposal, candidate: existing, verification };
  }

  const expectedRevision = nextBlueprintRevision(input.store, input.current.id);
  if (input.candidate.revision !== expectedRevision) {
    throw new Error(
      'Candidate revision must be the next available revision: ' + expectedRevision,
    );
  }

  const verification = verifyRuntimeBlueprintCandidate({
    current: input.current,
    candidate: input.candidate,
    registeredTools: input.registeredTools,
  });
  if (!verification.ok) {
    throw new Error(
      'Candidate Blueprint failed regression verification: '
      + verification.errors.join('; '),
    );
  }

  const existing = input.store.getDecisionBlueprint(
    input.candidate.id,
    input.candidate.revision,
  );
  if (existing && stableJson(existing) !== stableJson(input.candidate)) {
    throw new Error('Candidate revision already exists with different content');
  }
  if (!existing) input.store.upsertDecisionBlueprint(input.candidate);

  const approved = { ...proposal, status: 'approved' as const };
  input.store.upsertImprovementProposal(approved);
  return { proposal: approved, candidate: existing ?? input.candidate, verification };
}

export function applyApprovedRuntimeBlueprint(input: {
  store: RuntimeBlueprintGovernanceStore;
  proposalId: string;
  current: DecisionBlueprint;
  registeredTools: Record<string, readonly string[]>;
}): {
  proposal: RuntimeImprovementProposal;
  previous: DecisionBlueprint;
  active: DecisionBlueprint;
  verification: RuntimeBlueprintVerification;
} {
  const proposal = findRuntimeImprovementProposal(input.store, input.proposalId);

  if (proposal.status === 'applied') {
    const alreadyActive = input.store
      .listDecisionBlueprints(proposal.blueprintId)
      .find((blueprint) => blueprint.status === 'active');
    const previous = input.store.getDecisionBlueprint(
      proposal.blueprintId,
      proposal.fromRevision,
    );
    if (!alreadyActive || !previous) {
      throw new Error('Applied proposal has incomplete Blueprint history');
    }
    const verification = verifyRuntimeBlueprintCandidate({
      current: { ...previous, status: 'active' },
      candidate: {
        ...alreadyActive,
        status: 'draft',
        supersedesRevision: previous.revision,
      },
      registeredTools: input.registeredTools,
    });
    return {
      proposal,
      previous,
      active: alreadyActive,
      verification,
    };
  }

  if (proposal.status !== 'approved') {
    throw new Error('Improvement proposal must be approved before apply');
  }
  if (
    proposal.blueprintId !== input.current.id
    || proposal.fromRevision !== input.current.revision
  ) {
    throw new Error('Approved proposal is stale relative to the active Blueprint');
  }

  const draftCandidates = input.store
    .listDecisionBlueprints(input.current.id)
    .filter(
      (blueprint) =>
        blueprint.status === 'draft'
        && blueprint.supersedesRevision === input.current.revision,
    );
  if (draftCandidates.length !== 1) {
    throw new Error(
      'Approved proposal must have exactly one draft candidate revision; found '
      + draftCandidates.length,
    );
  }
  const candidate = draftCandidates[0]!;

  const verification = verifyRuntimeBlueprintCandidate({
    current: input.current,
    candidate,
    registeredTools: input.registeredTools,
  });
  if (!verification.ok) {
    throw new Error(
      'Candidate Blueprint failed regression verification at apply time: '
      + verification.errors.join('; '),
    );
  }

  const previous = { ...input.current, status: 'historical' as const };
  const active = { ...candidate, status: 'active' as const };
  input.store.upsertDecisionBlueprint(previous);
  input.store.upsertDecisionBlueprint(active);

  const applied = { ...proposal, status: 'applied' as const };
  input.store.upsertImprovementProposal(applied);
  return { proposal: applied, previous, active, verification };
}

export function buildRuntimeBlueprintCandidate(input: {
  store: RuntimeBlueprintGovernanceStore;
  current: DecisionBlueprint;
  content: Pick<
    DecisionBlueprint,
    'objective' | 'modelPolicy' | 'agents' | 'tools' | 'guardrails' | 'successMetrics'
  >;
  createdAt?: string;
}): DecisionBlueprint {
  return createDecisionBlueprint({
    id: input.current.id,
    revision: nextBlueprintRevision(input.store, input.current.id),
    status: 'draft',
    objective: input.content.objective,
    modelPolicy: input.content.modelPolicy,
    agents: input.content.agents,
    tools: input.content.tools,
    guardrails: input.content.guardrails,
    successMetrics: input.content.successMetrics,
    createdAt: input.createdAt,
    supersedesRevision: input.current.revision,
  });
}

export function rollbackRuntimeBlueprint(input: {
  store: RuntimeBlueprintGovernanceStore;
  current: DecisionBlueprint;
  targetRevision: number;
  registeredTools: Record<string, readonly string[]>;
  createdAt?: string;
}): {
  previous: DecisionBlueprint;
  active: DecisionBlueprint;
  sourceRevision: number;
  verification: RuntimeBlueprintVerification;
} {
  if (input.targetRevision === input.current.revision) {
    throw new Error('Rollback target is already active');
  }
  const target = input.store.getDecisionBlueprint(
    input.current.id,
    input.targetRevision,
  );
  if (!target || target.status !== 'historical') {
    throw new Error('Rollback target must be an existing historical revision');
  }

  const candidate = createDecisionBlueprint({
    ...target,
    revision: nextBlueprintRevision(input.store, input.current.id),
    status: 'draft',
    createdAt: input.createdAt ?? new Date().toISOString(),
    supersedesRevision: input.current.revision,
  });
  const verification = verifyRuntimeBlueprintCandidate({
    current: input.current,
    candidate,
    registeredTools: input.registeredTools,
  });
  if (!verification.ok) {
    throw new Error(
      'Rollback candidate failed regression verification: '
      + verification.errors.join('; '),
    );
  }

  const previous = { ...input.current, status: 'historical' as const };
  const active = { ...candidate, status: 'active' as const };
  input.store.upsertDecisionBlueprint(previous);
  input.store.upsertDecisionBlueprint(active);
  return {
    previous,
    active,
    sourceRevision: target.revision,
    verification,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + stableJson(record[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
