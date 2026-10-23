export type {
  BiographyFact, DoctrinePoint, FactBasis, GuidanceMode, ProfileSection, SenecaExercise, SenecaGuidance,
  SenecaQuote, StressTheme, VerificationStatus, WorkEntry,
} from './types.js';
export { BIOGRAPHY, DOCTRINE, EXERCISES, LIMITS, MODERN_PSYCHOLOGY, QUOTES, WORKS } from './corpus.js';
export {
  dailyReflection, detectThemes, formatQuote, getProfile, getQuoteById, listExercises, listQuotes,
  mentionsCrisis, mentionsSeneca, normalizeText, selectGuidance, supportFirstGuidance,
} from './guidance.js';
export type { GuidanceOptions } from './guidance.js';
