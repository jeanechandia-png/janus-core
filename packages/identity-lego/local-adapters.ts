import { Qwen3TtsHttpAdapter, type Qwen3TtsHttpAdapterOptions } from '../adapters/src/qwen3-tts-http-adapter.js';
import { createFaceRecognition, type FaceRecognitionConfig } from '../adapters/src/face-recognition-adapter.js';
import type { FaceRecognitionAdapter, IdentitySubject, VoiceCloneAdapter, VoiceCloneRequest } from './contracts.js';

/** A private mapping of logical subjects to locally configured Qwen voice IDs. */
export interface LocalVoiceIdentityConfig {
  qwen: Qwen3TtsHttpAdapterOptions;
  voiceIds: Partial<Record<IdentitySubject, string>>;
}
export function createLocalVoiceClone(config: LocalVoiceIdentityConfig): VoiceCloneAdapter {
  const gateway = new Qwen3TtsHttpAdapter(config.qwen);
  return {
    id: 'qwen3-local-voice-clone',
    async synthesize(request: VoiceCloneRequest): Promise<Uint8Array> {
      const voiceId = config.voiceIds[request.subject]?.trim();
      if (!voiceId) throw new Error('identity.voice.not-enrolled');
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of gateway.synthesize(request.text, voiceId)) {
        chunks.push(chunk.bytes);
        total += chunk.bytes.length;
      }
      const pcm = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { pcm.set(chunk, offset); offset += chunk.length; }
      if (!pcm.length) throw new Error('identity.voice.empty-output');
      return pcm;
    },
  };
}

/** Subject IDs are configured locally; unknown identities never become a match. */
export interface LocalFaceIdentityConfig {
  face: FaceRecognitionConfig;
  subjectIds: Partial<Record<IdentitySubject, string>>;
  minScore?: number;
}
export function createLocalFaceRecognition(config: LocalFaceIdentityConfig): FaceRecognitionAdapter {
  const runtime = createFaceRecognition(config.face);
  const threshold = config.minScore ?? 0.85;
  if (!(threshold > 0 && threshold <= 1)) throw new Error('identity.face.invalid-threshold');
  return {
    id: 'janus-local-face-id',
    async recognize(frame: Uint8Array) {
      const hint = await runtime.identify(frame);
      if (hint.decision !== 'match' || !hint.subjectId || !Number.isFinite(hint.score) || hint.score < threshold) return null;
      const subject = (Object.entries(config.subjectIds) as Array<[IdentitySubject, string]>)
        .find(([, id]) => id === hint.subjectId)?.[0];
      return subject ? { subject, confidence: hint.score } : null;
    },
  };
}
