import type { WorkflowNode, WorkflowNodeKind } from './workflow.js';

export type AutomationNodeAvailability = 'available' | 'needs_auth' | 'disabled' | 'unavailable';

export interface AutomationNodeManifest {
  type: string;
  version: number;
  displayName: string;
  kind: WorkflowNodeKind;
  executionModes: Array<'deterministic' | 'agentic'>;
  capabilities: string[];
  availability: AutomationNodeAvailability;
  credentialKinds?: string[];
  reason?: string;
}

export interface NodeCompatibilityResult {
  ok: boolean;
  errors: string[];
}

export class AutomationNodeRegistry {
  private readonly manifests = new Map<string, AutomationNodeManifest>();

  register(manifest: AutomationNodeManifest): void {
    validateManifest(manifest);
    const key = nodeKey(manifest.type, manifest.version);
    if (this.manifests.has(key)) throw new Error(`Automation node already registered: ${key}`);
    this.manifests.set(key, {
      ...manifest,
      executionModes: [...manifest.executionModes],
      capabilities: [...manifest.capabilities],
      credentialKinds: manifest.credentialKinds ? [...manifest.credentialKinds] : undefined,
    });
  }

  setAvailability(
    type: string,
    version: number,
    availability: AutomationNodeAvailability,
    reason?: string,
  ): void {
    const key = nodeKey(type, version);
    const current = this.manifests.get(key);
    if (!current) throw new Error(`Automation node not registered: ${key}`);
    this.manifests.set(key, { ...current, availability, reason });
  }

  get(type: string, version: number): AutomationNodeManifest | undefined {
    const manifest = this.manifests.get(nodeKey(type, version));
    return manifest
      ? {
          ...manifest,
          executionModes: [...manifest.executionModes],
          capabilities: [...manifest.capabilities],
          credentialKinds: manifest.credentialKinds ? [...manifest.credentialKinds] : undefined,
        }
      : undefined;
  }

  checkNode(node: WorkflowNode): NodeCompatibilityResult {
    const manifest = this.manifests.get(nodeKey(node.type, node.version));
    if (!manifest) {
      return { ok: false, errors: [`Node type not registered: ${node.type}@${node.version}`] };
    }
    const errors: string[] = [];
    if (manifest.availability !== 'available') {
      errors.push(
        manifest.reason ?? `Node ${node.type}@${node.version} is ${manifest.availability}`,
      );
    }
    if (manifest.kind !== node.kind) {
      errors.push(
        `Node kind mismatch for ${node.id}: workflow=${node.kind}, registry=${manifest.kind}`,
      );
    }
    if (!manifest.executionModes.includes(node.executionMode)) {
      errors.push(
        `Execution mode ${node.executionMode} is not supported by ${node.type}@${node.version}`,
      );
    }
    return { ok: errors.length === 0, errors };
  }

  snapshot(): AutomationNodeManifest[] {
    return [...this.manifests.values()]
      .map((manifest) => ({
        ...manifest,
        executionModes: [...manifest.executionModes],
        capabilities: [...manifest.capabilities],
        credentialKinds: manifest.credentialKinds ? [...manifest.credentialKinds] : undefined,
      }))
      .sort((a, b) => nodeKey(a.type, a.version).localeCompare(nodeKey(b.type, b.version)));
  }
}

function validateManifest(manifest: AutomationNodeManifest): void {
  if (!manifest.type.trim()) throw new Error('Automation node manifest type is required');
  if (!Number.isInteger(manifest.version) || manifest.version < 1) {
    throw new Error('Automation node manifest version must be a positive integer');
  }
  if (!manifest.displayName.trim()) throw new Error('Automation node displayName is required');
  if (manifest.executionModes.length === 0) {
    throw new Error(`Automation node ${manifest.type} must support at least one execution mode`);
  }
}

function nodeKey(type: string, version: number): string {
  return `${type.trim()}@${version}`;
}
