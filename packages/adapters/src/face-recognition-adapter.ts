import {
  EncryptedVault, FaceIdentifier, FileVaultStorage, HttpFaceEmbedder, parseVaultKey,
  type IdentifyResult, type SubjectRole,
} from '../../modules/face-id/src/index.js';

/**
 * Thin Janus adapter over the `face-id` LEGO module. Converts an identification into a provider-independent,
 * convenience-only hint (no embeddings, no images). Never an authentication factor: ADR-007/008 own that.
 */
export type FaceProfile = 'owner' | 'household_adult' | 'minor';

export interface FaceHint {
  modality: 'face';
  decision: 'match' | 'ambiguous' | 'unknown' | 'no_face' | 'multiple_faces';
  subjectId?: string;
  profile?: FaceProfile;
  score: number;
  assurance: 'convenience';
}

export interface FaceRecognitionConfig {
  embedUrl: string;
  vaultPath: string;
  /** 32-byte key (base64/hex) from the secret store. Use a different key from the voice vault. */
  vaultKey: string;
  allowRemoteEmbedder?: boolean;
}

export interface FaceRecognitionRuntime {
  identifier: FaceIdentifier;
  identify(image: Uint8Array): Promise<FaceHint>;
}

const PROFILE_BY_ROLE: Record<SubjectRole, FaceProfile> = {
  primary_owner: 'owner',
  household_adult: 'household_adult',
  household_minor: 'minor',
};

export function hintFromFaceIdentification(result: IdentifyResult): FaceHint {
  const matched = result.decision === 'match' && result.subjectId && result.role;
  return {
    modality: 'face',
    decision: result.decision,
    ...(matched ? { subjectId: result.subjectId, profile: PROFILE_BY_ROLE[result.role!] } : {}),
    score: result.score,
    assurance: 'convenience',
  };
}

export function createFaceRecognition(config: FaceRecognitionConfig): FaceRecognitionRuntime {
  const identifier = new FaceIdentifier({
    embedder: new HttpFaceEmbedder({ baseUrl: config.embedUrl, ...(config.allowRemoteEmbedder ? { allowRemote: true } : {}) }),
    vault: new EncryptedVault(new FileVaultStorage(config.vaultPath), parseVaultKey(config.vaultKey)),
  });
  return { identifier, identify: async (image) => hintFromFaceIdentification(await identifier.identify(image)) };
}
