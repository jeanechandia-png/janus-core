import type {
  SpeechOutputChunk,
  TextToSpeechGateway,
} from '../../gateways/src/contracts.js';

/**
 * Respaldo de TTS: nube -> local, nunca al revés.
 *
 * - El proveedor principal (p. ej. ElevenLabs) se prueba primero. Si falla ANTES de emitir el
 *   primer fragmento de audio, la misma petición se sirve con el respaldo local.
 * - Si falla a mitad del audio no se mezclan dos voces: el error se propaga y el motor dúplex
 *   emite `voice.error`.
 * - Tras un fallo del proveedor se abre un enfriamiento (por defecto 60 s) durante el cual las
 *   peticiones van directo al respaldo, para no añadir latencia ni gasto a cada frase.
 * - Un error con `scope === 'request'` (voz no autorizada para la nube, texto demasiado largo…)
 *   enruta solo esa petición al respaldo y NO abre enfriamiento.
 * - Sin respaldo configurado, los errores del principal se propagan tal cual.
 */

export interface FallbackTtsEvent {
  type: 'fallback' | 'cooldown-opened';
  reason: string;
  cooldownUntil?: string;
}

export interface FallbackTtsOptions {
  primary: TextToSpeechGateway;
  fallback?: TextToSpeechGateway;
  cooldownMs?: number;
  now?: () => number;
  onEvent?: (event: FallbackTtsEvent) => void;
}

export interface FallbackTtsStatus {
  primary: 'active' | 'cooling_down';
  fallbackConfigured: boolean;
  cooldownUntil: string | null;
  lastFailureReason: string | null;
  primaryServed: number;
  fallbackServed: number;
}

export class FallbackTextToSpeechGateway implements TextToSpeechGateway {
  private readonly primary: TextToSpeechGateway;
  private readonly fallback?: TextToSpeechGateway;
  private readonly cooldownMs: number;
  private readonly now: () => number;
  private readonly onEvent?: (event: FallbackTtsEvent) => void;
  private cooldownUntilMs = 0;
  private lastFailureReason: string | null = null;
  private primaryServed = 0;
  private fallbackServed = 0;

  constructor(options: FallbackTtsOptions) {
    this.primary = options.primary;
    this.fallback = options.fallback;
    this.cooldownMs = clamp(options.cooldownMs, 60_000, 0, 3_600_000);
    this.now = options.now ?? Date.now;
    this.onEvent = options.onEvent;
  }

  status(): FallbackTtsStatus {
    const cooling = this.fallback !== undefined && this.now() < this.cooldownUntilMs;
    return {
      primary: cooling ? 'cooling_down' : 'active',
      fallbackConfigured: this.fallback !== undefined,
      cooldownUntil: cooling ? new Date(this.cooldownUntilMs).toISOString() : null,
      lastFailureReason: this.lastFailureReason,
      primaryServed: this.primaryServed,
      fallbackServed: this.fallbackServed,
    };
  }

  async *synthesize(text: string, voiceId: string): AsyncIterable<SpeechOutputChunk> {
    const fallback = this.fallback;
    if (!fallback) {
      this.primaryServed += 1;
      yield* this.primary.synthesize(text, voiceId);
      return;
    }

    if (this.now() >= this.cooldownUntilMs) {
      let started = false;
      try {
        for await (const chunk of this.primary.synthesize(text, voiceId)) {
          started = true;
          yield chunk;
        }
        this.primaryServed += 1;
        return;
      } catch (error) {
        if (started) throw error;
        const reason = describe(error);
        this.lastFailureReason = reason;
        if (scopeOf(error) === 'provider') {
          this.cooldownUntilMs = this.now() + this.cooldownMs;
          this.onEvent?.({
            type: 'cooldown-opened',
            reason,
            cooldownUntil: new Date(this.cooldownUntilMs).toISOString(),
          });
        }
        this.onEvent?.({ type: 'fallback', reason });
      }
    }

    this.fallbackServed += 1;
    yield* fallback.synthesize(text, voiceId);
  }
}

function scopeOf(error: unknown): 'request' | 'provider' {
  const scope = (error as { scope?: unknown } | null)?.scope;
  return scope === 'request' ? 'request' : 'provider';
}

function describe(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code) return code;
  return error instanceof Error ? error.name : 'tts_error';
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Number(value)));
}
