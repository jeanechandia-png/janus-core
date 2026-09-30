export const KERNEL_PERSISTENCE_SCHEMA_VERSION = 1 as const;

export interface WorkGraphSnapshotNode {
  id: string;
  label: string;
  kind: string;
  dependsOn: string[];
  objective: string;
  expectedOutput: string;
}

export interface WorkGraphSnapshot {
  schemaVersion: typeof KERNEL_PERSISTENCE_SCHEMA_VERSION;
  id: string;
  runId?: string;
  goal: string;
  nodes: WorkGraphSnapshotNode[];
  completedNodeIds: string[];
  runningNodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CitationLedgerSnapshot<TLedger = unknown> {
  schemaVersion: typeof KERNEL_PERSISTENCE_SCHEMA_VERSION;
  id: string;
  runId?: string;
  ledger: TLedger;
  createdAt: string;
  updatedAt: string;
}

export interface ImprovementIndexHistoryEntry<TIndex = unknown> {
  schemaVersion: typeof KERNEL_PERSISTENCE_SCHEMA_VERSION;
  scopeId: string;
  generatedAt: string;
  index: TIndex;
}

export function createWorkGraphSnapshot(
  input: Omit<WorkGraphSnapshot, 'schemaVersion'>,
): WorkGraphSnapshot {
  if (!input.id.trim()) throw new Error('Work Graph snapshot id is required');
  if (!input.goal.trim()) throw new Error('Work Graph goal is required');

  const ids = new Set<string>();
  for (const node of input.nodes) {
    if (!node.id.trim()) throw new Error('Work Graph node id is required');
    if (ids.has(node.id)) throw new Error(`Duplicate Work Graph node id: ${node.id}`);
    ids.add(node.id);
  }
  for (const node of input.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) {
        throw new Error(`Work Graph node ${node.id} depends on unknown node ${dependency}`);
      }
    }
  }

  return {
    ...input,
    schemaVersion: KERNEL_PERSISTENCE_SCHEMA_VERSION,
    nodes: input.nodes.map((node) => ({ ...node, dependsOn: [...node.dependsOn] })),
    completedNodeIds: [...input.completedNodeIds],
    runningNodeIds: [...input.runningNodeIds],
  };
}

export function createCitationLedgerSnapshot<TLedger>(
  input: Omit<CitationLedgerSnapshot<TLedger>, 'schemaVersion'>,
): CitationLedgerSnapshot<TLedger> {
  if (!input.id.trim()) throw new Error('Citation Ledger snapshot id is required');
  return {
    ...input,
    schemaVersion: KERNEL_PERSISTENCE_SCHEMA_VERSION,
  };
}
