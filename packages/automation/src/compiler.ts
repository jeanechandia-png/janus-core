import type { WorkGraph, WorkNode, WorkNodeKind } from '../../orchestrator/src/work-graph.js';
import type { ModelTaskRequirements } from '../../orchestrator/src/model-router.js';
import type { PlannedToolStep } from '../../orchestrator/src/plan.js';
import {
  validateAutomationWorkflow,
  type AutomationWorkflow,
  type WorkflowNode,
} from './workflow.js';

export interface CompiledWorkflowNode {
  id: string;
  workflowNode: WorkflowNode;
  workNode: WorkNode;
  modelRequirements?: ModelTaskRequirements;
  toolStep?: PlannedToolStep;
}

export interface CompiledAutomationWorkflow {
  workflowId: string;
  revision: number;
  workGraph: WorkGraph;
  nodes: CompiledWorkflowNode[];
}

export function compileAutomationWorkflow(
  workflow: AutomationWorkflow,
): CompiledAutomationWorkflow {
  const validation = validateAutomationWorkflow(workflow);
  if (!validation.ok) throw new Error(validation.errors.join('; '));

  const compiledNodes = workflow.nodes
    .filter((node) => !node.disabled)
    .map((node) => compileNode(workflow, node));

  return {
    workflowId: workflow.id,
    revision: workflow.revision,
    workGraph: {
      goal: workflow.name,
      nodes: compiledNodes.map((item) => item.workNode),
    },
    nodes: compiledNodes,
  };
}

function compileNode(
  workflow: AutomationWorkflow,
  node: WorkflowNode,
): CompiledWorkflowNode {
  const dependsOn = workflow.connections
    .filter((connection) => connection.to === node.id && connection.branch !== 'error')
    .map((connection) => connection.from)
    .filter((id) => workflow.nodes.some((candidate) => candidate.id === id && !candidate.disabled));

  const workNode: WorkNode = {
    id: node.id,
    label: node.label,
    kind: mapWorkNodeKind(node),
    dependsOn,
    objective:
      node.executionMode === 'agentic'
        ? node.agentOperation!.objective
        : `Execute ${node.type}@${node.version}: ${node.label}`,
    expectedOutput: `Workflow node ${node.id} completed with observable output`,
  };

  const result: CompiledWorkflowNode = { id: node.id, workflowNode: node, workNode };

  if (node.executionMode === 'agentic') {
    result.modelRequirements = {
      requiredCapabilities: [...(node.agentOperation?.requiredCapabilities ?? [])] as never[],
      preferredCapabilities: [...(node.agentOperation?.preferredCapabilities ?? [])] as never[],
      requireLocal: node.agentOperation?.requireLocal,
      preferLocal: node.agentOperation?.preferLocal,
    };
  }

  if (node.toolOperation) {
    result.toolStep = {
      id: node.id,
      kind: 'tool',
      label: node.label,
      tool: node.toolOperation.tool,
      action: node.toolOperation.action,
      input: { ...node.parameters },
      risk: node.risk,
      reversible: node.reversible,
      requiresApproval: node.requiresApproval,
      ...(isWriteLike(node.toolOperation.action)
        ? { idempotencyKey: `workflow:${workflow.id}:${workflow.revision}:node:${node.id}` }
        : {}),
      resultMode: 'full',
    };
  }

  return result;
}

function mapWorkNodeKind(node: WorkflowNode): WorkNodeKind {
  switch (node.kind) {
    case 'verification':
      return 'verification';
    case 'ai':
    case 'logic':
    case 'transform':
      return 'analysis';
    case 'trigger':
    case 'action':
    case 'code':
    case 'subflow':
    case 'wait':
    case 'approval':
      return 'tool';
  }
}

function isWriteLike(action: string): boolean {
  return /(^|\.)(create|update|delete|send|publish|deploy|pay|purchase)(\.|$)/i.test(action);
}
