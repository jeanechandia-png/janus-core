import type { SpeakerProfile, SpeakerResolver, VoiceSpeakerHint } from '../../voice/src/speaker-hint.js';
import {
  EncryptedVault, FileVaultStorage, HttpSpeakerEmbedder, SpeakerIdentifier, UtteranceAudioBuffer, parseVaultKey,
  type IdentifyResult, type SpeakerPolicy, type SubjectRole,
} from '../../modules/speaker-id/src/index.js';

/**
 * Thin Janus adapter over the `speaker-id` LEGO module. It turns a module IdentifyResult into the generic,
 * provider-independent VoiceSpeakerHint that the voice pipeline understands. The hint is convenience-only.
 */
export interface SpeakerRecognitionConfig {
  embedUrl: string;
  vaultPath: string;
  /** 32-byte key (base64/hex) from the secret store. */
  vaultKey: string;
  allowRemoteEmbedder?: boolean;
  policy?: Partial<SpeakerPolicy>;
  /** Longest utterance audio kept for identification. */
  maxBufferMs?: number;
}

export interface SpeakerRecognitionRuntime {
  identifier: SpeakerIdentifier;
  resolverFactory: (sessionId: string) => SpeakerResolver;
}

const PROFILE_BY_ROLE: Record<SubjectRole, SpeakerProfile> = {
  primary_owner: 'owner',
  household_adult: 'household_adult',
  household_minor: 'minor',
};

export function hintFromIdentification(result: IdentifyResult): VoiceSpeakerHint {
  const matched = result.decision === 'match' && result.subjectId && result.role;
  return {
    decision: result.decision,
    ...(matched ? { subjectId: result.subjectId, profile: PROFILE_BY_ROLE[result.role!] } : {}),
    score: result.score,
    assurance: 'convenience',
  };
}

export function createSpeakerRecognition(config: SpeakerRecognitionConfig): SpeakerRecognitionRuntime {
  const vault = new EncryptedVault(new FileVaultStorage(config.vaultPath), parseVaultKey(config.vaultKey));
  const identifier = new SpeakerIdentifier({
    embedder: new HttpSpeakerEmbedder({ baseUrl: config.embedUrl, ...(config.allowRemoteEmbedder ? { allowRemote: true } : {}) }),
    vault,
    ...(config.policy ? { policy: config.policy } : {}),
  });
  return {
    identifier,
    resolverFactory: () => {
      const buffer = new UtteranceAudioBuffer(config.maxBufferMs ?? 15_000);
      return {
        push: (chunk) => {
          // Only 16 kHz mono PCM16 is understood; anything else is ignored (recognition is optional).
          if (/rate=16000/.test(chunk.mimeType) && /s16le/.test(chunk.mimeType)) buffer.push(chunk.bytes);
        },
        resolve: async () => {
          const audio = buffer.drain();
          if (audio.byteLength === 0) return undefined;
          return hintFromIdentification(await identifier.identify(audio));
        },
      };
    },
  };
}
