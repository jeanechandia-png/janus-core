import { randomUUID } from 'node:crypto';
import type { BlueprintRevisionProposal, BlueprintToolPolicy, DecisionBlueprint } from './decision-blueprint.js';
import {
  applyApprovedRuntimeBlueprint,
  approveRuntimeImprovementProposal,
  buildRuntimeBlueprintCandidate,
  type RuntimeBlueprintGovernanceStore,
} from './runtime-blueprint-governance.js';

/**
 * Tool-catalog sync for the runtime Decision Blueprint.
 *
 * New tools (integrations) appear in the capability registry but the ACTIVE
 * Blueprint only allows what the Founder approved. This module shows the exact
 * difference and, on an explicit Founder action, creates a new Blueprint
 * revision through the existing governance path (proposal → verified draft →
 * apply). It only ADDS registered tools/actions ("siempre sumando"); a tool that
 * is no longer registered cannot pass verification and is reported explicitly
 * instead of being dropped silently.
 */
export interface ToolCatalogDiff {
  activeRevision: number;
  upToDate: boolean;
  additions: Array<{ tool: string; actions: string[] }>;
  unregistered: Array<{ tool: string; actions: string[] }>;
}

export function diffToolCatalog(current: DecisionBlueprint, registered: Record<string, readonly string[]>): ToolCatalogDiff {
  const allowed = new Map(current.tools.map((policy) => [policy.tool, new Set(policy.actions)]));
  const additions: ToolCatalogDiff['additions'] = [];
  for (const [tool, actions] of Object.entries(registered).sort(([a], [b]) => a.localeCompare(b))) {
    const missing = [...new Set(actions)].filter((action) => !allowed.get(tool)?.has(action)).sort();
    if (missing.length) additions.push({ tool, actions: missing });
  }
  const unregistered: ToolCatalogDiff['unregistered'] = [];
  for (const policy of current.tools) {
    const known = new Set(registered[policy.tool] ?? []);
    const gone = policy.actions.filter((action) => !known.has(action)).sort();
    if (gone.length) unregistered.push({ tool: policy.tool, actions: gone });
  }
  return { activeRevision: current.revision, upToDate: additions.length === 0, additions, unregistered };
}

export function applyToolCatalogSync(input: {
  store: RuntimeBlueprintGovernanceStore;
  current: DecisionBlueprint;
  registeredTools: Record<string, readonly string[]>;
  expectedRevision: number;
  createdAt?: string;
}): { diff: ToolCatalogDiff; proposal: BlueprintRevisionProposal; previous: DecisionBlueprint; active: DecisionBlueprint } {
  if (input.expectedRevision !== input.current.revision) {
    throw new Error(`Blueprint changed meanwhile (active revision ${input.current.revision}, expected ${input.expectedRevision}); review again`);
  }
  const diff = diffToolCatalog(input.current, input.registeredTools);
  if (diff.upToDate) throw new Error('Blueprint tool catalog is already up to date');
  if (diff.unregistered.length) {
    throw new Error('Active Blueprint references unregistered actions (' + diff.unregistered.map((item) => item.tool + ':' + item.actions.join('|')).join(', ') + '); restore those tools before syncing');
  }
  const merged = new Map<string, Set<string>>(input.current.tools.map((policy) => [policy.tool, new Set(policy.actions)]));
  for (const addition of diff.additions) {
    const set = merged.get(addition.tool) ?? new Set<string>();
    for (const action of addition.actions) set.add(action);
    merged.set(addition.tool, set);
  }
  const previousPolicies = new Map(input.current.tools.map((policy) => [policy.tool, policy]));
  const tools: BlueprintToolPolicy[] = [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tool, actions]) => ({
      ...(previousPolicies.get(tool) ?? {}),
      tool,
      actions: [...actions].sort(),
      allowOfflineQueue: previousPolicies.get(tool)?.allowOfflineQueue ?? false,
      revalidateBeforeExternalWrite: true,
    }));
  const createdAt = input.createdAt ?? new Date().toISOString();
  const candidate = buildRuntimeBlueprintCandidate({
    store: input.store,
    current: input.current,
    content: {
      objective: input.current.objective,
      modelPolicy: input.current.modelPolicy,
      agents: input.current.agents,
      tools,
      guardrails: input.current.guardrails,
      successMetrics: input.current.successMetrics,
    },
    createdAt,
  });
  const proposal: BlueprintRevisionProposal = {
    id: `tool_sync_${randomUUID()}`,
    blueprintId: input.current.id,
    fromRevision: input.current.revision,
    proposedRevision: candidate.revision,
    rationale: 'Founder-approved tool catalog sync: allow newly registered integrations; guardrails, approvals and authority unchanged.',
    evidenceRefs: ['capability-registry'],
    suggestedChanges: diff.additions.map((item) => `allow ${item.tool}: ${item.actions.join(', ')}`),
    requiresHumanApproval: true,
    status: 'proposed',
    createdAt,
  };
  input.store.upsertImprovementProposal(proposal);
  approveRuntimeImprovementProposal({ store: input.store, proposalId: proposal.id, current: input.current, candidate, registeredTools: input.registeredTools });
  const applied = applyApprovedRuntimeBlueprint({ store: input.store, proposalId: proposal.id, current: input.current, registeredTools: input.registeredTools });
  return { diff, proposal: applied.proposal as BlueprintRevisionProposal, previous: applied.previous, active: applied.active };
}
