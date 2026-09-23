export const DECISION_BLUEPRINT_SCHEMA_VERSION = 1 as const;

export type BlueprintStatus = 'draft' | 'active' | 'historical';
export type BlueprintAgentRole =
  | 'planner'
  | 'researcher'
  | 'analyst'
  | 'operator'
  | 'builder'
  | 'verifier'
  | 'synthesizer';
export type GuardrailEffect = 'deny' | 'require_approval' | 'warn';

export interface BlueprintModelPolicy {
  requiredCapabilities: string[];
  preferredCapabilities?: string[];
  requireLocal?: boolean;
  preferLocal?: boolean;
  preferLowLatency?: boolean;
  preferLowCost?: boolean;
  minimumContextWindow?: number;
}

export interface BlueprintAgent {
  id: string;
  role: BlueprintAgentRole;
  objective: string;
  requiredCapabilities: string[];
  maxParallelism?: number;
}

export interface BlueprintToolPolicy {
  tool: string;
  actions: string[];
  allowOfflineQueue?: boolean;
  revalidateBeforeExternalWrite?: boolean;
}

export interface BlueprintGuardrail {
  id: string;
  description: string;
  condition: string;
  effect: GuardrailEffect;
}

export interface BlueprintSuccessMetric {
  id: string;
  description: string;
  direction: 'min' | 'max';
  target: number;
}

export interface DecisionBlueprint {
  schemaVersion: typeof DECISION_BLUEPRINT_SCHEMA_VERSION;
  id: string;
  revision: number;
  status: BlueprintStatus;
  objective: string;
  modelPolicy: BlueprintModelPolicy;
  agents: BlueprintAgent[];
  tools: BlueprintToolPolicy[];
  guardrails: BlueprintGuardrail[];
  successMetrics: BlueprintSuccessMetric[];
  createdAt: string;
  supersedesRevision?: number;
}

export interface BlueprintValidationResult {
  ok: boolean;
  errors: string[];
}

export interface BlueprintDiff {
  fromRevision: number;
  toRevision: number;
  changedFields: string[];
}

export interface BlueprintRevisionProposal {
  id: string;
  blueprintId: string;
  fromRevision: number;
  proposedRevision: number;
  rationale: string;
  evidenceRefs: string[];
  suggestedChanges: string[];
  requiresHumanApproval: true;
  status: 'proposed' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

export function validateDecisionBlueprint(blueprint: DecisionBlueprint): BlueprintValidationResult {
  const errors: string[] = [];
  if (blueprint.schemaVersion !== DECISION_BLUEPRINT_SCHEMA_VERSION) {
    errors.push(`Unsupported decision blueprint schema version: ${blueprint.schemaVersion}`);
  }
  if (!blueprint.id.trim()) errors.push('Blueprint id is required');
  if (blueprint.revision < 1 || !Number.isInteger(blueprint.revision)) {
    errors.push('Blueprint revision must be a positive integer');
  }
  if (!blueprint.objective.trim()) errors.push('Blueprint objective is required');

  const agentIds = new Set<string>();
  for (const agent of blueprint.agents) {
    if (!agent.id.trim()) errors.push('Every blueprint agent requires an id');
    if (agentIds.has(agent.id)) errors.push(`Duplicate blueprint agent id: ${agent.id}`);
    agentIds.add(agent.id);
    if (!agent.objective.trim()) errors.push(`Blueprint agent ${agent.id} requires an objective`);
    if ((agent.maxParallelism ?? 1) < 1) {
      errors.push(`Blueprint agent ${agent.id} maxParallelism must be >= 1`);
    }
  }

  const tools = new Set<string>();
  for (const tool of blueprint.tools) {
    if (!tool.tool.trim()) errors.push('Blueprint tool name is required');
    if (tools.has(tool.tool)) errors.push(`Duplicate blueprint tool policy: ${tool.tool}`);
    tools.add(tool.tool);
    if (tool.actions.length === 0) errors.push(`Blueprint tool ${tool.tool} must allow at least one action`);
  }

  const guardrailIds = new Set<string>();
  for (const guardrail of blueprint.guardrails) {
    if (!guardrail.id.trim()) errors.push('Every guardrail requires an id');
    if (guardrailIds.has(guardrail.id)) errors.push(`Duplicate guardrail id: ${guardrail.id}`);
    guardrailIds.add(guardrail.id);
    if (!guardrail.condition.trim()) errors.push(`Guardrail ${guardrail.id} requires a condition`);
  }

  const metricIds = new Set<string>();
  for (const metric of blueprint.successMetrics) {
    if (!metric.id.trim()) errors.push('Every success metric requires an id');
    if (metricIds.has(metric.id)) errors.push(`Duplicate success metric id: ${metric.id}`);
    metricIds.add(metric.id);
    if (!Number.isFinite(metric.target)) errors.push(`Success metric ${metric.id} target must be finite`);
  }

  if (
    blueprint.supersedesRevision !== undefined &&
    blueprint.supersedesRevision >= blueprint.revision
  ) {
    errors.push('supersedesRevision must be lower than revision');
  }

  return { ok: errors.length === 0, errors };
}

export function createDecisionBlueprint(
  input: Omit<DecisionBlueprint, 'schemaVersion' | 'createdAt'> & { createdAt?: string },
): DecisionBlueprint {
  const blueprint: DecisionBlueprint = {
    ...input,
    schemaVersion: DECISION_BLUEPRINT_SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const validation = validateDecisionBlueprint(blueprint);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return blueprint;
}

export function diffDecisionBlueprints(
  previous: DecisionBlueprint,
  next: DecisionBlueprint,
): BlueprintDiff {
  if (previous.id !== next.id) throw new Error('Cannot diff blueprints with different ids');

  const fields: Array<keyof DecisionBlueprint> = [
    'status',
    'objective',
    'modelPolicy',
    'agents',
    'tools',
    'guardrails',
    'successMetrics',
  ];
  const changedFields = fields.filter(
    (field) => stableJson(previous[field]) !== stableJson(next[field]),
  ) as string[];

  return {
    fromRevision: previous.revision,
    toRevision: next.revision,
    changedFields,
  };
}

export function proposeBlueprintRevision(input: {
  id: string;
  blueprint: DecisionBlueprint;
  rationale: string;
  evidenceRefs: string[];
  suggestedChanges: string[];
  createdAt?: string;
}): BlueprintRevisionProposal {
  if (!input.rationale.trim()) throw new Error('Improvement proposal rationale is required');
  if (input.suggestedChanges.length === 0) throw new Error('Improvement proposal needs at least one change');

  return {
    id: input.id,
    blueprintId: input.blueprint.id,
    fromRevision: input.blueprint.revision,
    proposedRevision: input.blueprint.revision + 1,
    rationale: input.rationale,
    evidenceRefs: [...input.evidenceRefs],
    suggestedChanges: [...input.suggestedChanges],
    requiresHumanApproval: true,
    status: 'proposed',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
