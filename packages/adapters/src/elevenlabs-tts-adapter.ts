import type { SpeechOutputChunk, TextToSpeechGateway } from "../../gateways/src/contracts.js";

/** API credentials are supplied at runtime by the host's secret manager. */
export interface ElevenLabsAdapterOptions {
  readonly apiKey: () => string | Promise<string>;
  readonly fetchImpl?: typeof fetch;
  readonly modelId?: string;
  readonly timeoutMs?: number;
}
export interface ElevenLabsVoice {
  readonly voice_id: string;
  readonly name: string;
  readonly category?: string;
}
export class ElevenLabsTtsAdapter implements TextToSpeechGateway {
  private readonly fetchImpl: typeof fetch;
  private readonly modelId: string;
  private readonly timeoutMs: number;
  constructor(private readonly options: ElevenLabsAdapterOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.modelId = options.modelId ?? "eleven_multilingual_v2";
    this.timeoutMs = options.timeoutMs ?? 30000;
  }
  private async key(): Promise<string> {
    const value = (await this.options.apiKey()).trim();
    if (!value) throw new Error("ElevenLabs credential is not configured");
    return value;
  }
  /** Fetches available voices from the authenticated account. No voice cloning or creation. */
  async listVoices(): Promise<ElevenLabsVoice[]> {
    const response = await this.fetchImpl("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": await this.key(), accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`ElevenLabs voice list HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("voices" in body) || !Array.isArray(body.voices))
      throw new Error("ElevenLabs voice list response is invalid");
    return body.voices.filter((v: unknown): v is ElevenLabsVoice =>
      !!v && typeof v === "object" && "voice_id" in v && typeof v.voice_id === "string" &&
      "name" in v && typeof v.name === "string"
    ).map((v: ElevenLabsVoice) => ({ voice_id: v.voice_id, name: v.name, category: v.category }));
  }
  /** Explicitly requests raw 16 kHz mono signed PCM; never passes MP3 to the PCM player. */
  async *synthesize(text: string, voiceId: string): AsyncIterable<SpeechOutputChunk> {
    if (!text.trim()) return;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(voiceId)) throw new Error("Invalid ElevenLabs voice ID");
    const response = await this.fetchImpl(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=pcm_16000`,
      {
        method: "POST",
        headers: { "xi-api-key": await this.key(), "content-type": "application/json", accept: "audio/pcm" },
        body: JSON.stringify({ text, model_id: this.modelId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      },
    );
    if (!response.ok) throw new Error(`ElevenLabs synthesis HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length % 2) throw new Error("ElevenLabs returned an incomplete PCM frame");
    const chunkSize = 1280; // 40 ms, 16 kHz, 16-bit mono
    for (let i = 0; i < bytes.length; i += chunkSize) {
      yield { bytes: bytes.slice(i, i + chunkSize), mimeType: "audio/pcm;rate=16000;channels=1;format=s16le" };
    }
  }
}
