import type { SocialWatchReport } from './social-watch.js';

/**
 * Planificador del seguimiento de redes: ejecuta una lectura periódica sin solaparse y se aparta cuando falla (retroceso exponencial).
 *
 * Es opt-in: sin intervalo configurado no arranca. Cada ejecución solo lee (el Tool Gateway no permite más a estos adaptadores);
 * no publica, no responde, no gasta. Los temporizadores son inyectables para poder probarlo sin esperar.
 */
export interface SocialWatchSchedulerOptions {
  /** Intervalo base en milisegundos (mínimo 15 minutos). */
  intervalMs: number;
  /** Espera antes de la primera ejecución tras arrancar. */
  initialDelayMs?: number;
  /** Tope del retroceso tras fallos consecutivos. */
  maxBackoffMs?: number;
  run(): Promise<SocialWatchReport>;
  onReport?(report: SocialWatchReport): void;
  onError?(error: unknown): void;
  now?: () => Date;
  setTimer?(callback: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
}

export interface SocialWatchStatus {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  nextRunAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  lastSummary: SocialWatchReport['summary'] | null;
}

export const MIN_WATCH_INTERVAL_MS = 15 * 60_000;

/** Lee `JANUS_SOCIAL_WATCH_INTERVAL_MIN`: vacío o 0 = desactivado; por debajo de 15 minutos se sube a 15 para no martillear las API. */
export function parseWatchIntervalMinutes(value: string | undefined): number | null {
  const text = value?.trim();
  if (!text) return null;
  const minutes = Number(text);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.max(MIN_WATCH_INTERVAL_MS, Math.round(minutes * 60_000));
}

export class SocialWatchScheduler {
  private readonly now: () => Date;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly maxBackoffMs: number;
  private timer: unknown = null;
  private current: Promise<SocialWatchReport> | null = null;
  private started = false;
  private lastRunAt: string | null = null;
  private lastDurationMs: number | null = null;
  private nextRunAt: string | null = null;
  private failures = 0;
  private lastError: string | null = null;
  private lastSummary: SocialWatchReport['summary'] | null = null;

  constructor(private readonly options: SocialWatchSchedulerOptions) {
    if (!(options.intervalMs >= MIN_WATCH_INTERVAL_MS)) throw new Error('Social watch interval must be at least 15 minutes');
    this.now = options.now ?? (() => new Date());
    this.setTimer = options.setTimer ?? ((callback, ms) => {
      const handle = setTimeout(callback, ms);
      // No mantener vivo el proceso solo por el planificador.
      (handle as { unref?: () => void }).unref?.();
      return handle;
    });
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.maxBackoffMs = options.maxBackoffMs ?? 24 * 3600_000;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.schedule(this.options.initialDelayMs ?? 60_000);
  }

  stop(): void {
    this.started = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.nextRunAt = null;
  }

  /** Ejecución inmediata (p. ej. a petición del Founder). Si ya hay una en curso, devuelve esa misma: nunca dos a la vez. */
  runNow(): Promise<SocialWatchReport> {
    if (this.current) return this.current;
    const startedAt = this.now().getTime();
    const task = (async () => {
      try {
        const report = await this.options.run();
        this.lastRunAt = this.now().toISOString();
        this.lastSummary = report.summary;
        // Un fallo de lectura de todo lo que estaba listo cuenta como fallo; que no haya nada listo todavía, no.
        const attempted = report.summary.read + report.summary.failed;
        const allFailed = attempted > 0 && report.summary.read === 0;
        if (allFailed) {
          this.failures += 1;
          this.lastError = 'Todas las lecturas fallaron';
        } else {
          this.failures = 0;
          this.lastError = null;
        }
        this.options.onReport?.(report);
        return report;
      } catch (error) {
        this.failures += 1;
        this.lastRunAt = this.now().toISOString();
        this.lastError = error instanceof Error ? error.message.slice(0, 200) : 'Error desconocido';
        this.options.onError?.(error);
        throw error;
      } finally {
        this.lastDurationMs = this.now().getTime() - startedAt;
        this.current = null;
      }
    })();
    this.current = task;
    return task;
  }

  status(): SocialWatchStatus {
    return {
      enabled: this.started,
      running: this.current !== null,
      intervalMs: this.options.intervalMs,
      lastRunAt: this.lastRunAt,
      lastDurationMs: this.lastDurationMs,
      nextRunAt: this.nextRunAt,
      consecutiveFailures: this.failures,
      lastError: this.lastError,
      lastSummary: this.lastSummary,
    };
  }

  /** Espera hasta la próxima ejecución según los fallos acumulados. */
  nextDelayMs(): number {
    return Math.min(this.options.intervalMs * 2 ** Math.min(this.failures, 10), this.maxBackoffMs);
  }

  private schedule(delayMs: number): void {
    if (!this.started) return;
    this.nextRunAt = new Date(this.now().getTime() + delayMs).toISOString();
    this.timer = this.setTimer(() => { void this.tick(); }, delayMs);
  }

  private async tick(): Promise<void> {
    this.timer = null;
    try {
      await this.runNow();
    } catch {
      // Ya registrado en runNow; el planificador sigue vivo.
    }
    this.schedule(this.nextDelayMs());
  }
}
