import type { SpeechOutputChunk, TextToSpeechGateway } from '../../gateways/src/contracts.js';

/**
 * Optional server-side ElevenLabs TTS adapter. JANUS CORE owns the session and
 * the selected voice is pinned by trusted host configuration, never the client.
 * No audio, private text, or credentials are persisted by this adapter.
 */
export interface ElevenLabsTtsAdapterOptions {
  apiKey: string;
  voiceId: string;
  modelId?: string;
  fetchImpl?: typeof fetch;
  chunkMs?: number;
  maxCharacters?: number;
  requestTimeoutMs?: number;
}

const PCM_MIME = 'audio/pcm;rate=24000;channels=1;format=s16le';
const BYTES_PER_SECOND = 24_000 * 2;

export class ElevenLabsTtsAdapter implements TextToSpeechGateway {
  private readonly apiKey: string;
  private readonly voiceId: string;
  private readonly modelId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly chunkBytes: number;
  private readonly maxCharacters: number;
  private readonly requestTimeoutMs: number;

  constructor(options: ElevenLabsTtsAdapterOptions) {
    const apiKey = options.apiKey?.trim();
    const voiceId = options.voiceId?.trim();
    if (!apiKey) throw new Error('ElevenLabs API credential is required');
    if (!voiceId || !/^[a-zA-Z0-9_-]{8,64}$/.test(voiceId)) {
      throw new Error('ElevenLabs approved voice ID is required');
    }
    this.apiKey = apiKey;
    this.voiceId = voiceId;
    this.modelId = options.modelId?.trim() || 'eleven_multilingual_v2';
    this.fetchImpl = options.fetchImpl ?? fetch;
    const chunkMs = bounded(options.chunkMs, 40, 10, 250);
    this.chunkBytes = Math.max(2, Math.round(BYTES_PER_SECOND * chunkMs / 1000 / 2) * 2);
    this.maxCharacters = bounded(options.maxCharacters, 1000, 1, 2000);
    this.requestTimeoutMs = bounded(options.requestTimeoutMs, 30_000, 1000, 120_000);
  }

  async *synthesize(text: string, _clientVoiceId: string): AsyncIterable<SpeechOutputChunk> {
    const cleanText = text.trim();
    if (!cleanText) return;
    if ([...cleanText].length > this.maxCharacters) {
      throw new Error('ElevenLabs speech text exceeds the configured character budget');
    }

    // Do not trust a voice ID from the browser/WebSocket: this provider can only
    // speak with the explicitly configured and authorized voice.
    const endpoint = new URL(
      `/v1/text-to-speech/${encodeURIComponent(this.voiceId)}`,
      'https://api.elevenlabs.io',
    );
    endpoint.searchParams.set('output_format', 'pcm_24000');
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'content-type': 'application/json',
        accept: 'audio/pcm',
      },
      body: JSON.stringify({ text: cleanText, model_id: this.modelId }),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    // Avoid including response bodies: upstream errors can contain text, IDs or
    // account metadata that must not be forwarded into logs or clients.
    if (!response.ok) throw new Error(`ElevenLabs synthesis failed (HTTP ${response.status})`);
    const responseType = response.headers.get('content-type')?.toLowerCase() || '';
    if (responseType.includes('json') || responseType.startsWith('text/') || responseType.includes('audio/mpeg')) {
      throw new Error('ElevenLabs returned a non-PCM response');
    }
    const pcm = new Uint8Array(await response.arrayBuffer());
    if (pcm.length % 2 !== 0) throw new Error('ElevenLabs returned a truncated PCM frame');
    for (let offset = 0; offset < pcm.length; offset += this.chunkBytes) {
      yield { bytes: pcm.slice(offset, offset + this.chunkBytes), mimeType: PCM_MIME };
    }
  }
}

function bounded(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
