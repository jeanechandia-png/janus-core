import { readyWorkNodes, validateWorkGraph, type WorkGraph, type WorkNodeKind } from './work-graph.js';

export type AgentRole =
  | 'researcher'
  | 'analyst'
  | 'operator'
  | 'builder'
  | 'workflow_architect'
  | 'verifier'
  | 'synthesizer';

export interface SwarmAgent {
  id: string;
  role: AgentRole;
  capabilities: string[];
}

export interface AgentAssignment {
  nodeId: string;
  agentId: string;
  role: AgentRole;
}

export interface AgentSwarmPlan {
  goal: string;
  maxConcurrency: number;
  agents: SwarmAgent[];
  assignments: AgentAssignment[];
}

export function buildAgentSwarm(
  graph: WorkGraph,
  options: { maxAgents?: number; maxConcurrency?: number } = {},
): AgentSwarmPlan {
  const validation = validateWorkGraph(graph);
  if (!validation.ok) throw new Error(validation.errors.join('; '));

  const maxAgents = Math.max(1, options.maxAgents ?? 8);
  const maxConcurrency = Math.max(1, Math.min(options.maxConcurrency ?? 4, maxAgents));
  const agents: SwarmAgent[] = [];
  const assignments: AgentAssignment[] = [];
  const roleAgents = new Map<AgentRole, SwarmAgent[]>();

  for (const node of graph.nodes) {
    const role = roleForNode(node.kind);
    let pool = roleAgents.get(role);
    if (!pool) {
      pool = [];
      roleAgents.set(role, pool);
    }

    let agent = pool
      .slice()
      .sort((a, b) => assignmentCount(a.id, assignments) - assignmentCount(b.id, assignments))[0];

    if ((!agent || assignmentCount(agent.id, assignments) > 0) && agents.length < maxAgents) {
      agent = {
        id: `agent_${String(agents.length + 1).padStart(2, '0')}_${role}`,
        role,
        capabilities: capabilitiesForRole(role),
      };
      agents.push(agent);
      pool.push(agent);
    }

    if (!agent) {
      agent = agents
        .slice()
        .sort((a, b) => assignmentCount(a.id, assignments) - assignmentCount(b.id, assignments))[0]!;
    }

    assignments.push({ nodeId: node.id, agentId: agent.id, role });
  }

  return { goal: graph.goal, maxConcurrency, agents, assignments };
}

export function nextSwarmBatch(
  graph: WorkGraph,
  swarm: AgentSwarmPlan,
  completed: ReadonlySet<string>,
  running: ReadonlySet<string> = new Set<string>(),
): AgentAssignment[] {
  const readyIds = new Set(
    readyWorkNodes(graph, completed)
      .filter((node) => !running.has(node.id))
      .map((node) => node.id),
  );
  const capacity = Math.max(0, swarm.maxConcurrency - running.size);
  return swarm.assignments.filter((assignment) => readyIds.has(assignment.nodeId)).slice(0, capacity);
}

function roleForNode(kind: WorkNodeKind): AgentRole {
  switch (kind) {
    case 'research':
      return 'researcher';
    case 'analysis':
      return 'analyst';
    case 'coding':
      return 'builder';
    case 'agentic_workflow':
      return 'workflow_architect';
    case 'tool':
      return 'operator';
    case 'verification':
      return 'verifier';
    case 'synthesis':
      return 'synthesizer';
  }
}

function capabilitiesForRole(role: AgentRole): string[] {
  switch (role) {
    case 'researcher':
      return ['web_research', 'document_analysis', 'citation'];
    case 'analyst':
      return ['reasoning', 'data_analysis', 'structured_output'];
    case 'operator':
      return ['tool_use', 'workflow_execution', 'idempotency'];
    case 'builder':
      return ['coding', 'architecture', 'debugging', 'testing', 'security_review', 'performance', 'artifact_generation'];
    case 'workflow_architect':
      return ['agentic_workflows', 'multi_agent_orchestration', 'tool_use', 'mcp', 'memory', 'rag', 'human_in_the_loop', 'observability', 'recovery', 'evaluation'];
    case 'verifier':
      return ['verification', 'quality_gates', 'provenance'];
    case 'synthesizer':
      return ['reasoning', 'long_context', 'communication'];
  }
}

function assignmentCount(agentId: string, assignments: readonly AgentAssignment[]): number {
  return assignments.filter((assignment) => assignment.agentId === agentId).length;
}
