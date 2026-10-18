/**
 * marcus-aurelius-wisdom — public types. Self-contained LEGO piece: imports nothing outside its own folder.
 */

/** How well a passage was checked. */
export type VerificationStatus =
  /**
   * The English wording was read in George Long's public-domain translation (classics.mit.edu, 2026-10-18).
   * The Spanish is a free rendering of that English, NOT of the Greek. The Greek was not consulted, and the
   * book.section number follows the standard numbering but was not visible on the source page.
   */
  | 'text-verified-long'
  /** Widely circulated as Marcus Aurelius's, but no matching passage was located. Never present as verbatim. */
  | 'attributed-unlocated';

export type StressTheme =
  | 'future_worry' | 'past_rumination' | 'time_pressure' | 'overwhelm' | 'anger'
  | 'control_acceptance' | 'adversity' | 'self_review' | 'happiness' | 'present_moment';

export interface MarcusQuote {
  id: string;
  /** English wording as read in Long's translation (omitted for attributed-unlocated quotes). */
  en?: string;
  /** Free Spanish rendering. */
  es: string;
  work: string;
  /** Standard book.section; unchecked on the source page (see VerificationStatus). */
  locus?: string;
  status: VerificationStatus;
  themes: readonly StressTheme[];
  note?: string;
}

export interface MarcusExercise {
  id: string;
  title: string;
  themes: readonly StressTheme[];
  minutes: number;
  steps: readonly string[];
  source: string;
  /** INFERENCE: closest modern technique. Not a claim that Marcus prescribed it clinically. */
  modernAnalogue: string;
  caution?: string;
}

export type FactBasis = 'consensus-unverified';

export interface BiographyFact { id: string; period: string; text: string; basis: FactBasis }
export interface WorkEntry { id: string; title: string; summary: string; stressRelevance?: string; basis: FactBasis }
export interface DoctrinePoint { id: string; title: string; text: string; quoteIds: readonly string[] }

export type ProfileSection = 'overview' | 'life' | 'works' | 'doctrine' | 'modern_psychology' | 'limits';
export type GuidanceMode = 'stoic' | 'support_first';

export interface MarcusGuidance {
  mode: GuidanceMode;
  themes: readonly StressTheme[];
  quotes: readonly MarcusQuote[];
  exercise?: MarcusExercise;
  framing: readonly string[];
  disclaimers: readonly string[];
  /** Ready-to-send Spanish text. Quotes carry their verification status. */
  reply: string;
}
