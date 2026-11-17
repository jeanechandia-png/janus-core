/**
 * Presencia del equipo («lucecitas» de Mi equipo en la dashboard del CEO).
 *
 * HECHO: JANUS no vigila pantallas. Una luz sale de dos señales que la propia persona genera:
 *   1. su sesión de trabajo declarada (iniciar / pausar / reanudar / terminar), y
 *   2. una señal de presencia: el panel abierto avisa cada 30 s y cualquier petición válida de la persona cuenta.
 * La presencia vive SOLO en memoria del proceso (no se guarda ni se audita): al reiniciar JANUS todos aparecen
 * desconectados hasta su siguiente señal (máx. ~30 s con el panel abierto).
 *
 * Estados (de más a menos específico):
 *   working     sesión en marcha y señal reciente (≤ 5 min)  → verde
 *   unconfirmed sesión en marcha pero sin señal > 5 min        → verde hueco (no se afirma que trabaje)
 *   paused      sesión en pausa                                → ámbar
 *   online      sin sesión, pero conectada (señal ≤ 90 s)      → azul
 *   offline     nada de lo anterior                            → gris
 */
import type { WorkSessionSummary } from './work-session.js';

export type WorkPresenceState = 'working' | 'unconfirmed' | 'paused' | 'online' | 'offline';

/** El panel abierto envía señal cada 30 s: 90 s tolera dos pérdidas seguidas. */
export const PRESENCE_ONLINE_WINDOW_MS = 90_000;
/** Una sesión en marcha sin señal durante este tiempo deja de afirmarse como «trabajando». */
export const PRESENCE_WORKING_GRACE_MS = 5 * 60_000;

export interface WorkPresence {
  state: WorkPresenceState;
  /** Segundos desde la última señal (null si no hay ninguna desde que arrancó JANUS). */
  seenSecondsAgo: number | null;
  /** Inicio de la sesión abierta, si la hay. */
  sessionSince: string | null;
}

export function resolveWorkPresence(input: {
  /** Sesión abierta (no terminada) de la persona, si existe. */
  session: Pick<WorkSessionSummary, 'state' | 'startedAt'> | null | undefined;
  lastSeenMs: number | undefined;
  nowMs: number;
}): WorkPresence {
  const age = input.lastSeenMs === undefined ? null : Math.max(0, input.nowMs - input.lastSeenMs);
  const base = { seenSecondsAgo: age === null ? null : Math.round(age / 1000), sessionSince: input.session?.startedAt ?? null };
  const session = input.session && input.session.state !== 'ended' ? input.session : null;
  if (session?.state === 'running') {
    return { ...base, state: age !== null && age <= PRESENCE_WORKING_GRACE_MS ? 'working' : 'unconfirmed' };
  }
  if (session?.state === 'paused') return { ...base, state: 'paused' };
  return { ...base, state: age !== null && age <= PRESENCE_ONLINE_WINDOW_MS ? 'online' : 'offline' };
}

/** Última señal por persona, solo en memoria. Acotado para no crecer sin límite. */
export class WorkPresenceTracker {
  private readonly seen = new Map<string, number>();
  constructor(private readonly maxEntries = 500) {}

  touch(principalId: string, nowMs = Date.now()): void {
    if (!principalId) return;
    this.seen.delete(principalId);
    this.seen.set(principalId, nowMs);
    if (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
  }

  lastSeen(principalId: string): number | undefined {
    return this.seen.get(principalId);
  }

  forget(principalId: string): void {
    this.seen.delete(principalId);
  }
}
