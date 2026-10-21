import { activeConsent, createConsent } from './consent.js';
import { assertImage } from './image.js';
import type { EncryptedVault } from './vault.js';
import type {
  ConsentInput, ConsentRecord, EnrollmentReport, IdentifyResult, FaceEmbedder, FacePolicy, SubjectSummary,
} from './types.js';

/**
 * Conservative defaults. matchThreshold / minMargin / minEnrollConsistency are MODEL-DEPENDENT cosine values:
 * they MUST be calibrated with the real embedding model and real recordings before the result is trusted
 * (the enrolment report prints the intra-speaker similarity to help).
 */
export const DEFAULT_FACE_POLICY: FacePolicy = Object.freeze({
  minEnrollSamples: 3,
  minEnrollQuality: 0.5,
  matchThreshold: 0.4,
  minMargin: 0.08,
  minEnrollConsistency: 0.3,
});

export interface FaceIdentifierOptions {
  embedder: FaceEmbedder;
  vault: EncryptedVault;
  policy?: Partial<FacePolicy>;
  now?: () => Date;
}

export class EnrollmentRejectedError extends Error {
  constructor(message: string, readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'EnrollmentRejectedError';
  }
}

export function normalizeVector(vector: ArrayLike<number>): number[] {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i]! * vector[i]!;
  const norm = Math.sqrt(sum);
  if (!(norm > 0)) throw new Error('Cannot normalise a zero vector');
  return Array.from({ length: vector.length }, (_, i) => vector[i]! / norm);
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error('Vector dimensions differ');
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class FaceIdentifier {
  private readonly embedder: FaceEmbedder;
  private readonly vault: EncryptedVault;
  private readonly policy: FacePolicy;
  private readonly now: () => Date;

  constructor(options: FaceIdentifierOptions) {
    this.embedder = options.embedder;
    this.vault = options.vault;
    this.policy = { ...DEFAULT_FACE_POLICY, ...options.policy };
    this.now = options.now ?? (() => new Date());
  }

  async grantConsent(input: ConsentInput): Promise<ConsentRecord> {
    const consent = createConsent(input, this.now());
    await this.vault.update((state) => {
      const existing = state.subjects[input.subject.id];
      state.subjects[input.subject.id] = {
        subject: { ...input.subject },
        consents: [...(existing?.consents ?? []), consent],
        ...(existing?.template ? { template: existing.template } : {}),
      };
      state.audit.push({ at: this.now().toISOString(), event: 'consent.granted', subjectId: input.subject.id, detail: `by ${input.grantedBy.id} (${input.grantedBy.relation}); purposes ${consent.purposes.join(',')}` });
    });
    return consent;
  }

  /** Withdraws consent and deletes the face template. */
  async revokeConsent(subjectId: string): Promise<void> {
    await this.vault.update((state) => {
      const stored = state.subjects[subjectId];
      if (!stored) return;
      const at = this.now().toISOString();
      for (const consent of stored.consents) if (!consent.revokedAt) consent.revokedAt = at;
      delete stored.template;
      state.audit.push({ at, event: 'consent.revoked', subjectId, detail: 'template deleted' });
    });
  }

  /** Right to erasure: removes the subject entirely (consents, template). Keeps only an audit line. */
  async forget(subjectId: string): Promise<void> {
    await this.vault.update((state) => {
      delete state.subjects[subjectId];
      state.audit.push({ at: this.now().toISOString(), event: 'forgotten', subjectId });
    });
  }

  async enroll(subjectId: string, photos: readonly Uint8Array[]): Promise<EnrollmentReport> {
    const state = await this.vault.read();
    const stored = state.subjects[subjectId];
    if (!stored || !activeConsent(stored.consents)) throw new EnrollmentRejectedError(`No active consent for subject ${subjectId}`);
    if (photos.length < this.policy.minEnrollSamples) {
      throw new EnrollmentRejectedError(`At least ${this.policy.minEnrollSamples} photos are required`, { received: photos.length });
    }
    const vectors: number[][] = [];
    let modelId = '';
    for (const [index, photo] of photos.entries()) {
      assertImage(photo);
      const embedded = await this.embedder.embed(photo);
      if (embedded.faces !== 1) throw new EnrollmentRejectedError(`Photo ${index + 1} must contain exactly one face (found ${embedded.faces})`, { index, faces: embedded.faces });
      if (embedded.quality !== undefined && embedded.quality < this.policy.minEnrollQuality) {
        throw new EnrollmentRejectedError(`Photo ${index + 1} has too low quality (${embedded.quality}); use good light and look at the camera`, { index, quality: embedded.quality });
      }
      if (modelId && embedded.modelId !== modelId) throw new EnrollmentRejectedError('Embedding model changed during enrolment');
      modelId = embedded.modelId;
      vectors.push(normalizeVector(embedded.vector));
    }
    let min = 1; let sum = 0; let pairs = 0;
    for (let i = 0; i < vectors.length; i += 1) {
      for (let j = i + 1; j < vectors.length; j += 1) {
        const similarity = cosine(vectors[i]!, vectors[j]!);
        min = Math.min(min, similarity); sum += similarity; pairs += 1;
      }
    }
    const mean = pairs ? sum / pairs : 1;
    if (min < this.policy.minEnrollConsistency) {
      throw new EnrollmentRejectedError('Photos are not consistent with each other (different people, angle or light); take them again', { minPairSimilarity: min, required: this.policy.minEnrollConsistency });
    }
    const dim = vectors[0]!.length;
    const centroid = normalizeVector(vectors[0]!.map((_, d) => vectors.reduce((acc, vector) => acc + vector[d]!, 0) / vectors.length));
    const enrolledAt = this.now().toISOString();
    await this.vault.update((draft) => {
      const target = draft.subjects[subjectId];
      if (!target || !activeConsent(target.consents)) throw new EnrollmentRejectedError(`No active consent for subject ${subjectId}`);
      target.template = { modelId, dim, enrolledAt, sampleCount: vectors.length, minPairSimilarity: min, meanPairSimilarity: mean, centroid };
      draft.audit.push({ at: enrolledAt, event: 'enrolled', subjectId, detail: `model ${modelId}; ${vectors.length} photos` });
    });
    return { subjectId, modelId, samples: vectors.length, minPairSimilarity: min, meanPairSimilarity: mean, enrolledAt };
  }

  /** Closed-set identification among consented household members. It never tries to name strangers. */
  async identify(image: Uint8Array): Promise<IdentifyResult> {
    const base = { authorizes: false as const, assurance: 'convenience' as const };
    assertImage(image);
    const state = await this.vault.read();
    const enrolled = Object.values(state.subjects).filter((entry) => entry.template && activeConsent(entry.consents));
    if (enrolled.length === 0) return { ...base, decision: 'unknown', score: 0, margin: 0, candidates: [] };

    const embedded = await this.embedder.embed(image);
    if (embedded.faces === 0) return { ...base, decision: 'no_face', score: 0, margin: 0, candidates: [], modelId: embedded.modelId };
    if (embedded.faces > 1) return { ...base, decision: 'multiple_faces', score: 0, margin: 0, candidates: [], modelId: embedded.modelId };
    const vector = normalizeVector(embedded.vector);
    const candidates = enrolled
      .filter((entry) => entry.template!.modelId === embedded.modelId && entry.template!.dim === vector.length)
      .map((entry) => ({ entry, score: cosine(vector, entry.template!.centroid) }))
      .sort((a, b) => b.score - a.score);
    if (candidates.length === 0) return { ...base, decision: 'unknown', score: 0, margin: 0, candidates: [], modelId: embedded.modelId };

    const best = candidates[0]!;
    const second = candidates[1];
    const margin = best.score - (second?.score ?? 0);
    const summary = candidates.map((candidate) => ({ subjectId: candidate.entry.subject.id, score: round(candidate.score) }));
    if (best.score < this.policy.matchThreshold) {
      return { ...base, decision: 'unknown', score: round(best.score), margin: round(margin), candidates: summary, modelId: embedded.modelId };
    }
    if (second && margin < this.policy.minMargin) {
      return { ...base, decision: 'ambiguous', score: round(best.score), margin: round(margin), candidates: summary, modelId: embedded.modelId };
    }
    return {
      ...base,
      decision: 'match',
      subjectId: best.entry.subject.id,
      displayName: best.entry.subject.displayName,
      role: best.entry.subject.role,
      score: round(best.score),
      margin: round(margin),
      candidates: summary,
      modelId: embedded.modelId,
    };
  }

  /** Metadata only: never returns vectors. */
  async listSubjects(): Promise<SubjectSummary[]> {
    const state = await this.vault.read();
    return Object.values(state.subjects).map((entry) => {
      const consent = activeConsent(entry.consents);
      return {
        subjectId: entry.subject.id,
        displayName: entry.subject.displayName,
        role: entry.subject.role,
        consentActive: Boolean(consent),
        ...(consent ? { consentGrantedBy: `${consent.grantedBy.displayName} (${consent.grantedBy.relation})` } : {}),
        enrolled: Boolean(entry.template),
        ...(entry.template ? { modelId: entry.template.modelId, enrolledAt: entry.template.enrolledAt, sampleCount: entry.template.sampleCount } : {}),
      };
    });
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
