export const AUTOMATION_WORKFLOW_SCHEMA_VERSION = 1 as const;

export type WorkflowStatus = 'draft' | 'published' | 'historical';
export type WorkflowNodeKind =
  | 'trigger'
  | 'action'
  | 'logic'
  | 'transform'
  | 'code'
  | 'ai'
  | 'subflow'
  | 'wait'
  | 'approval'
  | 'verification';

export type WorkflowExecutionMode = 'deterministic' | 'agentic';
export type WorkflowRisk = 'none' | 'low' | 'medium' | 'high';
export type WorkflowErrorPolicy = 'fail' | 'continue' | 'error_branch';

export interface WorkflowRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs?: number;
}

export interface WorkflowToolOperation {
  tool: string;
  action: string;
}

export interface WorkflowAgentOperation {
  objective: string;
  requiredCapabilities: string[];
  preferredCapabilities?: string[];
  requireLocal?: boolean;
  preferLocal?: boolean;
}

export interface WorkflowNode {
  id: string;
  type: string;
  version: number;
  label: string;
  kind: WorkflowNodeKind;
  executionMode: WorkflowExecutionMode;
  parameters: Record<string, unknown>;
  toolOperation?: WorkflowToolOperation;
  agentOperation?: WorkflowAgentOperation;
  credentialRefs?: string[];
  risk: WorkflowRisk;
  reversible: boolean;
  requiresApproval: boolean;
  timeoutMs?: number;
  retry?: WorkflowRetryPolicy;
  onError?: WorkflowErrorPolicy;
  disabled?: boolean;
}

export interface WorkflowConnection {
  from: string;
  to: string;
  output?: string;
  input?: string;
  branch?: 'success' | 'error' | string;
}

export interface AutomationWorkflow {
  schemaVersion: typeof AUTOMATION_WORKFLOW_SCHEMA_VERSION;
  id: string;
  name: string;
  revision: number;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  maxConcurrency: number;
  executionTimeoutMs?: number;
  tags?: string[];
  createdAt: string;
  supersedesRevision?: number;
}

export interface WorkflowValidationResult {
  ok: boolean;
  errors: string[];
}

export interface WorkflowDiff {
  fromRevision: number;
  toRevision: number;
  addedNodeIds: string[];
  removedNodeIds: string[];
  changedNodeIds: string[];
  connectionChanged: boolean;
  metadataChanged: boolean;
}

