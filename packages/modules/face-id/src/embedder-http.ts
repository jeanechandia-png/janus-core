import { MIME_BY_KIND, assertImage } from './image.js';
import type { FaceEmbedder } from './types.js';

export interface HttpFaceEmbedderOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Faces are biometric: remote endpoints are refused unless the host opts in explicitly. */
  allowRemote?: boolean;
  timeoutMs?: number;
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function normalizeBaseUrl(value: string, allowRemote: boolean): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Face embedder URL must be http(s)');
  if (!allowRemote && !LOOPBACK.has(url.hostname)) {
    throw new Error('Face embedder must run on loopback (face images are biometric data); set allowRemote only deliberately');
  }
  return url.toString().replace(/\/$/, '');
}

/**
 * Talks to a local face-embedding sidecar: POST {baseUrl}/embed with the raw image bytes (Content-Type image/*),
 * answer { embedding: number[], model_id: string, faces: number, quality?: number }. The model behind it is replaceable.
 */
export class HttpFaceEmbedder implements FaceEmbedder {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: HttpFaceEmbedderOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl, options.allowRemote === true);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async embed(image: Uint8Array): Promise<{ vector: Float32Array; modelId: string; faces: number; quality?: number }> {
    const kind = assertImage(image);
    const response = await this.fetchImpl(`${this.baseUrl}/embed`, {
      method: 'POST',
      headers: { 'content-type': MIME_BY_KIND[kind] },
      body: image as BodyInit,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Face embedder responded ${response.status}`);
    const body = await response.json() as { embedding?: unknown; model_id?: unknown; faces?: unknown; quality?: unknown };
    const faces = typeof body.faces === 'number' && Number.isFinite(body.faces) ? Math.max(0, Math.floor(body.faces)) : NaN;
    if (!Number.isFinite(faces)) throw new Error('Face embedder returned no face count');
    const embedding = Array.isArray(body.embedding) ? body.embedding : [];
    if (faces === 1 && (embedding.length < 64 || !embedding.every((v) => typeof v === 'number' && Number.isFinite(v)))) {
      throw new Error('Face embedder returned an invalid embedding');
    }
    if (typeof body.model_id !== 'string' || !body.model_id) throw new Error('Face embedder returned no model_id');
    return {
      vector: Float32Array.from(faces === 1 ? embedding as number[] : []),
      modelId: body.model_id,
      faces,
      ...(typeof body.quality === 'number' ? { quality: body.quality } : {}),
    };
  }
}
