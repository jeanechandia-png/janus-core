import { createHash, randomUUID } from 'node:crypto';
import type { ResolvedAssistantSurfaceConfig } from './assistant-control-plane.js';

export const ASSISTANT_CONFIG_BUNDLE_SCHEMA_VERSION = 1 as const;

export interface AssistantBundleModule {
  itemId: string;
  revision: number;
  checksum: string;
  kind: string;
}

export interface AssistantConfigBundle {
  schemaVersion: typeof ASSISTANT_CONFIG_BUNDLE_SCHEMA_VERSION;
  surfaceId: string;
  product: string;
  profileId: string;
  profileRevision: number;
  profileChecksum: string;
  surfaceChecksum: string;
  objective: string;
  sharedInstructions: string[];
  guardrails: string[];
  effectiveCapabilities: string[];
  presentation: ResolvedAssistantSurfaceConfig['surface']['presentation'];
  modules: AssistantBundleModule[];
  generatedAt: string;
  bundleChecksum: string;
}

export type AssistantDeliveryStatus =
  | 'desired'
  | 'published'
  | 'published_verified'
  | 'applied'
  | 'failed';

export interface AssistantConfigDelivery {
  id: string;
  surfaceId: string;
  profileId: string;
  profileRevision: number;
  bundleChecksum: string;
  targetKind: 'repository' | 'api' | 'local';
  target: string;
  targetRef?: string;
  targetPath?: string;
  status: AssistantDeliveryStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  attempts: number;
  expectedHeadSha?: string;
  publishedCommitSha?: string;
  externalReference?: string;
  observedBundleChecksum?: string;
  appliedAt?: string;
  acknowledgementSource?: string;
  error?: string;
}

export function createAssistantConfigBundle(input: {
  resolved: ResolvedAssistantSurfaceConfig;
  modules: readonly AssistantBundleModule[];
  generatedAt?: string;
}): AssistantConfigBundle {
  const generatedAt = input.generatedAt ?? (
    Date.parse(input.resolved.surface.updatedAt) >= Date.parse(input.resolved.profile.createdAt)
      ? input.resolved.surface.updatedAt
      : input.resolved.profile.createdAt
  );
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error('assistant config bundle generatedAt is invalid');
  }

  const moduleMap = new Map(input.modules.map((module) => [module.itemId, module] as const));
  const modules = input.resolved.moduleRefs.map((ref) => {
    const resolved = moduleMap.get(ref.itemId);
    if (!resolved) {
      if (ref.optional) return null;
      throw new Error('required assistant bundle module unresolved: ' + ref.itemId);
    }
    if (ref.revision != null && resolved.revision !== ref.revision) {
      throw new Error(
        'assistant bundle module revision mismatch: '
        + ref.itemId
        + ' expected '
        + ref.revision
        + ' got '
        + resolved.revision,
      );
    }
    return {
      itemId: resolved.itemId,
      revision: resolved.revision,
      checksum: required(resolved.checksum, 'module checksum'),
      kind: required(resolved.kind, 'module kind'),
    };
  }).filter((item): item is AssistantBundleModule => item !== null);

  const unsigned = {
    schemaVersion: ASSISTANT_CONFIG_BUNDLE_SCHEMA_VERSION,
    surfaceId: input.resolved.surface.id,
    product: input.resolved.surface.product,
    profileId: input.resolved.profile.profileId,
    profileRevision: input.resolved.profile.revision,
    profileChecksum: input.resolved.profile.checksum,
    surfaceChecksum: input.resolved.surface.checksum,
    objective: input.resolved.profile.objective,
    sharedInstructions: [...input.resolved.profile.sharedInstructions],
    guardrails: [...input.resolved.profile.guardrails],
    effectiveCapabilities: [...input.resolved.effectiveCapabilities],
    presentation: structuredClone(input.resolved.surface.presentation),
    modules,
  };
  return {
    ...unsigned,
    generatedAt,
    bundleChecksum: hash(unsigned),
  };
}

export function verifyAssistantConfigBundle(bundle: AssistantConfigBundle): boolean {
  if (bundle.schemaVersion !== ASSISTANT_CONFIG_BUNDLE_SCHEMA_VERSION) return false;
  const unsigned = {
    schemaVersion: bundle.schemaVersion,
    surfaceId: bundle.surfaceId,
    product: bundle.product,
    profileId: bundle.profileId,
    profileRevision: bundle.profileRevision,
    profileChecksum: bundle.profileChecksum,
    surfaceChecksum: bundle.surfaceChecksum,
    objective: bundle.objective,
    sharedInstructions: bundle.sharedInstructions,
    guardrails: bundle.guardrails,
    effectiveCapabilities: bundle.effectiveCapabilities,
    presentation: bundle.presentation,
    modules: bundle.modules,
  };
  return hash(unsigned) === bundle.bundleChecksum;
}

