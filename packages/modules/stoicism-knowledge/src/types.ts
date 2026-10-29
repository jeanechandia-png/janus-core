/**
 * stoicism-knowledge — public types. Self-contained LEGO piece: imports nothing outside its own folder.
 */

/**
 * How well a statement is grounded. Never upgrade a label silently.
 * - verified-source: checked in this work against a public source named in `SOURCES` (or the primary text in `MEDITATIONS_TEXT`).
 * - consensus-unverified: standard in the scholarly literature, but NOT re-checked against a source when this module was written.
 * - inference: an interpretation or cross-mapping made by the author of this module (for example "concept A resembles technique B").
 * - unverified: NO VERIFICADO — plausible or reported, but contested or not checked.
 */
export type FactBasis = 'verified-source' | 'consensus-unverified' | 'inference' | 'unverified';

export interface SourceRef {
  id: string;
  title: string;
  url?: string;
  /** What was (and was not) taken from the source. */
  note: string;
  accessed?: string;
}

export interface KeyPassage {
  /** Position of the paragraph inside the edition (NOT necessarily the standard book.section number). */
  paragraph: number;
  /** Spanish gloss written for this module (interpretation). */
  gloss: string;
  /** Exact English wording taken from the paragraph (substring of `MEDITATIONS_TEXT`). */
  excerpt: string;
}

export interface BookDigest {
  /** 1–12. The Meditations has twelve BOOKS, not "tomos". */
  book: number;
  title: string;
  setting: string;
  /** Spanish summary of the whole book (interpretation of the reading, not a translation). */
  summary: string;
  themes: readonly string[];
  keyPassages: readonly KeyPassage[];
}

export type SchoolPhase = 'precursor' | 'old-stoa' | 'middle-stoa' | 'roman-stoa' | 'later';

export interface Figure {
  id: string;
  name: string;
  /** Free text, usually with "c." for approximate dates. Treated as `datesBasis` (default consensus-unverified). */
  dates: string;
  /** Dates are rarely re-checked; when absent they count as consensus-unverified, whatever `basis` says about the rest. */
  datesBasis?: FactBasis;
  phase: SchoolPhase;
  role: string;
  works: string;
  ideas: string;
  basis: FactBasis;
  aliases: readonly string[];
  sourceIds?: readonly string[];
}

export interface Phase {
  id: SchoolPhase;
  title: string;
  period: string;
  summary: string;
  figureIds: readonly string[];
  basis: FactBasis;
}

export interface DoctrineTopic {
  id: string;
  title: string;
  /** Short statement (one or two sentences). */
  summary: string;
  detail: string;
  /** Lower-case, accent-free search keywords (Spanish and English). */
  keywords: readonly string[];
  basis: FactBasis;
  sourceIds?: readonly string[];
  /** Greek term(s) when useful. */
  greek?: string;
}

export interface Practice {
  id: string;
  title: string;
  minutes: number;
  steps: readonly string[];
  /** Where the practice comes from; honest about whether the attribution was checked. */
  origin: string;
  originBasis: FactBasis;
  /** INFERENCE: closest modern technique. Not a claim that the Stoics prescribed it clinically. */
  modernAnalogue?: string;
  keywords: readonly string[];
}

export interface OriginsEpisode {
  id: string;
  title: string;
  period: string;
  text: string;
  keywords: readonly string[];
  basis: FactBasis;
  sourceIds?: readonly string[];
}

export type PsychologyKind = 'influence' | 'parallel' | 'contrast' | 'evidence' | 'caution';

export interface PsychologyLink {
  id: string;
  kind: PsychologyKind;
  title: string;
  text: string;
  keywords: readonly string[];
  basis: FactBasis;
  sourceIds?: readonly string[];
}

export interface GlossaryTerm {
  term: string;
  greek: string;
  meaning: string;
  basis: FactBasis;
}

export interface TimelineEntry {
  year: number;
  /** Negative = BC. Approximate when `approx` is true. */
  approx: boolean;
  label: string;
  basis: FactBasis;
}

export type StoicismTopic =
  | 'overview' | 'history' | 'origins' | 'doctrine' | 'psychology' | 'meditations' | 'practices' | 'glossary' | 'limits';

export interface MeditationsHit {
  book: number;
  paragraph: number;
  score: number;
  /** Short English excerpt around the first match. */
  snippet: string;
  /** True when a Spanish key-passage gloss also matched the query. */
  glossMatch: boolean;
}

export interface StoicismAnswer {
  mode: 'knowledge' | 'support_first';
  topic: StoicismTopic | 'figure' | 'book' | 'passage' | 'search' | 'practice';
  /** Ready-to-send Spanish text, already clipped to `REPLY_LIMIT`. */
  reply: string;
  /** Bases of the statements used (so the caller can show how solid the answer is). */
  bases: readonly FactBasis[];
}
