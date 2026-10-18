/**
 * speaker-id — public types. Self-contained LEGO piece: imports only Node built-ins and its own files.
 *
 * INVARIANT: speaker identification here is a CONVENIENCE signal (personalise a greeting, choose a
 * personal/family context). It is never an authentication factor: voices can be cloned or replayed and
 * this module has no liveness/anti-spoofing. Every result carries `authorizes: false` as a literal type.
 */

/** Recognition model plug-in. Replaceable: the module never depends on a specific model. */
export interface SpeakerEmbedder {
  embed(pcm: Uint8Array): Promise<{ vector: Float32Array; modelId: string }>;
}

export type SubjectRole = 'primary_owner' | 'household_adult' | 'household_minor';

export interface SpeakerSubject {
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
  subject: SpeakerSubject;
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

export interface SpeakerPolicy {
  /** Minimum number of enrolment recordings. */
  minEnrollSamples: number;
  /** Minimum speech (after silence removal) per enrolment recording. */
  minSpeechMsPerEnrollSample: number;
  /** Minimum speech needed to attempt identification. */
  minIdentifySpeechMs: number;
  /** Cosine score needed for a match. MODEL-DEPENDENT: calibrate with the real model before relying on it. */
  matchThreshold: number;
  /** Required gap between best and second-best candidate. */
  minMargin: number;
  /** Required minimum pairwise similarity among enrolment recordings (same speaker, same conditions). */
  minEnrollConsistency: number;
}

export type IdentifyDecision = 'match' | 'ambiguous' | 'unknown' | 'insufficient_audio';

export interface IdentifyResult {
  decision: IdentifyDecision;
  subjectId?: string;
  displayName?: string;
  role?: SubjectRole;
  score: number;
  margin: number;
  candidates: ReadonlyArray<{ subjectId: string; score: number }>;
  modelId?: string;
  /** Always false: a voice match can never authorise anything. */
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
  /** Unit-length centroid. Raw recordings and per-sample vectors are NOT kept (data minimisation). */
  centroid: number[];
}

export interface StoredSubject {
  subject: SpeakerSubject;
  consents: ConsentRecord[];
  template?: StoredTemplate;
}

export interface VaultState {
  version: 1;
  subjects: Record<string, StoredSubject>;
  audit: AuditEntry[];
}
