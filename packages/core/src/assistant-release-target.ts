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
  /**
   * Optional binding to the hosting site whose PUBLISHED deploy is the live
   * truth. When present, the publisher compares the release branch against the
   * published production commit instead of the (possibly newer, unpublished)
   * branch HEAD. Omitted fields do not enter the checksum, so manifests created
   * before this field existed remain valid unchanged.
   */
  deployment?: AssistantReleaseDeploymentBinding;
  checksum: string;
}

export interface AssistantReleaseDeploymentBinding {
  provider: 'netlify';
  siteId: string;
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

  const deployment = normalizeDeployment(input.deployment);
  const unsigned = {
    schemaVersion: ASSISTANT_RELEASE_TARGET_SCHEMA_VERSION,
    surfaceId,
    product,
    repository,
    releaseRef,
    releaseHeadSha,
    updatedAt,
    evidenceRefs,
    ...(deployment ? { deployment } : {}),
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
      deployment: manifest.deployment,
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
    deployment: manifest.deployment,
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

/**
 * Minimal view of a Janus-owned delivery record used to prove custody of a
 * release branch HEAD. Only Janus' own local SQLite deliveries may be passed
 * here; external documents or repository content must never supply links.
 */
export interface ReleaseCustodyDelivery {
  id: string;
  target: string;
  targetRef?: string;
  status: string;
  expectedHeadSha?: string;
  publishedCommitSha?: string;
}

export type ReleaseHeadCustody =
  | { ok: true; mode: 'manifest_head'; chain: [] }
  | { ok: true; mode: 'janus_delivery_lineage'; chain: string[] }
  | { ok: false; reason: string };

const CUSTODY_STATUSES = new Set(['published_verified', 'applied']);
const MAX_CUSTODY_DEPTH = 256;

/**
 * Decide whether the observed release-branch HEAD is still governed by the
 * manifest. The HEAD is accepted when it equals `releaseHeadSha`, or when it
 * is reachable from it exclusively through read-back-verified Janus
 * deliveries on the same repository and ref (each delivery's expected HEAD is
 * the previous link and its published commit is the next one).
 *
 * Any foreign commit breaks the chain and fails closed, so a human or CI push
 * to the release branch still requires a refreshed, re-validated manifest.
 * Without this rule the publisher's own verified commit would make the
 * manifest permanently stale after the first publish.
 */
export function verifyReleaseHeadCustody(input: {
  manifest: AssistantReleaseTargetManifest;
  observedHeadSha: string;
  deliveries: readonly ReleaseCustodyDelivery[];
}): ReleaseHeadCustody {
  const observed = normalizeCommitSha(input.observedHeadSha);
  const start = input.manifest.releaseHeadSha;
  if (observed === start) return { ok: true, mode: 'manifest_head', chain: [] };

  const next = new Map<string, ReleaseCustodyDelivery>();
  for (const delivery of input.deliveries) {
    if (delivery.target !== input.manifest.repository) continue;
    if (delivery.targetRef !== input.manifest.releaseRef) continue;
    if (!CUSTODY_STATUSES.has(delivery.status)) continue;
    if (!delivery.expectedHeadSha || !delivery.publishedCommitSha) continue;
    const from = delivery.expectedHeadSha.toLowerCase();
    const to = delivery.publishedCommitSha.toLowerCase();
    if (from === to) continue;
    const existing = next.get(from);
    if (existing && existing.publishedCommitSha?.toLowerCase() !== to) {
      return {
        ok: false,
        reason: 'release custody is ambiguous: two verified deliveries fork from ' + from,
      };
    }
    next.set(from, delivery);
  }

  const chain: string[] = [];
  const seen = new Set<string>([start]);
  let current = start;
  while (chain.length < MAX_CUSTODY_DEPTH) {
    const link = next.get(current);
    if (!link) break;
    const to = link.publishedCommitSha!.toLowerCase();
    if (seen.has(to)) {
      return { ok: false, reason: 'release custody chain contains a cycle' };
    }
    seen.add(to);
    chain.push(link.id);
    current = to;
    if (current === observed) {
      return { ok: true, mode: 'janus_delivery_lineage', chain };
    }
  }
  return {
    ok: false,
    reason:
      'assistant release target manifest is stale: declared '
      + start
      + ', observed '
      + observed
      + ' is not reachable through verified Janus deliveries',
  };
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

function normalizeDeployment(
  value: AssistantReleaseDeploymentBinding | undefined,
): AssistantReleaseDeploymentBinding | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || value.provider !== 'netlify') {
    throw new Error('assistant release target deployment provider is unsupported');
  }
  const siteId = typeof value.siteId === 'string' ? value.siteId.trim() : '';
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(siteId)) {
    throw new Error('assistant release target deployment siteId is invalid');
  }
  return { provider: 'netlify', siteId };
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
