import type { AssistantConfigDelivery } from './assistant-config-publisher.js';

/**
 * Known public status endpoints of live assistant consumers (no secrets).
 * Verified 2026-10-13: ChatBox release `7485f058` serves
 * `app/api/v1/assistant-control/status/route.ts`.
 * Override/extend with JANUS_ASSISTANT_STATUS_URLS (JSON surfaceId -> https URL).
 */
export const DEFAULT_ASSISTANT_CONSUMER_STATUS_URLS: Readonly<Record<string, string>> = Object.freeze({
  'landing.infinity-chatbox': 'https://infinitychatbox.nl/api/v1/assistant-control/status',
  // Published to production 2026-10-14 (ChatBox deploy 6acf25de…, PR #80). Live read still to be verified from Janus.
  'landing.infinity-group': 'https://infinitychatbox.nl/api/v1/assistant-control/infinity-group/status',
});

export function resolveConsumerStatusUrls(envValue: string | undefined): Record<string, string> {
  const merged: Record<string, string> = { ...DEFAULT_ASSISTANT_CONSUMER_STATUS_URLS };
  if (!envValue?.trim()) return merged;
  let parsed: unknown;
  try {
    parsed = JSON.parse(envValue);
  } catch {
    throw new Error('JANUS_ASSISTANT_STATUS_URLS must be a JSON object');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JANUS_ASSISTANT_STATUS_URLS must be a JSON object');
  }
  for (const [surfaceId, url] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof url !== 'string' || !url.startsWith('https://')) {
      throw new Error('JANUS_ASSISTANT_STATUS_URLS entries must be https URLs');
    }
    merged[surfaceId] = url;
  }
  return merged;
}

export type ConsumerAcknowledgementEvaluation =
  | { ok: true; observedBundleChecksum: string; acknowledgementSource: string }
  | {
    ok: false;
    code: 'not_published' | 'not_loaded' | 'surface_mismatch' | 'revision_mismatch' | 'checksum_mismatch' | 'malformed';
    reason: string;
    observed?: Record<string, unknown>;
  };

/**
 * `applied` means: the live consumer itself reports it LOADED this exact
 * bundle (same surface, revision and checksum). Publication alone, or a
 * human-typed checksum, is not the same evidence.
 */
export function evaluateConsumerAcknowledgement(input: {
  delivery: AssistantConfigDelivery;
  statusBody: Record<string, unknown>;
  sourceUrl: string;
  observedAt: string;
}): ConsumerAcknowledgementEvaluation {
  const { delivery } = input;
  if (delivery.status !== 'published_verified' && delivery.status !== 'applied') {
    return { ok: false, code: 'not_published', reason: 'delivery must be published_verified before it can be observed as applied' };
  }
  const control = input.statusBody.assistantControl;
  if (!control || typeof control !== 'object' || Array.isArray(control)) {
    return { ok: false, code: 'malformed', reason: 'consumer status has no assistantControl object' };
  }
  const observed = control as Record<string, unknown>;
  const summary = {
    status: observed.status ?? null,
    surfaceId: observed.surfaceId ?? null,
    profileRevision: observed.profileRevision ?? null,
    bundleChecksum: observed.bundleChecksum ?? null,
    error: observed.error ?? null,
  };
  if (observed.status !== 'loaded') {
    return {
      ok: false,
      code: 'not_loaded',
      reason: 'consumer reports status ' + String(observed.status) + (observed.error ? ' (' + String(observed.error) + ')' : ''),
      observed: summary,
    };
  }
  if (observed.surfaceId !== delivery.surfaceId) {
    return { ok: false, code: 'surface_mismatch', reason: 'consumer loaded surface ' + String(observed.surfaceId), observed: summary };
  }
  if (observed.profileRevision !== delivery.profileRevision) {
    return {
      ok: false,
      code: 'revision_mismatch',
      reason: 'consumer loaded revision ' + String(observed.profileRevision) + ', delivery is ' + delivery.profileRevision,
      observed: summary,
    };
  }
  if (typeof observed.bundleChecksum !== 'string' || observed.bundleChecksum !== delivery.bundleChecksum) {
    return { ok: false, code: 'checksum_mismatch', reason: 'consumer checksum differs from the delivered bundle', observed: summary };
  }
  return {
    ok: true,
    observedBundleChecksum: observed.bundleChecksum,
    acknowledgementSource: 'janus-probe:' + input.sourceUrl + '@' + input.observedAt,
  };
}
