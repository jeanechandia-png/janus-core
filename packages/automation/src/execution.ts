import type { AutomationWorkflow, WorkflowNode } from './workflow.js';
import { workflowUpstreamNodeIds } from './workflow.js';

export type WorkflowNodeExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface WorkflowExecutionState {
  workflowId: string;
  workflowRevision: number;
  runId: string;
  nodeStatus: Record<string, WorkflowNodeExecutionStatus>;
  attempts: Record<string, number>;
  completedOutputs: Record<string, unknown>;
  errors: Record<string, string>;
}

export function createWorkflowExecutionState(
  workflow: AutomationWorkflow,
  runId: string,
): WorkflowExecutionState {
  if (!runId.trim()) throw new Error('Workflow execution runId is required');
  return {
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    runId,
    nodeStatus: Object.fromEntries(
      workflow.nodes.map((node) => [node.id, node.disabled ? 'skipped' : 'pending']),
    ),
    attempts: Object.fromEntries(workflow.nodes.map((node) => [node.id, 0])),
    completedOutputs: {},
    errors: {},
  };
}

export function readyWorkflowNodes(
  workflow: AutomationWorkflow,
  state: WorkflowExecutionState,
): WorkflowNode[] {
  assertMatchesWorkflow(workflow, state);
  const ready: WorkflowNode[] = [];

  for (const node of workflow.nodes) {
    const status = state.nodeStatus[node.id];
    if (node.disabled || status === 'completed' || status === 'running' || status === 'failed') continue;
    if (status === 'waiting' || status === 'waiting_approval' || status === 'cancelled' || status === 'skipped') continue;

    const upstream = workflowUpstreamNodeIds(workflow, node.id).filter(
      (id) => state.nodeStatus[id] !== 'skipped',
    );
    if (upstream.every((id) => state.nodeStatus[id] === 'completed')) ready.push(node);
  }

  return ready;
}

export function nextWorkflowBatch(
  workflow: AutomationWorkflow,
  state: WorkflowExecutionState,
): WorkflowNode[] {
  const running = Object.values(state.nodeStatus).filter((status) => status === 'running').length;
  const capacity = Math.max(0, workflow.maxConcurrency - running);
  return readyWorkflowNodes(workflow, state).slice(0, capacity);
}

export function canRetryWorkflowNode(node: WorkflowNode, state: WorkflowExecutionState): boolean {
  const attempts = state.attempts[node.id] ?? 0;
  return attempts < (node.retry?.maxAttempts ?? 1);
}

export function nextRetryDelayMs(node: WorkflowNode, state: WorkflowExecutionState): number {
  const retry = node.retry;
  if (!retry) return 0;
  const attempts = Math.max(1, state.attempts[node.id] ?? 1);
  const delay = retry.backoffMs * 2 ** Math.max(0, attempts - 1);
  return Math.min(delay, retry.maxBackoffMs ?? delay);
}

function assertMatchesWorkflow(
  workflow: AutomationWorkflow,
  state: WorkflowExecutionState,
): void {
  if (workflow.id !== state.workflowId || workflow.revision !== state.workflowRevision) {
    throw new Error('Workflow execution state does not match workflow id/revision');
  }
}
