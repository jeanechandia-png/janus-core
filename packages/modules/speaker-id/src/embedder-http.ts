import { PCM_SAMPLE_RATE, assertPcm16 } from './pcm.js';
import type { SpeakerEmbedder } from './types.js';

export interface HttpSpeakerEmbedderOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Audio is biometric: remote endpoints are refused unless the host opts in explicitly. */
  allowRemote?: boolean;
  timeoutMs?: number;
  sampleRate?: number;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function normalizeBaseUrl(value: string, allowRemote: boolean): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Speaker embedder URL must be http(s)');
  if (!allowRemote && !LOOPBACK.has(url.hostname)) {
    throw new Error('Speaker embedder must run on loopback (voice audio is biometric data); set allowRemote only deliberately');
  }
  return url.toString().replace(/\/$/, '');
}

/**
 * Talks to a local speaker-embedding sidecar: POST {baseUrl}/embed with raw PCM16 mono,
 * answer { embedding: number[], model_id: string }. The model behind it is replaceable.
 */
export class HttpSpeakerEmbedder implements SpeakerEmbedder {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly sampleRate: number;

  constructor(options: HttpSpeakerEmbedderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl, options.allowRemote === true);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.sampleRate = options.sampleRate ?? PCM_SAMPLE_RATE;
  }

  async embed(pcm: Uint8Array): Promise<{ vector: Float32Array; modelId: string }> {
    assertPcm16(pcm);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/embed`, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': `audio/pcm;rate=${this.sampleRate};channels=1;format=s16le` },
        body: pcm as unknown as BodyInit,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Speaker embedder responded ${response.status}`);
      const body = (await response.json()) as { embedding?: unknown; model_id?: unknown };
      const embedding = body.embedding;
      if (!Array.isArray(embedding) || embedding.length < 32 || embedding.length > 4096 || !embedding.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        throw new Error('Speaker embedder returned an invalid embedding');
      }
      const modelId = typeof body.model_id === 'string' && body.model_id.trim() ? body.model_id.trim() : 'unknown-model';
      return { vector: Float32Array.from(embedding as number[]), modelId };
    } finally {
      clearTimeout(timer);
    }
  }
}
