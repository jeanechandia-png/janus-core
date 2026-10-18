export type {
  AuditEntry, ConsentGrantor, ConsentInput, ConsentPurpose, ConsentRecord, ConsentRelation, EnrollmentReport,
  IdentifyDecision, IdentifyResult, SpeakerEmbedder, SpeakerPolicy, SpeakerSubject, StoredSubject, StoredTemplate,
  SubjectRole, SubjectSummary, VaultState,
} from './types.js';
export { ALLOWED_PURPOSES, CONSENT_POLICY_VERSION, activeConsent, createConsent } from './consent.js';
export { PCM_SAMPLE_RATE, UtteranceAudioBuffer, assertPcm16, pcmDurationMs, trimToSpeech } from './pcm.js';
export { EncryptedVault, FileVaultStorage, MemoryVaultStorage, parseVaultKey } from './vault.js';
export type { VaultStorage } from './vault.js';
export { HttpSpeakerEmbedder } from './embedder-http.js';
export type { HttpSpeakerEmbedderOptions } from './embedder-http.js';
export { DEFAULT_SPEAKER_POLICY, EnrollmentRejectedError, SpeakerIdentifier, cosine, normalizeVector } from './identifier.js';
export type { SpeakerIdentifierOptions } from './identifier.js';
