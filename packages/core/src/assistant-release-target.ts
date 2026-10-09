import { createHash } from 'node:crypto';

export const ASSISTANT_RELEASE_TARGET_SCHEMA_VERSION = 1 as const;
export const ASSISTANT_RELEASE_TARGET_METADATA_REF = 'infinity/assistant-control-metadata';

export interface AssistantReleaseTargetManifest {
  schemaVersion: typeof ASSISTANT_RELEASE_TARGET_SCHEMA_VERSION;
  surfaceId: string;
  product: string;
  repository: string;
  releaseRef: string;
  releaseHeadSha: string;
  updatedAt: string;
  evidenceRefs: string[];
  checksum: string;
}

export function createAssistantReleaseTargetManifest(
  input: Omit<AssistantReleaseTargetManifest, 'checksum' | 'evidenceRefs'> & {
    evidenceRefs?: readonly string[];
  },
): AssistantReleaseTargetManifest {
  if (input.schemaVersion !== ASSISTANT_RELEASE_TARGET_SCHEMA_VERSION) {
    throw new Error('assistant release target schema version is unsupported');
  }
  const surfaceId = required(input.surfaceId, 'surfaceId');
  const product = required(input.product, 'product');
  const repository = normalizeRepository(input.repository);
  const releaseRef = normalizeBranchRef(input.releaseRef);
  const releaseHeadSha = normalizeCommitSha(input.releaseHeadSha);
  const updatedAt = required(input.updatedAt, 'updatedAt');
  if (!Number.isFinite(Date.parse(updatedAt))) {
    throw new Error('assistant release target updatedAt is invalid');
  }
  const evidenceRefs = cleanStrings(input.evidenceRefs ?? []);
  if (evidenceRefs.length === 0) {
    throw new Error('assistant release target requires at least one evidence reference');
  }

  const unsigned = {
    schemaVersion: ASSISTANT_RELEASE_TARGET_SCHEMA_VERSION,
    surfaceId,
    product,
    repository,
    releaseRef,
    releaseHeadSha,
    updatedAt,
    evidenceRefs,
  };
  return {
    ...unsigned,
    checksum: hash(unsigned),
  };
}

export function verifyAssistantReleaseTargetManifest(
  manifest: AssistantReleaseTargetManifest,
): boolean {
  try {
    return createAssistantReleaseTargetManifest({
      schemaVersion: manifest.schemaVersion,
      surfaceId: manifest.surfaceId,
      product: manifest.product,
      repository: manifest.repository,
      releaseRef: manifest.releaseRef,
      releaseHeadSha: manifest.releaseHeadSha,
      updatedAt: manifest.updatedAt,
      evidenceRefs: manifest.evidenceRefs,
    }).checksum === manifest.checksum;
  } catch {
    return false;
  }
}

export function parseAssistantReleaseTargetManifest(
  content: string,
): AssistantReleaseTargetManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('assistant release target manifest is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('assistant release target manifest must be an object');
  }
  const manifest = parsed as AssistantReleaseTargetManifest;
  if (!verifyAssistantReleaseTargetManifest(manifest)) {
    throw new Error('assistant release target manifest checksum mismatch');
  }
  return createAssistantReleaseTargetManifest({
    schemaVersion: manifest.schemaVersion,
    surfaceId: manifest.surfaceId,
    product: manifest.product,
    repository: manifest.repository,
    releaseRef: manifest.releaseRef,
    releaseHeadSha: manifest.releaseHeadSha,
    updatedAt: manifest.updatedAt,
    evidenceRefs: manifest.evidenceRefs,
  });
}

export function resolveAssistantReleaseTarget(input: {
  manifest: AssistantReleaseTargetManifest;
  surfaceId: string;
  product: string;
  repository: string;
}): AssistantReleaseTargetManifest {
  if (!verifyAssistantReleaseTargetManifest(input.manifest)) {
    throw new Error('assistant release target manifest checksum mismatch');
  }
  const expectedSurfaceId = required(input.surfaceId, 'expected surfaceId');
  const expectedProduct = required(input.product, 'expected product');
  const expectedRepository = normalizeRepository(input.repository);
  if (input.manifest.surfaceId !== expectedSurfaceId) {
    throw new Error('assistant release target surface mismatch');
  }
  if (input.manifest.product !== expectedProduct) {
    throw new Error('assistant release target product mismatch');
  }
  if (input.manifest.repository !== expectedRepository) {
    throw new Error('assistant release target repository mismatch');
  }
  return input.manifest;
}

export function defaultAssistantReleaseTargetPath(productKey?: string): string {
  const normalized = (productKey ?? 'assistant')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) throw new Error('assistant release target product key is invalid');
  return '.infinity/assistant-control/' + normalized + '.release.json';
}

function normalizeRepository(value: string): string {
  const repository = required(value, 'repository');
  const parts = repository.split('/');
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || !/^[A-Za-z0-9_.-]+$/.test(parts[0])
    || !/^[A-Za-z0-9_.-]+$/.test(parts[1])
  ) {
    throw new Error('assistant release target repository is invalid');
  }
  return parts[0] + '/' + parts[1];
}

function normalizeBranchRef(value: string): string {
  const ref = required(value, 'releaseRef');
  if (
    ref.length > 240
    || ref.startsWith('/')
    || ref.endsWith('/')
    || ref.startsWith('refs/')
    || ref.includes('..')
    || ref.includes('@{')
    || /[\\~^:?*\[\]\s]/.test(ref)
  ) {
    throw new Error('assistant release target releaseRef is invalid');
  }
  return ref;
}

function normalizeCommitSha(value: string): string {
  const sha = required(value, 'releaseHeadSha').toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) {
    throw new Error('assistant release target releaseHeadSha is invalid');
  }
  return sha;
}

function cleanStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
