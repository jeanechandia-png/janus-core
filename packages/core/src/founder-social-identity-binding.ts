import { createHash } from 'node:crypto';
import type { ChronologyRecord } from './continuity.js';
import type { FounderSocialPlatform } from './founder-social-sources.js';

export interface FounderSocialIdentityBindingInput {
  referenceId: string;
  platform: FounderSocialPlatform;
  sourceUrl: string;
  canonicalTargetUrl?: string;
  graphEntityId?: string;
  evidenceRefs: string[];
  verifiedAt: string;
  verifiedBy: string;
}

export interface FounderSocialIdentityBinding extends FounderSocialIdentityBindingInput {
  state: 'canonical_resolved' | 'graph_bound';
}

export function validateFounderSocialIdentityBinding(
  input: FounderSocialIdentityBindingInput,
): FounderSocialIdentityBinding {
  const referenceId = safeId(input.referenceId, 'referenceId');
  const verifiedBy = safeId(input.verifiedBy, 'verifiedBy');
  const verifiedAt = validIso(input.verifiedAt, 'verifiedAt');
  const sourceUrl = httpsUrl(input.sourceUrl, 'sourceUrl');
  const canonicalTargetUrl = optionalHttpsUrl(input.canonicalTargetUrl, 'canonicalTargetUrl');
  const graphEntityId = optionalGraphEntityId(input.graphEntityId);
  const evidenceRefs = evidenceReferenceList(input.evidenceRefs);

  if (!canonicalTargetUrl && !graphEntityId) {
    throw new Error('Founder social binding requires a canonical target URL or Graph entity ID');
  }
  if (canonicalTargetUrl && !urlMatchesPlatform(canonicalTargetUrl, input.platform)) {
    throw new Error('canonicalTargetUrl does not match the declared social platform');
  }
  if (!urlMatchesPlatform(sourceUrl, input.platform)) {
    throw new Error('sourceUrl does not match the declared social platform');
  }
  if (input.platform === 'facebook' && graphEntityId && !canonicalTargetUrl) {
    throw new Error('Facebook Graph binding requires an authoritative canonical target URL first');
  }

  return {
    referenceId,
    platform: input.platform,
    sourceUrl,
    ...(canonicalTargetUrl ? { canonicalTargetUrl } : {}),
    ...(graphEntityId ? { graphEntityId } : {}),
    evidenceRefs,
    verifiedAt,
    verifiedBy,
    state: graphEntityId ? 'graph_bound' : 'canonical_resolved',
  };
}

export function founderSocialIdentityBindingChronologyRecord(input: {
  binding: FounderSocialIdentityBinding;
  previous?: ChronologyRecord;
}): ChronologyRecord {
  const binding = validateFounderSocialIdentityBinding(input.binding);
  return {
    id:
      'founder-social-binding:'
      + binding.referenceId
      + ':'
      + timestampId(binding.verifiedAt)
      + ':'
      + bindingContentId(binding),
    sessionId: 'founder-social-source-registry',
    at: binding.verifiedAt,
    kind: 'verification',
    subject: 'founder-social-binding:' + binding.referenceId,
    content:
      'Verified Founder social identity binding for '
      + binding.referenceId
      + ' ('
      + binding.platform
      + ', '
      + binding.state
      + ').',
    status: 'current',
    ...(input.previous ? { supersedesId: input.previous.id } : {}),
    metadata: {
      referenceId: binding.referenceId,
      platform: binding.platform,
      sourceUrl: binding.sourceUrl,
      canonicalTargetUrl: binding.canonicalTargetUrl ?? null,
      graphEntityId: binding.graphEntityId ?? null,
      evidenceRefs: binding.evidenceRefs,
      verifiedAt: binding.verifiedAt,
      verifiedBy: binding.verifiedBy,
      state: binding.state,
      source: 'founder-social-identity-binding',
    },
  };
}

