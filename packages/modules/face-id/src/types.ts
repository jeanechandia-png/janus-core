/**
 * face-id — public types. Self-contained LEGO piece: imports only Node built-ins and its own files.
 *
 * INVARIANT: face identification here is a CONVENIENCE signal (greet the right person, choose a personal/family
 * context). It is never an authentication factor: photos and screens can fool it and this module has no
 * liveness/anti-spoofing. Founder authentication stays with ADR-007/008 (platform Face ID, 1:1, liveness).
 * Every result carries `authorizes: false` as a literal type.
 */

/** Recognition model plug-in. Replaceable: the module never depends on a specific model. */
export interface FaceEmbedder {
  /** `faces` is how many faces the detector found; only exactly one is usable. `quality` is 0..1 when the model reports it. */
  embed(image: Uint8Array): Promise<{ vector: Float32Array; modelId: string; faces: number; quality?: number }>;
}

export type SubjectRole = 'primary_owner' | 'household_adult' | 'household_minor';

export interface FaceSubject {
  id: string;
  displayName: string;
  role: SubjectRole;
}

export type ConsentRelation = 'self' | 'parent' | 'legal_guardian';
export type ConsentPurpose = 'personalization' | 'context_routing';

export interface ConsentGrantor {
  id: string;
  displayName: string;
  relation: ConsentRelation;
}

export interface ConsentInput {
  subject: FaceSubject;
  grantedBy: ConsentGrantor;
  purposes: readonly ConsentPurpose[];
  /** Free-text statement of the consent as the grantor gave it (kept as evidence). */
  statement: string;
  grantedAt?: string;
}

export interface ConsentRecord {
  id: string;
  subjectId: string;
  subjectIsMinor: boolean;
  grantedBy: ConsentGrantor;
  purposes: readonly ConsentPurpose[];
  statement: string;
  grantedAt: string;
  revokedAt?: string;
  policyVersion: string;
}

export interface FacePolicy {
  /** Minimum number of enrolment photos. */
  minEnrollSamples: number;
  /** Minimum detector quality (0..1) for an enrolment photo, when the model reports quality. */
  minEnrollQuality: number;
  /** Cosine score needed for a match. MODEL-DEPENDENT: calibrate with the real model before relying on it. */
  matchThreshold: number;
  /** Required gap between best and second-best candidate. */
  minMargin: number;
  /** Required minimum pairwise similarity among enrolment photos (same person). */
  minEnrollConsistency: number;
}

export type IdentifyDecision = 'match' | 'ambiguous' | 'unknown' | 'no_face' | 'multiple_faces';

export interface IdentifyResult {
  decision: IdentifyDecision;
  subjectId?: string;
  displayName?: string;
  role?: SubjectRole;
  score: number;
  margin: number;
  candidates: ReadonlyArray<{ subjectId: string; score: number }>;
  modelId?: string;
  /** Always false: a face match here can never authorise anything. */
  authorizes: false;
  assurance: 'convenience';
}

export interface EnrollmentReport {
  subjectId: string;
  modelId: string;
  samples: number;
  minPairSimilarity: number;
  meanPairSimilarity: number;
  enrolledAt: string;
}

export interface SubjectSummary {
  subjectId: string;
  displayName: string;
  role: SubjectRole;
  consentActive: boolean;
  consentGrantedBy?: string;
  enrolled: boolean;
  modelId?: string;
  enrolledAt?: string;
  sampleCount?: number;
}

export interface AuditEntry {
  at: string;
  event: 'consent.granted' | 'consent.revoked' | 'enrolled' | 'forgotten';
  subjectId: string;
  detail?: string;
}

export interface StoredTemplate {
  modelId: string;
  dim: number;
  enrolledAt: string;
  sampleCount: number;
  minPairSimilarity: number;
  meanPairSimilarity: number;
  /** Unit-length centroid. Raw photos and per-sample vectors are NOT kept (data minimisation). */
  centroid: number[];
}

export interface StoredSubject {
  subject: FaceSubject;
  consents: ConsentRecord[];
  template?: StoredTemplate;
}

export interface VaultState {
  version: 1;
  subjects: Record<string, StoredSubject>;
  audit: AuditEntry[];
}
