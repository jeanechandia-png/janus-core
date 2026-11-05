import type {
  SpeechOutputChunk,
  TextToSpeechGateway,
} from '../../gateways/src/contracts.js';

/**
 * ElevenLabs streaming TTS adapter (proveedor de voz TEMPORAL y OPCIONAL).
 *
 * Reglas (docs/voice-elevenlabs-provider.md, packages/voice/src/voice-independence.ts):
 * - La clave llega por `apiKeyProvider` (CredentialBroker); nunca se guarda ni se registra.
 * - Solo se envía a la nube un `voiceId` de Janus que esté mapeado explícitamente en
 *   `voiceMap`. Cualquier otro identificador (p. ej. perfiles de menores) falla con
 *   `voice_not_mapped` ANTES de salir de la máquina, y el respaldo local lo atiende.
 * - Tope por petición y presupuesto diario de caracteres opcionales para acotar el gasto.
 * - Salida: PCM 16-bit mono 24 kHz (`output_format=pcm_24000`), el mismo contrato que el
 *   reproductor de la PWA ya consume para la voz local.
 */

export const ELEVENLABS_DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
export const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
export const ELEVENLABS_PCM_MIME = 'audio/pcm;rate=24000;channels=1;format=s16le';

const SAMPLE_RATE = 24_000;
const BYTES_PER_FRAME = 2; // mono, s16le

export type ElevenLabsTtsErrorCode =
  | 'not_configured'
  | 'voice_not_mapped'
  | 'text_too_long'
  | 'budget_exhausted'
  | 'auth'
  | 'rate_limited'
  | 'http'
  | 'network'
  | 'truncated_audio';

/** `request`: la petición concreta no es válida/permitida; `provider`: el proveedor falla o no está disponible. */
export type ElevenLabsTtsErrorScope = 'request' | 'provider';

export class ElevenLabsTtsError extends Error {
  readonly code: ElevenLabsTtsErrorCode;
  readonly scope: ElevenLabsTtsErrorScope;
  readonly status?: number;

  constructor(code: ElevenLabsTtsErrorCode, message: string, scope: ElevenLabsTtsErrorScope, status?: number) {
    super(message);
    this.name = 'ElevenLabsTtsError';
    this.code = code;
    this.scope = scope;
    if (status !== undefined) this.status = status;
  }
}

export interface ElevenLabsVoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsTtsAdapterOptions {
  /** Devuelve la clave API en el momento de usarla (CredentialBroker). Nunca se almacena. */
  apiKeyProvider: () => Promise<string | undefined>;
  /** voiceId de Janus -> voice_id de ElevenLabs. Solo estos identificadores pueden salir a la nube. */
  voiceMap: Readonly<Record<string, string>>;
  modelId?: string;
  languageCode?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  chunkMs?: number;
  requestTimeoutMs?: number;
  /** Máximo de caracteres por petición (por defecto 2000). Un texto mayor lo atiende el respaldo local. */
  maxCharsPerRequest?: number;
  /** Presupuesto diario de caracteres (UTC). Sin valor = sin tope propio (el plan de ElevenLabs sigue mandando). */
  dailyCharBudget?: number;
  /** Optional durable atomic quota reservation: false means refuse before calling provider. */
  reserveDailyChars?: (day: string, characters: number, maxCharacters: number) => boolean;
  /** Optional persisted quota reader for accurate health after restarts. */
  usedDailyChars?: (day: string) => number;
  now?: () => Date;
}

export interface ElevenLabsUsageSnapshot {
  day: string;
  charactersRequested: number;
  dailyCharBudget: number | null;
  requests: number;
}

export class ElevenLabsTtsAdapter implements TextToSpeechGateway {
  private readonly apiKeyProvider: () => Promise<string | undefined>;
  private readonly voiceMap: Map<string, string>;
  private readonly modelId: string;
  private readonly languageCode?: string;
  private readonly voiceSettings?: Record<string, number | boolean>;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly chunkBytes: number;
  private readonly requestTimeoutMs: number;
  private readonly maxCharsPerRequest: number;
  private readonly dailyCharBudget: number | null;
  private readonly reserveDailyChars?: (day: string, characters: number, maxCharacters: number) => boolean;
  private readonly usedDailyChars?: (day: string) => number;
  private readonly now: () => Date;
  private usageDay = '';
  private usageChars = 0;
  private usageRequests = 0;

