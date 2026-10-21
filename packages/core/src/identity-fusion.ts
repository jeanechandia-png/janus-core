import type { SpeakerLike } from './speaker-policy.js';

/**
 * Combines convenience identity hints from several modalities (voice, face) into one conservative verdict.
 * Privacy-safe rule: when modalities disagree, the more restricted household profile wins
 * (minor > household_adult > owner). An owner match never overrides a non-owner match.
 * The result is still only a hint: it never authenticates anyone (ADR-005..008 govern privileged actions).
 */
export interface IdentityHintLike {
  decision: string;
  profile?: 'owner' | 'household_adult' | 'minor';
  subjectId?: string;
  score?: number;
}

const RANK: Record<NonNullable<IdentityHintLike['profile']>, number> = { minor: 0, household_adult: 1, owner: 2 };

export function fuseIdentityHints(hints: ReadonlyArray<IdentityHintLike | undefined>): SpeakerLike | undefined {
  const present = hints.filter((hint): hint is IdentityHintLike => Boolean(hint));
  if (present.length === 0) return undefined;
  const matched = present.filter((hint) => hint.decision === 'match' && hint.profile);
  if (matched.length > 0) {
    const strictest = matched.reduce((a, b) => (RANK[b.profile!] < RANK[a.profile!] ? b : a));
    return { decision: 'match', profile: strictest.profile! };
  }
  if (present.some((hint) => hint.decision === 'ambiguous')) return { decision: 'ambiguous' };
  return { decision: 'unknown' };
}
