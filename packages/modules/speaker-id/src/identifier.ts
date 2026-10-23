import { activeConsent, createConsent } from './consent.js';
import { pcmDurationMs, trimToSpeech } from './pcm.js';
import type { EncryptedVault } from './vault.js';
import type {
  ConsentInput, ConsentRecord, EnrollmentReport, IdentifyResult, SpeakerEmbedder, SpeakerPolicy, SubjectSummary,
} from './types.js';

/**
 * Conservative defaults. matchThreshold / minMargin / minEnrollConsistency are MODEL-DEPENDENT cosine values:
 * they MUST be calibrated with the real embedding model and real recordings before the result is trusted
 * (the enrolment report prints the intra-speaker similarity to help).
 */
export const DEFAULT_SPEAKER_POLICY: SpeakerPolicy = Object.freeze({
  minEnrollSamples: 3,
  minSpeechMsPerEnrollSample: 2500,
  minIdentifySpeechMs: 1500,
  matchThreshold: 0.55,
  minMargin: 0.1,
  minEnrollConsistency: 0.45,
});

export interface SpeakerIdentifierOptions {
  embedder: SpeakerEmbedder;
  vault: EncryptedVault;
  policy?: Partial<SpeakerPolicy>;
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

export class SpeakerIdentifier {
  private readonly embedder: SpeakerEmbedder;
  private readonly vault: EncryptedVault;
  private readonly policy: SpeakerPolicy;
  private readonly now: () => Date;

  constructor(options: SpeakerIdentifierOptions) {
    this.embedder = options.embedder;
    this.vault = options.vault;
    this.policy = { ...DEFAULT_SPEAKER_POLICY, ...options.policy };
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

  /** Withdraws consent and deletes the voiceprint. */
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

  async enroll(subjectId: string, recordings: readonly Uint8Array[]): Promise<EnrollmentReport> {
    const state = await this.vault.read();
    const stored = state.subjects[subjectId];
    if (!stored || !activeConsent(stored.consents)) throw new EnrollmentRejectedError(`No active consent for subject ${subjectId}`);
    if (recordings.length < this.policy.minEnrollSamples) {
      throw new EnrollmentRejectedError(`At least ${this.policy.minEnrollSamples} recordings are required`, { received: recordings.length });
    }
    const vectors: number[][] = [];
    let modelId = '';
    for (const [index, recording] of recordings.entries()) {
      const speech = trimToSpeech(recording);
      const speechMs = pcmDurationMs(speech.byteLength);
      if (speechMs < this.policy.minSpeechMsPerEnrollSample) {
        throw new EnrollmentRejectedError(`Recording ${index + 1} has too little speech (${Math.round(speechMs)} ms)`, { index, speechMs });
      }
      const embedded = await this.embedder.embed(speech);
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
      throw new EnrollmentRejectedError('Recordings are not consistent with each other (different speakers, noise or channel); record again in a quiet place', { minPairSimilarity: min, required: this.policy.minEnrollConsistency });
    }
    const dim = vectors[0]!.length;
    const centroid = normalizeVector(vectors[0]!.map((_, d) => vectors.reduce((acc, vector) => acc + vector[d]!, 0) / vectors.length));
    const enrolledAt = this.now().toISOString();
    await this.vault.update((draft) => {
      const target = draft.subjects[subjectId];
      if (!target || !activeConsent(target.consents)) throw new EnrollmentRejectedError(`No active consent for subject ${subjectId}`);
      target.template = { modelId, dim, enrolledAt, sampleCount: vectors.length, minPairSimilarity: min, meanPairSimilarity: mean, centroid };
      draft.audit.push({ at: enrolledAt, event: 'enrolled', subjectId, detail: `model ${modelId}; ${vectors.length} recordings` });
    });
    return { subjectId, modelId, samples: vectors.length, minPairSimilarity: min, meanPairSimilarity: mean, enrolledAt };
  }

  /** Closed-set identification among consented household members. It never tries to name strangers. */
  async identify(pcm: Uint8Array): Promise<IdentifyResult> {
    const base = { authorizes: false as const, assurance: 'convenience' as const };
    const speech = trimToSpeech(pcm);
    if (pcmDurationMs(speech.byteLength) < this.policy.minIdentifySpeechMs) {
      return { ...base, decision: 'insufficient_audio', score: 0, margin: 0, candidates: [] };
    }
    const state = await this.vault.read();
    const enrolled = Object.values(state.subjects).filter((entry) => entry.template && activeConsent(entry.consents));
    if (enrolled.length === 0) return { ...base, decision: 'unknown', score: 0, margin: 0, candidates: [] };

    const embedded = await this.embedder.embed(speech);
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