  constructor(options: ElevenLabsTtsAdapterOptions) {
    this.apiKeyProvider = options.apiKeyProvider;
    this.voiceMap = new Map(
      Object.entries(options.voiceMap).map(([janusId, providerId]) => [janusId.trim(), providerId.trim()] as const)
        .filter(([janusId, providerId]) => janusId.length > 0 && isSafeProviderVoiceId(providerId)),
    );
    this.modelId = options.modelId?.trim() || ELEVENLABS_DEFAULT_MODEL_ID;
    this.languageCode = options.languageCode?.trim() || undefined;
    this.voiceSettings = toApiVoiceSettings(options.voiceSettings);
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? ELEVENLABS_DEFAULT_BASE_URL);
    this.fetchImpl = options.fetchImpl ?? fetch;
    const chunkMs = boundedNumber(options.chunkMs, 40, 10, 250);
    this.chunkBytes = Math.max(1, Math.round((SAMPLE_RATE * chunkMs) / 1000)) * BYTES_PER_FRAME;
    this.requestTimeoutMs = boundedNumber(options.requestTimeoutMs, 60_000, 1_000, 300_000);
    this.maxCharsPerRequest = boundedNumber(options.maxCharsPerRequest, 2_000, 50, 10_000);
    this.dailyCharBudget = Number.isFinite(options.dailyCharBudget) && Number(options.dailyCharBudget) > 0
      ? Math.floor(Number(options.dailyCharBudget))
      : null;
    this.reserveDailyChars = options.reserveDailyChars;
    this.usedDailyChars = options.usedDailyChars;
    this.now = options.now ?? (() => new Date());
  }

  /** True si el identificador de Janus puede salir a la nube (está mapeado explícitamente). */
  canServe(voiceId: string): boolean {
    return this.voiceMap.has(voiceId.trim());
  }

  usage(): ElevenLabsUsageSnapshot {
    this.rollUsageDay();
    return {
      day: this.usageDay,
      charactersRequested: this.usedDailyChars ? this.usedDailyChars(this.usageDay) : this.usageChars,
      dailyCharBudget: this.dailyCharBudget,
      requests: this.usageRequests,
    };
  }

  async *synthesize(text: string, voiceId: string): AsyncIterable<SpeechOutputChunk> {
    const cleanText = text.trim();
    if (!cleanText) return;

    const providerVoiceId = this.voiceMap.get(voiceId.trim());
    if (!providerVoiceId) {
      throw new ElevenLabsTtsError(
        'voice_not_mapped',
        'Este identificador de voz no está autorizado para el proveedor en la nube.',
        'request',
      );
    }
    if (cleanText.length > this.maxCharsPerRequest) {
      throw new ElevenLabsTtsError(
        'text_too_long',
        `El texto supera el máximo por petición (${this.maxCharsPerRequest} caracteres).`,
        'request',
      );
    }
    this.rollUsageDay();
    if (this.dailyCharBudget !== null && this.usageChars + cleanText.length > this.dailyCharBudget) {
      throw new ElevenLabsTtsError('budget_exhausted', 'Presupuesto diario de caracteres de voz en la nube agotado.', 'provider');
    }

    const apiKey = (await this.apiKeyProvider())?.trim();
    if (!apiKey) {
      throw new ElevenLabsTtsError('not_configured', 'Falta la credencial del servicio elevenlabs.', 'provider');
    }

    // The provider may bill a failed/aborted request. Reserve conservatively
    // BEFORE the HTTP call. A SQLite-backed callback survives process restart.
    if (this.dailyCharBudget !== null && this.reserveDailyChars) {
      let reserved = false;
      try { reserved = this.reserveDailyChars(this.usageDay, cleanText.length, this.dailyCharBudget); }
      catch { throw new ElevenLabsTtsError('budget_exhausted', 'No se pudo validar el límite persistente de voz. Se bloquea el gasto en la nube.', 'provider'); }
      if (!reserved) throw new ElevenLabsTtsError('budget_exhausted', 'Límite diario persistente de voz en la nube alcanzado.', 'provider');
    }

    this.usageChars += cleanText.length;
    this.usageRequests += 1;

    const url = `${this.baseUrl}/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}/stream?output_format=pcm_24000`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'audio/pcm',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: this.modelId,
          ...(this.languageCode ? { language_code: this.languageCode } : {}),
          ...(this.voiceSettings ? { voice_settings: this.voiceSettings } : {}),
        }),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (error) {
      throw new ElevenLabsTtsError('network', `No se pudo contactar al proveedor de voz: ${safeErrorName(error)}.`, 'provider');
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw classifyHttpError(response.status, body);
    }

    let carry: Uint8Array = new Uint8Array(0);
    const chunkBytes = this.chunkBytes;
    const drain = function* (force: boolean): Generator<SpeechOutputChunk> {
      while (carry.byteLength >= chunkBytes || (force && carry.byteLength >= BYTES_PER_FRAME)) {
        const size = Math.min(carry.byteLength - (carry.byteLength % BYTES_PER_FRAME), chunkBytes);
        yield { bytes: carry.slice(0, size), mimeType: ELEVENLABS_PCM_MIME };
        carry = carry.slice(size);
      }
    };

    try {
      if (response.body) {
        const reader = response.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value && value.byteLength > 0) {
            carry = concat(carry, value);
            yield* drain(false);
          }
        }
      } else {
        carry = new Uint8Array(await response.arrayBuffer());
        yield* drain(false);
      }
    } catch (error) {
      if (error instanceof ElevenLabsTtsError) throw error;
      throw new ElevenLabsTtsError('network', `Se cortó el audio del proveedor: ${safeErrorName(error)}.`, 'provider');
    }

    yield* drain(true);
    if (carry.byteLength % BYTES_PER_FRAME !== 0) {
      throw new ElevenLabsTtsError('truncated_audio', 'El proveedor devolvió un fotograma PCM incompleto.', 'provider');
    }
  }

  private rollUsageDay(): void {
    const day = this.now().toISOString().slice(0, 10);
    if (day !== this.usageDay) {
      this.usageDay = day;
      this.usageChars = 0;
      this.usageRequests = 0;
    }
  }
}

