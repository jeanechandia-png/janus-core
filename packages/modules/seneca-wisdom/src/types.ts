/**
 * seneca-wisdom — public types. This module is a self-contained LEGO piece:
 * it imports nothing outside its own folder (only Node built-ins, and currently not even those).
 */

/** How well the passage/location was checked against a primary source. */
export type VerificationStatus =
  /** Latin text and locus were read in a primary-source edition during curation. */
  | 'verified-primary'
  /** Genuinely Senecan by long scholarly tradition, but the locus was not re-checked during curation. */
  | 'locus-unverified'
  /** Widely circulated as Seneca's, but no passage in his works was located. Never present it as a verbatim quotation. */
  | 'attributed-unlocated';

export type StressTheme =
  | 'future_worry'
  | 'past_rumination'
  | 'time_pressure'
  | 'overwhelm'
  | 'anger'
  | 'control_acceptance'
  | 'adversity'
  | 'self_review'
  | 'happiness'
  | 'present_moment';

export interface SenecaQuote {
  id: string;
  /** Latin original when the passage is verified; omitted for attributed-unlocated quotes. */
  latin?: string;
  /** Spanish rendering. For Latin passages this is a free translation made for this module. */
  es: string;
  work: string;
  locus?: string;
  status: VerificationStatus;
  themes: readonly StressTheme[];
  note?: string;
}

export interface SenecaExercise {
  id: string;
  title: string;
  themes: readonly StressTheme[];
  minutes: number;
  steps: readonly string[];
  /** Where in Seneca the practice comes from. */
  source: string;
  /** INFERENCE: closest modern technique. Not a claim that Seneca prescribed it clinically. */
  modernAnalogue: string;
  caution?: string;
}

export type FactBasis = 'secondary-verified' | 'consensus-unverified';

export interface BiographyFact {
  id: string;
  period: string;
  text: string;
  basis: FactBasis;
}

export interface WorkEntry {
  id: string;
  title: string;
  latinTitle: string;
  kind: 'letters' | 'dialogue' | 'consolation' | 'treatise' | 'natural-science' | 'satire' | 'tragedy';
  summary: string;
  stressRelevance?: string;
  basis: FactBasis;
}

export interface DoctrinePoint {
  id: string;
  title: string;
  text: string;
  basis: 'primary-read' | 'consensus-unverified';
  quoteIds: readonly string[];
}

export type ProfileSection = 'overview' | 'life' | 'works' | 'doctrine' | 'modern_psychology' | 'limits';

export type GuidanceMode = 'stoic' | 'support_first';

export interface SenecaGuidance {
  mode: GuidanceMode;
  themes: readonly StressTheme[];
  quotes: readonly SenecaQuote[];
  exercise?: SenecaExercise;
  /** Short framing sentences for an assistant to weave into its own words. */
  framing: readonly string[];
  disclaimers: readonly string[];
  /** Ready-to-send Spanish text. Quotes carry their attribution status. */
  reply: string;
}
