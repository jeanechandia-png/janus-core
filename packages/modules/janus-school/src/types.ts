/**
 * janus-school — public types. Self-contained LEGO piece (imports nothing outside its folder).
 * All content is bundled: the module works offline. State is plain JSON passed in and out; the host persists it.
 */
export type Track = 'founder' | 'kids';

export interface QuizItem {
  id: string;
  question: string;
  options: readonly string[];
  /** Index of the correct option. */
  answer: number;
  why: string;
}

export interface Lesson {
  id: string;
  track: 'founder';
  unit: number;
  title: string;
  minutes: number;
  objective: string;
  keyIdeas: readonly string[];
  analogy: string;
  /** Concrete questions the learner can ask a programmer/engineer about this topic. */
  askTheExpert: readonly string[];
  checks: readonly QuizItem[];
  termIds: readonly string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  area: string;
  plain: string;
  analogy: string;
  aliases?: readonly string[];
}

export type EvidenceLevel = 'guideline-summary' | 'research-mixed' | 'practice-consensus';

export interface EvidenceNote {
  id: string;
  level: EvidenceLevel;
  claim: string;
  source: string;
  url?: string;
}

export interface KidTechnique {
  id: string;
  title: string;
  skill: string;
  ageBands: readonly AgeBand[];
  minutes: number;
  whyItHelps: string;
  steps: readonly string[];
  materials: readonly string[];
  evidenceIds: readonly string[];
  caution?: string;
}

export type AgeBand = '5-7' | '8-10' | '11-13';
export type Energy = 'low' | 'normal' | 'high';

export interface SessionBlock {
  kind: 'move' | 'focus' | 'break' | 'play' | 'wrap';
  minutes: number;
  title: string;
  instructions: readonly string[];
}

export interface KidSessionPlan {
  totalMinutes: number;
  ageBand: AgeBand | 'unspecified';
  energy: Energy;
  blocks: readonly SessionBlock[];
  notes: readonly string[];
  /** Plain-Spanish message to read to the child. */
  childScript: string;
}

export interface CardState {
  ease: number;
  intervalDays: number;
  repetitions: number;
  dueAt: string;
  lapses: number;
}

export interface LearnerProgress {
  learnerId: string;
  track: Track;
  completedLessons: readonly string[];
  cards: Readonly<Record<string, CardState>>;
  /** Minimal by design: counts only, no free text, no audio, no images. */
  answered: number;
  correct: number;
  updatedAt: string;
}