function classifyHttpError(status: number, body: string): ElevenLabsTtsError {
  const preview = safePreview(body);
  if (status === 401 || status === 403) {
    return new ElevenLabsTtsError('auth', `El proveedor de voz rechazó la credencial (HTTP ${status}).`, 'provider', status);
  }
  if (status === 429) {
    return new ElevenLabsTtsError('rate_limited', 'El proveedor de voz limitó las peticiones (HTTP 429).', 'provider', status);
  }
  if (status === 400 || status === 404 || status === 422) {
    return new ElevenLabsTtsError('http', `Petición rechazada por el proveedor (HTTP ${status}): ${preview}`, 'request', status);
  }
  return new ElevenLabsTtsError('http', `Error del proveedor de voz (HTTP ${status}): ${preview}`, 'provider', status);
}

function toApiVoiceSettings(settings: ElevenLabsVoiceSettings | undefined): Record<string, number | boolean> | undefined {
  if (!settings) return undefined;
  const out: Record<string, number | boolean> = {};
  const set = (key: string, value: number | undefined, min: number, max: number) => {
    if (Number.isFinite(value)) out[key] = Math.min(max, Math.max(min, Number(value)));
  };
  set('stability', settings.stability, 0, 1);
  set('similarity_boost', settings.similarityBoost, 0, 1);
  set('style', settings.style, 0, 1);
  set('speed', settings.speed, 0.7, 1.2);
  if (typeof settings.useSpeakerBoost === 'boolean') out.use_speaker_boost = settings.useSpeakerBoost;
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('ElevenLabs base URL must use https');
  const host = url.hostname.toLowerCase();
  if (host !== 'elevenlabs.io' && !host.endsWith('.elevenlabs.io')) {
    throw new Error('ElevenLabs base URL must be an elevenlabs.io host');
  }
  return url.toString().replace(/\/$/, '');
}

/** Los voice_id de ElevenLabs son alfanuméricos; se rechaza cualquier otra cosa para no construir rutas arbitrarias. */
export function isSafeProviderVoiceId(value: string): boolean {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) return b.slice();
  const out = new Uint8Array(a.byteLength + b.byteLength);
  out.set(a, 0);
  out.set(b, a.byteLength);
  return out;
}

function boundedNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}

function safePreview(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.slice(0, 200) || 'sin detalle';
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'error';
}
