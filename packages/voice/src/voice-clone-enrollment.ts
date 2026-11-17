import { readFileSync } from 'node:fs';
import { sha256, validateReferenceAsset, type LikenessConsent } from '../../core/src/likeness-consent.js';

// Voice Clone Enrollment — reusable LEGO module (ADR-009).
// Turns an approved local recording of a person into a voice entry for the local Qwen3-TTS
// sidecar (`config/voices.local.json`, mode `voice_clone`) or for a hosted provider adapter,
// only after the reference passes quality gates and a scoped likeness consent exists.
// Nothing here downloads, uploads or stores audio: it reads the local file, measures it and
// returns the config entry; the caller writes it to the git-ignored local config.

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationSeconds: number;
}

export interface VoiceReferenceQuality {
  ok: boolean;
  problems: string[];
  info: WavInfo;
}

export interface VoiceCloneTargets {
  minSeconds: number;
  maxSeconds: number;
  minSampleRate: number;
}

/** Qwen3-TTS Base clones from a short clean reference; hosted instant clones accept ~1–2 min. */
export const DEFAULT_VOICE_CLONE_TARGETS: VoiceCloneTargets = { minSeconds: 8, maxSeconds: 180, minSampleRate: 16_000 };

export function parseWav(buffer: Buffer): WavInfo {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Reference must be a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt: { channels: number; sampleRate: number; bitsPerSample: number } | undefined;
  let dataBytes = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = { channels: buffer.readUInt16LE(body + 2), sampleRate: buffer.readUInt32LE(body + 4), bitsPerSample: buffer.readUInt16LE(body + 14) };
    } else if (id === 'data') {
      dataBytes = Math.min(size, buffer.length - body);
    }
    offset = body + size + (size % 2);
  }
  if (!fmt) throw new Error('WAV fmt chunk not found');
  const bytesPerSecond = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
  return { ...fmt, durationSeconds: bytesPerSecond ? dataBytes / bytesPerSecond : 0 };
}

export function checkVoiceReference(info: WavInfo, targets: VoiceCloneTargets = DEFAULT_VOICE_CLONE_TARGETS): VoiceReferenceQuality {
  const problems: string[] = [];
  if (info.durationSeconds < targets.minSeconds) problems.push(`too short (${info.durationSeconds.toFixed(1)} s < ${targets.minSeconds} s)`);
  if (info.durationSeconds > targets.maxSeconds) problems.push(`too long (${info.durationSeconds.toFixed(1)} s > ${targets.maxSeconds} s); trim to the cleanest part`);
  if (info.sampleRate < targets.minSampleRate) problems.push(`sample rate ${info.sampleRate} Hz below ${targets.minSampleRate} Hz`);
  if (info.bitsPerSample < 16) problems.push('use at least 16-bit audio');
  return { ok: problems.length === 0, problems, info };
}

export interface QwenVoiceCloneEntry {
  mode: 'voice_clone';
  model_path: string;
  language: string;
  ref_audio: string;
  ref_text: string;
  x_vector_only_mode: false;
  ref_sha256: string;
  consent_id: string;
}

export function enrollVoiceClone(input: {
  voiceId: string;
  referencePath: string;
  transcript: string;
  language: string;
  modelPath: string;
  consent: LikenessConsent;
  product: string;
  now?: string;
  readFile?: (path: string) => Buffer;
}): { voiceId: string; entry: QwenVoiceCloneEntry; quality: VoiceReferenceQuality } {
  const now = input.now ?? new Date().toISOString();
  if (!input.consent.modalities.includes('voice')) throw new Error('Consent does not cover voice');
  if (input.consent.revokedAt || Date.parse(now) >= Date.parse(input.consent.expiresAt)) throw new Error('Consent is not active');
  if (!input.consent.products.includes(input.product)) throw new Error(`Consent does not cover product ${input.product}`);
  if (!input.referencePath.startsWith('/')) throw new Error('referencePath must be an absolute local path');
  const buffer = (input.readFile ?? readFileSync)(input.referencePath);
  const digest = sha256(buffer);
  validateReferenceAsset({ modality: 'voice', localRef: input.referencePath, sha256: digest, transcript: input.transcript, capturedAt: now });
  if (!input.consent.references.some((reference) => reference.modality === 'voice' && reference.sha256 === digest)) {
    throw new Error('This recording is not the one approved in the consent record');
  }
  const quality = checkVoiceReference(parseWav(buffer));
  if (!quality.ok) throw new Error(`Reference audio rejected: ${quality.problems.join('; ')}`);
  return {
    voiceId: input.voiceId,
    quality,
    entry: {
      mode: 'voice_clone',
      model_path: input.modelPath,
      language: input.language,
      ref_audio: input.referencePath,
      ref_text: input.transcript.trim(),
      x_vector_only_mode: false,
      ref_sha256: digest,
      consent_id: input.consent.id,
    },
  };
}
