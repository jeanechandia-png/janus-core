export type WorkNodeKind = 'research' | 'analysis' | 'coding' | 'agentic_workflow' | 'tool' | 'synthesis' | 'verification';

export interface WorkNode {
  id: string;
  label: string;
  kind: WorkNodeKind;
  dependsOn: string[];
  objective: string;
  expectedOutput: string;
}

export interface WorkGraph {
  goal: string;
  nodes: WorkNode[];
}

export function validateWorkGraph(graph: WorkGraph): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const node of graph.nodes) {
    if (!node.id.trim()) errors.push('work node id is required');
    if (ids.has(node.id)) errors.push(`duplicate work node id: ${node.id}`);
    ids.add(node.id);
    if (!node.objective.trim()) errors.push(`work node ${node.id} is missing objective`);
    if (!node.expectedOutput.trim()) errors.push(`work node ${node.id} is missing expected output`);
  }

  for (const node of graph.nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) errors.push(`work node ${node.id} depends on unknown node ${dependency}`);
      if (dependency === node.id) errors.push(`work node ${node.id} cannot depend on itself`);
    }
  }

  if (hasCycle(graph.nodes)) errors.push('work graph contains a dependency cycle');
  return { ok: errors.length === 0, errors };
}

export function readyWorkNodes(graph: WorkGraph, completed: ReadonlySet<string>): WorkNode[] {
  const validation = validateWorkGraph(graph);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  return graph.nodes.filter(
    (node) => !completed.has(node.id) && node.dependsOn.every((dependency) => completed.has(dependency)),
  );
}

function hasCycle(nodes: readonly WorkNode[]): boolean {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = map.get(id);
    for (const dependency of node?.dependsOn ?? []) {
      if (map.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  return nodes.some((node) => visit(node.id));
}
