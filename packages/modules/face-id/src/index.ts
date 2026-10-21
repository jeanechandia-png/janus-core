export type {
  AuditEntry, ConsentGrantor, ConsentInput, ConsentPurpose, ConsentRecord, ConsentRelation, EnrollmentReport,
  FaceEmbedder, FacePolicy, FaceSubject, IdentifyDecision, IdentifyResult, StoredSubject, StoredTemplate,
  SubjectRole, SubjectSummary, VaultState,
} from './types.js';
export { ALLOWED_PURPOSES, CONSENT_POLICY_VERSION, activeConsent, createConsent } from './consent.js';
export { MAX_IMAGE_BYTES, assertImage, detectImageKind } from './image.js';
export { EncryptedVault, FileVaultStorage, MemoryVaultStorage, parseVaultKey } from './vault.js';
export type { VaultStorage } from './vault.js';
export { HttpFaceEmbedder } from './embedder-http.js';
export type { HttpFaceEmbedderOptions } from './embedder-http.js';
export { DEFAULT_FACE_POLICY, EnrollmentRejectedError, FaceIdentifier, cosine, normalizeVector } from './identifier.js';
export type { FaceIdentifierOptions } from './identifier.js';