export function createAutomationWorkflow(
  input: Omit<AutomationWorkflow, 'schemaVersion' | 'createdAt'> & { createdAt?: string },
): AutomationWorkflow {
  const workflow: AutomationWorkflow = {
    ...input,
    schemaVersion: AUTOMATION_WORKFLOW_SCHEMA_VERSION,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const validation = validateAutomationWorkflow(workflow);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return workflow;
}

export function validateAutomationWorkflow(workflow: AutomationWorkflow): WorkflowValidationResult {
  const errors: string[] = [];
  if (workflow.schemaVersion !== AUTOMATION_WORKFLOW_SCHEMA_VERSION) {
    errors.push(`Unsupported automation workflow schema version: ${workflow.schemaVersion}`);
  }
  if (!workflow.id.trim()) errors.push('Workflow id is required');
  if (!workflow.name.trim()) errors.push('Workflow name is required');
  if (!Number.isInteger(workflow.revision) || workflow.revision < 1) {
    errors.push('Workflow revision must be a positive integer');
  }
  if (!Number.isInteger(workflow.maxConcurrency) || workflow.maxConcurrency < 1) {
    errors.push('Workflow maxConcurrency must be a positive integer');
  }
  if (workflow.nodes.length === 0) errors.push('Workflow requires at least one node');
  if (
    workflow.supersedesRevision !== undefined &&
    workflow.supersedesRevision >= workflow.revision
  ) {
    errors.push('supersedesRevision must be lower than revision');
  }

  const ids = new Set<string>();
  let triggerCount = 0;
  for (const node of workflow.nodes) {
    if (!node.id.trim()) errors.push('Every workflow node requires an id');
    if (ids.has(node.id)) errors.push(`Duplicate workflow node id: ${node.id}`);
    ids.add(node.id);
    if (!node.type.trim()) errors.push(`Workflow node ${node.id} requires a type`);
    if (!node.label.trim()) errors.push(`Workflow node ${node.id} requires a label`);
    if (!Number.isInteger(node.version) || node.version < 1) {
      errors.push(`Workflow node ${node.id} version must be a positive integer`);
    }
    if (node.kind === 'trigger' && !node.disabled) triggerCount += 1;
    if ((node.timeoutMs ?? 1) <= 0) errors.push(`Workflow node ${node.id} timeoutMs must be > 0`);
    if (node.retry) {
      if (!Number.isInteger(node.retry.maxAttempts) || node.retry.maxAttempts < 1) {
        errors.push(`Workflow node ${node.id} retry.maxAttempts must be >= 1`);
      }
      if (node.retry.backoffMs < 0) errors.push(`Workflow node ${node.id} retry.backoffMs must be >= 0`);
      if (
        node.retry.maxBackoffMs !== undefined &&
        node.retry.maxBackoffMs < node.retry.backoffMs
      ) {
        errors.push(`Workflow node ${node.id} retry.maxBackoffMs must be >= backoffMs`);
      }
    }
    if ((node.risk === 'high' || !node.reversible) && !node.requiresApproval) {
      errors.push(`Workflow node ${node.id} requires approval because it is high-risk or irreversible`);
    }

    if (node.executionMode === 'deterministic') {
      const operationRequired =
        node.kind === 'action' || node.kind === 'trigger' || node.kind === 'subflow';
      if (operationRequired && !node.toolOperation) {
        errors.push(`Deterministic workflow node ${node.id} requires toolOperation`);
      }
      if (node.agentOperation) {
        errors.push(`Deterministic workflow node ${node.id} cannot declare agentOperation`);
      }
    } else {
      if (!node.agentOperation?.objective.trim()) {
        errors.push(`Agentic workflow node ${node.id} requires agentOperation.objective`);
      }
      if (node.toolOperation && node.kind !== 'action') {
        errors.push(`Agentic workflow node ${node.id} may only declare toolOperation when kind=action`);
      }
    }

    for (const credentialRef of node.credentialRefs ?? []) {
      if (!credentialRef.trim()) errors.push(`Workflow node ${node.id} has an empty credential reference`);
      if (looksLikeSecret(credentialRef)) {
        errors.push(`Workflow node ${node.id} credentialRefs must contain references, not secret values`);
      }
    }
  }

  if (triggerCount === 0) errors.push('Published-capable workflow requires at least one enabled trigger node');

  for (const connection of workflow.connections) {
    if (!ids.has(connection.from)) errors.push(`Connection references unknown source node: ${connection.from}`);
    if (!ids.has(connection.to)) errors.push(`Connection references unknown target node: ${connection.to}`);
    if (connection.from === connection.to) errors.push(`Workflow node ${connection.from} cannot connect to itself`);
  }

  if (hasCycle(workflow)) {
    errors.push('Workflow graph contains a cycle; use an explicit loop-capable node instead of graph cycles');
  }

  return { ok: errors.length === 0, errors };
}

export function workflowStartNodes(workflow: AutomationWorkflow): WorkflowNode[] {
  const incoming = new Set(workflow.connections.map((connection) => connection.to));
  return workflow.nodes.filter((node) => !node.disabled && !incoming.has(node.id));
}

export function workflowUpstreamNodeIds(workflow: AutomationWorkflow, nodeId: string): string[] {
  return workflow.connections
    .filter((connection) => connection.to === nodeId && connection.branch !== 'error')
    .map((connection) => connection.from);
}

export function workflowErrorTargets(workflow: AutomationWorkflow, nodeId: string): string[] {
  return workflow.connections
    .filter((connection) => connection.from === nodeId && connection.branch === 'error')
    .map((connection) => connection.to);
}

export function diffAutomationWorkflows(
  previous: AutomationWorkflow,
  next: AutomationWorkflow,
): WorkflowDiff {
  if (previous.id !== next.id) throw new Error('Cannot diff workflows with different ids');

  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  const nextNodes = new Map(next.nodes.map((node) => [node.id, node]));
  const addedNodeIds = [...nextNodes.keys()].filter((id) => !previousNodes.has(id)).sort();
  const removedNodeIds = [...previousNodes.keys()].filter((id) => !nextNodes.has(id)).sort();
  const changedNodeIds = [...nextNodes.keys()]
    .filter((id) => previousNodes.has(id))
    .filter((id) => stableJson(previousNodes.get(id)) !== stableJson(nextNodes.get(id)))
    .sort();

  const connectionChanged =
    stableJson(sortedConnections(previous.connections)) !== stableJson(sortedConnections(next.connections));
  const metadataChanged =
    previous.name !== next.name ||
    previous.status !== next.status ||
    previous.maxConcurrency !== next.maxConcurrency ||
    previous.executionTimeoutMs !== next.executionTimeoutMs ||
    stableJson(previous.tags ?? []) !== stableJson(next.tags ?? []);

  return {
    fromRevision: previous.revision,
    toRevision: next.revision,
    addedNodeIds,
    removedNodeIds,
    changedNodeIds,
    connectionChanged,
    metadataChanged,
  };
}

function hasCycle(workflow: AutomationWorkflow): boolean {
  const enabled = new Set(workflow.nodes.filter((node) => !node.disabled).map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  for (const id of enabled) adjacency.set(id, []);
  for (const connection of workflow.connections) {
    if (connection.branch === 'error') continue;
    if (enabled.has(connection.from) && enabled.has(connection.to)) {
      adjacency.get(connection.from)!.push(connection.to);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...enabled].some((id) => visit(id));
}

function looksLikeSecret(value: string): boolean {
  return /^(sk-|ghp_|xox[baprs]-|AKIA|AIza|eyJ[A-Za-z0-9_-]*\.)/.test(value);
}

function sortedConnections(connections: readonly WorkflowConnection[]): WorkflowConnection[] {
  return [...connections].sort((a, b) =>
    `${a.from}|${a.to}|${a.output ?? ''}|${a.input ?? ''}|${a.branch ?? ''}`.localeCompare(
      `${b.from}|${b.to}|${b.output ?? ''}|${b.input ?? ''}|${b.branch ?? ''}`,
    ),
  );
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
