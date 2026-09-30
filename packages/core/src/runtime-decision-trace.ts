import { randomUUID } from 'node:crypto';
import {
  createDecisionBlueprint,
  type DecisionBlueprint,
} from './decision-blueprint.js';
import {
  createDecisionReceipt,
  type DecisionReceipt,
  type DecisionReceiptInput,
} from './decision-receipt.js';

export const RUNTIME_DECISION_BLUEPRINT_ID = 'janus-runtime-execution' as const;
export const RUNTIME_DECISION_BLUEPRINT_REVISION = 1 as const;

export interface DecisionTraceStore {
  getDecisionBlueprint(blueprintId: string, revision?: number): DecisionBlueprint | null;
  upsertDecisionBlueprint(blueprint: DecisionBlueprint): void;
  listDecisionReceipts(runId?: string, limit?: number): DecisionReceipt[];
  appendDecisionReceipt(receipt: DecisionReceipt): void;
}

export interface RuntimeDecisionBlueprintOptions {
  toolCatalog: Record<string, readonly string[]>;
  createdAt: string;
}

export function createRuntimeDecisionBlueprint(
  options: RuntimeDecisionBlueprintOptions,
): DecisionBlueprint {
  const tools = Object.entries(options.toolCatalog)
    .map(([tool, actions]) => ({
      tool: tool.trim(),
      actions: [...new Set(actions.map((action) => action.trim()).filter(Boolean))].sort(),
    }))
    .filter((entry) => entry.tool && entry.actions.length > 0)
    .sort((a, b) => a.tool.localeCompare(b.tool))
    .map((entry) => ({
      ...entry,
      allowOfflineQueue: false,
      revalidateBeforeExternalWrite: true,
    }));

  return createDecisionBlueprint({
    id: RUNTIME_DECISION_BLUEPRINT_ID,
    revision: RUNTIME_DECISION_BLUEPRINT_REVISION,
    status: 'active',
    objective:
      'Execute user commands through Janus Core using current continuity, validated planning, authority controls, registered tools and verified delivery.',
    modelPolicy: {
      requiredCapabilities: [],
      preferredCapabilities: ['reasoning', 'tool_use', 'structured_output'],
      preferLocal: true,
      preferLowCost: true,
    },
    agents: [
      {
        id: 'runtime-planner',
        role: 'planner',
        objective: 'Build the smallest valid plan that can satisfy the command.',
        requiredCapabilities: ['reasoning', 'structured_output'],
      },
      {
        id: 'runtime-operator',
        role: 'operator',
        objective: 'Execute only registered tool actions under authority and approval policy.',
        requiredCapabilities: ['tool_use', 'idempotency'],
      },
      {
        id: 'runtime-verifier',
        role: 'verifier',
        objective: 'Verify plan validity, capability readiness, authority and delivery quality.',
        requiredCapabilities: ['verification', 'quality_gates', 'provenance'],
      },
      {
        id: 'runtime-synthesizer',
        role: 'synthesizer',
        objective: 'Deliver concise user-facing results without exposing unsafe payloads.',
        requiredCapabilities: ['reasoning', 'communication'],
      },
    ],
    tools,
    guardrails: [
      {
        id: 'registered-capabilities-only',
        description: 'Only registered tools and actions may execute.',
        condition: 'tool-and-action-must-be-registered-and-ready',
        effect: 'deny',
      },
      {
        id: 'privileged-authority',
        description:
          'Privileged mutations require authenticated administrative authority and idempotency.',
        condition: 'privileged-mutation-requires-authority-and-idempotency',
        effect: 'deny',
      },
      {
        id: 'high-risk-approval',
        description: 'High-risk or irreversible actions require explicit approval.',
        condition: 'high-risk-or-irreversible-action',
        effect: 'require_approval',
      },
      {
        id: 'verified-delivery',
        description: 'Artifacts must pass the Delivery Gate before delivery.',
        condition: 'artifact-boundary',
        effect: 'deny',
      },
    ],
    successMetrics: [
      {
        id: 'validated-plan-rate',
        description: 'Planning decisions accepted by Janus Core validation.',
        direction: 'max',
        target: 1,
      },
      {
        id: 'verified-delivery-rate',
        description: 'Delivered artifacts that passed the Delivery Gate.',
        direction: 'max',
        target: 1,
      },
    ],
    createdAt: options.createdAt,
  });
}

export function ensureDecisionBlueprint(
  store: DecisionTraceStore,
  blueprint: DecisionBlueprint,
): DecisionBlueprint {
  const existing = store.getDecisionBlueprint(blueprint.id, blueprint.revision);
  if (!existing) {
    store.upsertDecisionBlueprint(blueprint);
    return blueprint;
  }

  if (stableJson(existing) !== stableJson(blueprint)) {
    throw new Error(
      'Decision Blueprint ' + blueprint.id + '@' + blueprint.revision
      + ' is immutable; create a new revision instead of mutating it',
    );
  }

  return existing;
}

export interface ChainedDecisionReceiptInput
  extends Omit<
    DecisionReceiptInput,
    'id' | 'blueprintId' | 'blueprintRevision' | 'at' | 'previousReceiptHash'
  > {
  blueprint: DecisionBlueprint;
  id?: string;
  at?: string;
}

export function appendChainedDecisionReceipt(
  store: DecisionTraceStore,
  input: ChainedDecisionReceiptInput,
): DecisionReceipt {
  const receipts = store.listDecisionReceipts(input.runId);
  const previous = receipts.at(-1);
  const receipt = createDecisionReceipt({
    id: input.id ?? 'receipt_' + randomUUID(),
    runId: input.runId,
    blueprintId: input.blueprint.id,
    blueprintRevision: input.blueprint.revision,
    decisionKind: input.decisionKind,
    selectedWorker: input.selectedWorker,
    confidence: input.confidence,
    inputRefs: [...input.inputRefs],
    outputSummary: input.outputSummary,
    at: input.at ?? new Date().toISOString(),
    ...(previous ? { previousReceiptHash: previous.hash } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  store.appendDecisionReceipt(receipt);
  return receipt;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map((item) => stableJson(item)).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + stableJson(record[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
