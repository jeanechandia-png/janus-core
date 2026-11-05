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
  /** Minor subjects (ADR-012): the legal guardian grants, the child's assent is recorded, scope is narrowed. */
  subjectIsMinor?: boolean;
  guardianId?: string;
  guardianRelation?: 'parent' | 'legal_guardian';
  childAssent?: boolean;
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
  if (input.subjectIsMinor) throw new Error('Use createGuardianLikenessConsent for a minor');
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

/** A minor's likeness is voice-only, private to Janus, short-lived and never commercial or public (ADR-012). */
export const MINOR_ALLOWED_MODALITIES: readonly LikenessModality[] = Object.freeze(['voice'] as LikenessModality[]);
export const MINOR_ALLOWED_USES: readonly LikenessUse[] = Object.freeze(['janus_private_assistant', 'internal_lab_test'] as LikenessUse[]);
export const MINOR_ALLOWED_PRODUCTS: readonly string[] = Object.freeze(['janus']);
export const MINOR_MAX_CONSENT_DAYS = 180;

export interface GuardianLikenessConsentInput {
  id: string;
  /** The child (subject of the likeness). */
  principalId: string;
  /** The parent or legal guardian who grants on the child's behalf. Must differ from the child. */
  guardianId: string;
  guardianRelation: 'parent' | 'legal_guardian';
  /** The child's own agreement, recorded by the guardian: no assent, no consent. */
  childAssent: boolean;
  uses: LikenessUse[];
  grantedAt: string;
  expiresAt: string;
  references: LikenessReferenceAsset[];
}

export function createGuardianLikenessConsent(input: GuardianLikenessConsentInput): LikenessConsent {
  if (!input.principalId.trim() || !input.guardianId.trim()) throw new Error('principalId and guardianId are required');
  if (input.guardianId === input.principalId) throw new Error('A minor cannot grant their own likeness consent; a distinct parent or guardian must');
  if (input.childAssent !== true) throw new Error('The child\'s assent must be recorded: without it there is no consent');
  if (!input.uses.length) throw new Error('Consent must be scoped to explicit uses');
  const forbidden = input.uses.filter((use) => !MINOR_ALLOWED_USES.includes(use));
  if (forbidden.length) throw new Error(`Uses not permitted for a minor: ${forbidden.join(', ')}`);
  const grantedMs = Date.parse(input.grantedAt);
  const expiresMs = Date.parse(input.expiresAt);
  if (!(expiresMs > grantedMs)) throw new Error('Consent must expire after it is granted');
  if (expiresMs - grantedMs > MINOR_MAX_CONSENT_DAYS * 86_400_000) throw new Error(`A minor's consent lasts at most ${MINOR_MAX_CONSENT_DAYS} days; renew it with the guardian`);
  if (!input.references.length || input.references.some((reference) => reference.modality !== 'voice')) {
    throw new Error('A minor\'s consent covers voice references only (no face or avatar)');
  }
  for (const reference of input.references) validateReferenceAsset(reference);
  const base = {
    id: input.id,
    principalId: input.principalId,
    grantedBy: input.guardianId,
    modalities: [...MINOR_ALLOWED_MODALITIES],
    uses: input.uses,
    products: [...MINOR_ALLOWED_PRODUCTS],
    grantedAt: input.grantedAt,
    expiresAt: input.expiresAt,
    disclosureRequired: true as const,
    references: input.references,
    subjectIsMinor: true,
    guardianId: input.guardianId,
    guardianRelation: input.guardianRelation,
    childAssent: true,
  };
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
    if (consent.subjectIsMinor && (!MINOR_ALLOWED_USES.includes(request.use) || !MINOR_ALLOWED_MODALITIES.includes(request.modality) || !MINOR_ALLOWED_PRODUCTS.includes(request.product))) continue;
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