export function serializeAssistantConfigBundle(bundle: AssistantConfigBundle): string {
  if (!verifyAssistantConfigBundle(bundle)) {
    throw new Error('assistant config bundle integrity check failed');
  }
  return JSON.stringify(bundle, null, 2) + '\n';
}

export function parseAssistantConfigBundle(content: string): AssistantConfigBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('assistant config bundle is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('assistant config bundle must be an object');
  }
  const bundle = parsed as AssistantConfigBundle;
  if (!verifyAssistantConfigBundle(bundle)) {
    throw new Error('assistant config bundle checksum mismatch');
  }
  return bundle;
}

export function createAssistantConfigDelivery(input: {
  surfaceId: string;
  profileId: string;
  profileRevision: number;
  bundleChecksum: string;
  targetKind: AssistantConfigDelivery['targetKind'];
  target: string;
  targetRef?: string;
  targetPath?: string;
  createdBy: string;
  createdAt?: string;
  expectedHeadSha?: string;
}): AssistantConfigDelivery {
  const now = input.createdAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) throw new Error('assistant delivery createdAt is invalid');
  if (!Number.isInteger(input.profileRevision) || input.profileRevision < 1) {
    throw new Error('assistant delivery profileRevision is invalid');
  }
  return {
    id: 'assistant_delivery_' + randomUUID(),
    surfaceId: required(input.surfaceId, 'surfaceId'),
    profileId: required(input.profileId, 'profileId'),
    profileRevision: input.profileRevision,
    bundleChecksum: required(input.bundleChecksum, 'bundleChecksum'),
    targetKind: input.targetKind,
    target: required(input.target, 'target'),
    ...(input.targetRef?.trim() ? { targetRef: input.targetRef.trim() } : {}),
    ...(input.targetPath?.trim() ? { targetPath: input.targetPath.trim() } : {}),
    status: 'desired',
    createdAt: now,
    updatedAt: now,
    createdBy: required(input.createdBy, 'createdBy'),
    attempts: 0,
    ...(input.expectedHeadSha?.trim() ? { expectedHeadSha: input.expectedHeadSha.trim() } : {}),
  };
}

export function markAssistantDeliveryPublished(input: {
  delivery: AssistantConfigDelivery;
  commitSha?: string;
  externalReference?: string;
  verified: boolean;
  updatedAt?: string;
}): AssistantConfigDelivery {
  const now = input.updatedAt ?? new Date().toISOString();
  return {
    ...input.delivery,
    status: input.verified ? 'published_verified' : 'published',
    attempts: input.delivery.attempts + 1,
    updatedAt: now,
    error: undefined,
    ...(input.commitSha?.trim() ? { publishedCommitSha: input.commitSha.trim() } : {}),
    ...(input.externalReference?.trim()
      ? { externalReference: input.externalReference.trim() }
      : {}),
  };
}

export function markAssistantDeliveryFailed(input: {
  delivery: AssistantConfigDelivery;
  error: string;
  updatedAt?: string;
}): AssistantConfigDelivery {
  return {
    ...input.delivery,
    status: 'failed',
    attempts: input.delivery.attempts + 1,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    error: required(input.error, 'delivery error'),
  };
}

export function acknowledgeAssistantDelivery(input: {
  delivery: AssistantConfigDelivery;
  observedBundleChecksum: string;
  acknowledgementSource: string;
  appliedAt?: string;
}): AssistantConfigDelivery {
  if (input.delivery.status !== 'published_verified' && input.delivery.status !== 'applied') {
    throw new Error('assistant delivery must be published_verified before acknowledgement');
  }
  const checksum = required(input.observedBundleChecksum, 'observedBundleChecksum');
  if (checksum !== input.delivery.bundleChecksum) {
    throw new Error('assistant delivery acknowledgement checksum mismatch');
  }
  const appliedAt = input.appliedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(appliedAt))) {
    throw new Error('assistant delivery appliedAt is invalid');
  }
  return {
    ...input.delivery,
    status: 'applied',
    observedBundleChecksum: checksum,
    acknowledgementSource: required(input.acknowledgementSource, 'acknowledgementSource'),
    appliedAt,
    updatedAt: appliedAt,
    error: undefined,
  };
}

export function defaultAssistantBundlePath(productKey?: string): string {
  const normalized = (productKey ?? 'assistant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new Error('assistant bundle product key is invalid');
  return '.infinity/assistant-control/' + normalized + '.json';
}

function required(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(label + ' is required');
  return trimmed;
}

function hash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + stableJson(record[key]))
      .join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