export function founderSocialIdentityBindingFromChronology(
  record: ChronologyRecord | undefined,
): FounderSocialIdentityBinding | undefined {
  if (!record || !record.subject.startsWith('founder-social-binding:')) return undefined;
  const metadata = record.metadata ?? {};
  const platform = metadata.platform === 'facebook' || metadata.platform === 'instagram'
    ? metadata.platform
    : undefined;
  if (!platform) return undefined;
  try {
    return validateFounderSocialIdentityBinding({
      referenceId: typeof metadata.referenceId === 'string' ? metadata.referenceId : '',
      platform,
      sourceUrl: typeof metadata.sourceUrl === 'string' ? metadata.sourceUrl : '',
      canonicalTargetUrl:
        typeof metadata.canonicalTargetUrl === 'string'
          ? metadata.canonicalTargetUrl
          : undefined,
      graphEntityId:
        typeof metadata.graphEntityId === 'string'
          ? metadata.graphEntityId
          : undefined,
      evidenceRefs: Array.isArray(metadata.evidenceRefs)
        ? metadata.evidenceRefs.filter((value): value is string => typeof value === 'string')
        : [],
      verifiedAt: typeof metadata.verifiedAt === 'string' ? metadata.verifiedAt : '',
      verifiedBy: typeof metadata.verifiedBy === 'string' ? metadata.verifiedBy : '',
    });
  } catch {
    return undefined;
  }
}

function safeId(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(label + ' is required');
  const result = value.trim();
  if (!result || result.length > 240 || !/^[A-Za-z0-9_.:-]+$/.test(result)) {
    throw new Error(label + ' is invalid');
  }
  return result;
}

function validIso(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(label + ' must be an ISO timestamp');
  }
  return value.trim();
}

function httpsUrl(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 3000) {
    throw new Error(label + ' is required');
  }
  const result = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    throw new Error(label + ' must be a valid URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error(label + ' must be a credential-free HTTPS URL');
  }
  if (containsCredentialLikeQuery(parsed)) {
    throw new Error(label + ' must not contain access-token style query parameters');
  }
  return result;
}

function optionalHttpsUrl(value: unknown, label: string): string | undefined {
  if (value == null || value === '') return undefined;
  return httpsUrl(value, label);
}

function optionalGraphEntityId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error('graphEntityId is invalid');
  const result = value.trim();
  if (!result || result.length > 200 || !/^[A-Za-z0-9_.:-]+$/.test(result)) {
    throw new Error('graphEntityId is invalid');
  }
  return result;
}

function evidenceReferenceList(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('evidenceRefs must be an array');
  const result = [...new Set(value.map((item) => {
    if (typeof item !== 'string') throw new Error('evidenceRefs contains an invalid value');
    const ref = item.trim();
    if (!ref || ref.length > 1000) throw new Error('evidenceRefs contains an invalid value');
    if (/access[_-]?token\s*=|bearer\s+[A-Za-z0-9._~-]+/i.test(ref)) {
      throw new Error('evidenceRefs must not contain credentials');
    }
    return ref;
  }))].slice(0, 25);
  if (result.length === 0) throw new Error('At least one evidence reference is required');
  return result;
}

function urlMatchesPlatform(value: string, platform: FounderSocialPlatform): boolean {
  const host = new URL(value).hostname.toLowerCase();
  const expected = platform === 'facebook' ? 'facebook.com' : 'instagram.com';
  return host === expected || host.endsWith('.' + expected);
}

function containsCredentialLikeQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (/access[_-]?token|auth[_-]?token|api[_-]?key|secret/i.test(key)) return true;
  }
  return false;
}

function timestampId(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 17);
}

function bindingContentId(binding: FounderSocialIdentityBinding): string {
  return createHash('sha256')
    .update(JSON.stringify({
      referenceId: binding.referenceId,
      platform: binding.platform,
      sourceUrl: binding.sourceUrl,
      canonicalTargetUrl: binding.canonicalTargetUrl ?? null,
      graphEntityId: binding.graphEntityId ?? null,
      evidenceRefs: binding.evidenceRefs,
      verifiedAt: binding.verifiedAt,
      verifiedBy: binding.verifiedBy,
      state: binding.state,
    }))
    .digest('hex')
    .slice(0, 12);
}
