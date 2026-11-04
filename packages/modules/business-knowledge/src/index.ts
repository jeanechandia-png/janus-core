export type {
  Audience, Billing, EntryInput, IntentResolution, KnowledgeChange, KnowledgeEntry, KnowledgeKind,
  KnowledgeProposal, KnowledgeRevision, KnowledgeSnapshot, KnowledgeState, SnapshotProduct,
  UnresolvedIntent, ValidationCode, ValidationResult, Visibility,
} from './types.js';
export { formatEuros, parseAmountToCents } from './money.js';
export { LIMITS, checkText, validateChange, validateEntryInput, validatePriceCents, validateVatPercent } from './validate.js';
export {
  PROPOSAL_TTL_MS, applyProposal, canonicalJson, createProposal, emptyState, entryKey, replayRevisions,
  sha256Hex, slugify, stateChecksum, validateChanges,
} from './catalog.js';
export { buildReadback, describeProposal, type Readback } from './readback.js';
export {
  buildSnapshot, evaluateConsumerSync, renderKnowledgeText, verifySnapshotChecksum,
  type ConsumerReport, type SyncState,
} from './snapshot.js';
export { fold, parseSpanishUtterance, resolveIntent, resolveProductQuery } from './parse-es.js';
