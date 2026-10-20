import { createHash } from 'node:crypto';

// Likeness Consent — reusable LEGO module (ADR-009, owner instruction 2026-10-20).
// One place that decides whether a person's voice or face may be cloned or synthesised.
// Janus uses it for the Founder's own voice clone and digital likeness; any InfinitySeed
// product (ChatBox «Personal Voice Clone», IBA Voice AI, School, Connect) can reuse it unchanged.
// Rules: only the person themself grants consent; consent is scoped, expiring and revocable;
// reference material is referenced locally by checksum, never embedded; every synthetic output
// carries an AI-generated disclosure; synthetic likeness never counts as biometric presence.

export type LikenessModality = 'voice' | 'face' | 'avatar';
export type LikenessUse =
  | 'janus_private_assistant'
  | 'product_demo'
  | 'customer_voice_agent'
  | 'marketing_content'
  | 'internal_lab_test';

export interface LikenessReferenceAsset {
  modality: LikenessModality;
  /** Local path or secure-store reference. Remote URLs are refused. */
  localRef: string;
  sha256: string;
  /** Exact transcript for voice references (required for voice). */
  transcript?: string;
  capturedAt: string;
}

export interface LikenessConsent {
  id: string;
  principalId: string;
  /** Who granted it. Must equal principalId: nobody consents for someone else. */
  grantedBy: string;
  modalities: LikenessModality[];
  uses: LikenessUse[];
  products: string[];
  grantedAt: string;
  expiresAt: string;
  revokedAt?: string;
  disclosureRequired: true;
  references: LikenessReferenceAsset[];
  auditHash: string;
}

export interface LikenessUseRequest {
  principalId: string;
  modality: LikenessModality;
  use: LikenessUse;
  product: string;
  now?: string;
}

export interface LikenessDecision {
  allowed: boolean;
  reason: string;
  consentId?: string;
  disclosure?: string;
}

export const AI_DISCLOSURE: Record<LikenessModality, string> = {
  voice: 'Voz generada con IA a partir de una muestra autorizada.',
  face: 'Imagen generada con IA a partir de una referencia autorizada.',
  avatar: 'Avatar generado con IA a partir de referencias autorizadas.',
};

export function createLikenessConsent(input: Omit<LikenessConsent, 'auditHash' | 'disclosureRequired'>): LikenessConsent {
  if (!input.principalId.trim()) throw new Error('principalId is required');
  if (input.grantedBy !== input.principalId) throw new Error('Likeness consent can only be granted by the person themself');
  if (!input.modalities.length) throw new Error('At least one modality is required');
  if (!input.uses.length || !input.products.length) throw new Error('Consent must be scoped to explicit uses and products');
  if (Date.parse(input.expiresAt) <= Date.parse(input.grantedAt)) throw new Error('Consent must expire after it is granted');
  for (const reference of input.references) validateReferenceAsset(reference);
  for (const modality of input.modalities) {
    if (!input.references.some((reference) => reference.modality === modality || (modality === 'avatar' && reference.modality === 'face'))) {
      throw new Error(`Missing approved reference for modality ${modality}`);
    }
  }
  const base = { ...input, disclosureRequired: true as const };
  return { ...base, auditHash: sha256(stableJson(base)) };
}

export function revokeLikenessConsent(consent: LikenessConsent, revokedAt = new Date().toISOString()): LikenessConsent {
  const base = { ...consent, revokedAt };
  const { auditHash: _previous, ...rest } = base;
  return { ...rest, auditHash: sha256(stableJson(rest)) };
}

export function decideLikenessUse(consents: readonly LikenessConsent[], request: LikenessUseRequest): LikenessDecision {
  const now = request.now ?? new Date().toISOString();
  const candidates = consents.filter((consent) => consent.principalId === request.principalId);
  if (!candidates.length) return { allowed: false, reason: 'No consent on record for this person' };
  for (const consent of candidates) {
    if (consent.revokedAt && consent.revokedAt <= now) continue;
    if (Date.parse(now) >= Date.parse(consent.expiresAt)) continue;
    if (!consent.modalities.includes(request.modality)) continue;
    if (!consent.uses.includes(request.use)) continue;
    if (!consent.products.includes(request.product)) continue;
    return { allowed: true, reason: 'Scoped, active consent', consentId: consent.id, disclosure: AI_DISCLOSURE[request.modality] };
  }
  return { allowed: false, reason: 'Consent is missing, expired, revoked or out of scope for this use' };
}

/** Synthetic likeness can never authenticate anyone (pairs with ADR-008 Identity & Presence). */
export function assertNotPresenceEvidence(evidenceSource: 'live_capture' | 'synthetic'): void {
  if (evidenceSource === 'synthetic') throw new Error('Synthetic voice or face output is never valid presence evidence');
}

export function validateReferenceAsset(reference: LikenessReferenceAsset): void {
  if (/^[a-z]+:\/\//i.test(reference.localRef) && !/^(file|keychain|secure-store|secure-enclave):/i.test(reference.localRef)) {
    throw new Error('Reference material must stay local; remote URLs are refused');
  }
  if (!/^[0-9a-f]{64}$/.test(reference.sha256)) throw new Error('Reference sha256 must be a 64-char hex digest');
  if (reference.modality === 'voice' && !reference.transcript?.trim()) {
    throw new Error('A voice reference needs its exact transcript');
  }
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
