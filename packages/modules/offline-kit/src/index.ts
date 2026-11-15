/**
 * Pieza LEGO «offline-kit»: lo que un producto necesita para seguir trabajando SIN internet y volver a
 * sincronizar sin sorpresas. Lógica pura: sin red, sin disco, sin reloj propio (la hora la pasa el anfitrión).
 *
 * Cuatro partes independientes:
 *  1. Conectividad — máquina de estados con histéresis (no «parpadea» por un fallo suelto).
 *  2. Capacidades — qué funciona sin internet, qué funciona a medias y qué no, calculado de una lista
 *     declarada por el producto. Es la ÚNICA fuente de verdad para pantallas y textos comerciales:
 *     si no está aquí como «funciona», no se promete.
 *  3. Bandeja de salida — cambios hechos sin conexión, con clave de idempotencia, reintentos con espera y
 *     REVALIDACIÓN al reconectar: lo delicado o lo viejo no se envía solo; vuelve a pedir confirmación.
 *  4. Caché de lectura — veredicto «reciente / antiguo / caducado» para enseñar datos guardados diciendo de cuándo son.
 *
 * La pieza no lleva datos de ningún producto.
 */

export const OFFLINE_KIT_VERSION = 'offline-kit-v1';

/* ── 1. Conectividad ─────────────────────────────────────────────────────────────────────────────────── */

export type LinkState = 'online' | 'offline' | 'unknown';
export interface Connectivity {
  state: LinkState;
  /** Desde cuándo está en este estado (ISO). */
  since: string;
  lastProbeAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}
export interface ConnectivityPolicy { failuresToOffline: number; successesToOnline: number }
export const DEFAULT_CONNECTIVITY_POLICY: ConnectivityPolicy = Object.freeze({ failuresToOffline: 2, successesToOnline: 1 });

export const initialConnectivity = (now: string): Connectivity => ({ state: 'unknown', since: now, lastProbeAt: null, consecutiveFailures: 0, consecutiveSuccesses: 0 });

/** Aplica el resultado de una comprobación. Devuelve un estado NUEVO (no muta). */
export function recordProbe(current: Connectivity, reachable: boolean, now: string, policy: ConnectivityPolicy = DEFAULT_CONNECTIVITY_POLICY): Connectivity {
  const failures = reachable ? 0 : current.consecutiveFailures + 1;
  const successes = reachable ? current.consecutiveSuccesses + 1 : 0;
  let state = current.state;
  if (reachable && successes >= policy.successesToOnline) state = 'online';
  if (!reachable && failures >= policy.failuresToOffline) state = 'offline';
  return { state, since: state === current.state ? current.since : now, lastProbeAt: now, consecutiveFailures: failures, consecutiveSuccesses: successes };
}

/* ── 2. Capacidades ──────────────────────────────────────────────────────────────────────────────────── */

export type Needs = 'nothing' | 'device' | 'local_network' | 'internet';
export interface CapabilitySpec {
  id: string;
  /** Nombre corto para la pantalla. */
  label: string;
  /** Qué necesita para funcionar del todo. `device` = solo el aparato donde corre el producto. */
  needs: Needs;
  /** Recurso local que, si existe, permite seguir sin internet (p. ej. 'local_model'). */
  localResource?: string;
  /** Qué queda disponible sin internet cuando NO hay recurso local. Vacío = nada. */
  offlineFallback?: string;
  /** Los cambios hechos sin conexión se guardan y se envían después. */
  queuesChanges?: boolean;
}
export type CapabilityStatus = 'works' | 'degraded' | 'unavailable';
export interface CapabilityVerdict { id: string; label: string; status: CapabilityStatus; needs: Needs; detail: string; queuesChanges: boolean }
export interface Environment { internet: boolean; localNetwork: boolean; resources: Readonly<Record<string, boolean>> }

/** Veredicto de cada capacidad en el entorno dado. Determinista. */
export function evaluateCapabilities(specs: readonly CapabilitySpec[], env: Environment): CapabilityVerdict[] {
  return specs.map((spec) => {
    const base = { id: spec.id, label: spec.label, needs: spec.needs, queuesChanges: !!spec.queuesChanges };
    if (spec.needs === 'nothing' || spec.needs === 'device') return { ...base, status: 'works' as const, detail: 'Funciona en el propio aparato.' };
    if (spec.needs === 'local_network') {
      return env.localNetwork || env.internet
        ? { ...base, status: 'works' as const, detail: 'Funciona con la red de casa u oficina, aunque no haya internet.' }
        : { ...base, status: spec.queuesChanges ? 'degraded' as const : 'unavailable' as const, detail: spec.queuesChanges ? 'Sin red: se guarda en el aparato y se envía al volver.' : 'Necesita la red local.' };
    }
    if (env.internet) return { ...base, status: 'works' as const, detail: 'Funciona con internet.' };
    if (spec.localResource && env.resources[spec.localResource]) return { ...base, status: 'works' as const, detail: 'Sin internet usa el recurso local instalado.' };
    if (spec.queuesChanges) return { ...base, status: 'degraded' as const, detail: spec.offlineFallback || 'Sin internet: se guarda y se envía al volver, pidiendo confirmación si es delicado.' };
    if (spec.offlineFallback) return { ...base, status: 'degraded' as const, detail: spec.offlineFallback };
    return { ...base, status: 'unavailable' as const, detail: 'Necesita internet.' };
  });
}

/** Resumen para el caso «no hay internet»: lo que se puede prometer y lo que no. */
export function offlineSummary(specs: readonly CapabilitySpec[], resources: Readonly<Record<string, boolean>>, localNetwork = false): { works: CapabilityVerdict[]; degraded: CapabilityVerdict[]; unavailable: CapabilityVerdict[] } {
  const verdicts = evaluateCapabilities(specs, { internet: false, localNetwork, resources });
  return { works: verdicts.filter((v) => v.status === 'works'), degraded: verdicts.filter((v) => v.status === 'degraded'), unavailable: verdicts.filter((v) => v.status === 'unavailable') };
}

/* ── 3. Bandeja de salida ────────────────────────────────────────────────────────────────────────────── */

export type OutboxState = 'queued' | 'sent' | 'needs_review' | 'failed' | 'discarded';
export interface OutboxItem {
  id: string;
  /** Clave que el destino usa para no aplicar dos veces el mismo cambio. */
  idempotencyKey: string;
  /** Tipo de acción, p. ej. 'finance.document.create'. */
  kind: string;
  /** Texto corto para que una persona la reconozca. */
  summary: string;
  payload: unknown;
  /** Delicada: nunca se envía sola al reconectar; vuelve a pedir confirmación. */
  sensitive: boolean;
  state: OutboxState;
  createdAt: string;
  attempts: number;
  nextAttemptAt: string;
  lastError?: string;
  settledAt?: string;
}
export interface OutboxPolicy {
  /** Antigüedad a partir de la cual un cambio ya no se envía solo (por si el mundo cambió entretanto). */
  reviewAfterMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxItems: number;
}
export const DEFAULT_OUTBOX_POLICY: OutboxPolicy = Object.freeze({ reviewAfterMs: 24 * 3_600_000, maxAttempts: 6, baseDelayMs: 5_000, maxDelayMs: 15 * 60_000, maxItems: 500 });

const clean = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const ms = (iso: string): number => Date.parse(iso);

export interface EnqueueInput { id: string; kind: string; summary: string; payload: unknown; sensitive?: boolean; idempotencyKey?: string; now: string }

/** Crea un elemento de la bandeja. Lanza error si falta lo mínimo o la bandeja está llena. */
export function enqueue(items: readonly OutboxItem[], input: EnqueueInput, policy: OutboxPolicy = DEFAULT_OUTBOX_POLICY): OutboxItem {
  const id = clean(input.id, 80); const kind = clean(input.kind, 80); const summary = clean(input.summary, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/.test(id)) throw new Error('outbox id is invalid');
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(kind)) throw new Error('outbox kind is invalid');
  if (!summary) throw new Error('outbox summary is required');
  if (Number.isNaN(ms(input.now))) throw new Error('now must be an ISO timestamp');
  if (items.some((item) => item.id === id)) throw new Error('outbox id already exists');
  if (items.filter((item) => item.state === 'queued' || item.state === 'needs_review').length >= policy.maxItems) throw new Error('outbox is full');
  let size = 0; try { size = JSON.stringify(input.payload ?? null).length; } catch { throw new Error('outbox payload must be JSON'); }
  if (size > 200_000) throw new Error('outbox payload is too large');
  return { id, idempotencyKey: clean(input.idempotencyKey, 120) || id, kind, summary, payload: input.payload ?? null, sensitive: input.sensitive === true, state: 'queued', createdAt: new Date(ms(input.now)).toISOString(), attempts: 0, nextAttemptAt: new Date(ms(input.now)).toISOString() };
}

/**
 * Revalidación al reconectar: lo delicado y lo que lleva demasiado tiempo esperando deja de estar «en cola»
 * y pasa a «revisar». Lo demás queda listo para enviarse. Devuelve elementos NUEVOS.
 */
export function revalidate(items: readonly OutboxItem[], now: string, policy: OutboxPolicy = DEFAULT_OUTBOX_POLICY): OutboxItem[] {
  return items.map((item) => {
    if (item.state !== 'queued') return item;
    const old = ms(now) - ms(item.createdAt) > policy.reviewAfterMs;
    return item.sensitive || old ? { ...item, state: 'needs_review' as const, lastError: item.sensitive ? 'requiere confirmación' : 'lleva demasiado tiempo en espera' } : item;
  });
}

/** Elementos que toca enviar ahora, del más antiguo al más nuevo (el orden importa: los cambios se aplican como se hicieron). */
export function dueItems(items: readonly OutboxItem[], now: string, limit = 20): OutboxItem[] {
  return items.filter((item) => item.state === 'queued' && ms(item.nextAttemptAt) <= ms(now)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, limit);
}

export type SendOutcome = { ok: true } | { ok: false; retryable: boolean; error: string };

/** Aplica el resultado de un intento de envío. Devuelve un elemento NUEVO. */
export function settle(item: OutboxItem, outcome: SendOutcome, now: string, policy: OutboxPolicy = DEFAULT_OUTBOX_POLICY): OutboxItem {
  if (item.state !== 'queued') return item;
  const attempts = item.attempts + 1;
  if (outcome.ok) return { ...item, state: 'sent', attempts, settledAt: now, lastError: undefined };
  const error = clean(outcome.error, 200) || 'error';
  // Un rechazo definitivo (datos no válidos, sin permiso) no se reintenta: lo decide una persona.
  if (!outcome.retryable) return { ...item, state: 'failed', attempts, lastError: error, settledAt: now };
  if (attempts >= policy.maxAttempts) return { ...item, state: 'needs_review', attempts, lastError: error };
  const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempts - 1));
  return { ...item, attempts, lastError: error, nextAttemptAt: new Date(ms(now) + delay).toISOString() };
}

/** Decisión de una persona sobre un elemento en «revisar» o «fallido»: reenviar ahora o descartar. */
export function decide(item: OutboxItem, decision: 'send' | 'discard', now: string): OutboxItem {
  if (item.state !== 'needs_review' && item.state !== 'failed') throw new Error('only items in review or failed can be decided');
  if (decision === 'discard') return { ...item, state: 'discarded', settledAt: now };
  if (decision !== 'send') throw new Error('unknown decision');
  // Confirmado por una persona: vuelve a la cola una vez, ya no como «delicado sin confirmar».
  return { ...item, state: 'queued', sensitive: false, attempts: 0, nextAttemptAt: now, createdAt: now, lastError: undefined };
}

export function outboxCounts(items: readonly OutboxItem[]): Record<OutboxState, number> {
  const counts: Record<OutboxState, number> = { queued: 0, sent: 0, needs_review: 0, failed: 0, discarded: 0 };
  for (const item of items) counts[item.state] += 1;
  return counts;
}

/* ── 4. Caché de lectura ─────────────────────────────────────────────────────────────────────────────── */

export type Freshness = 'fresh' | 'stale' | 'expired';
export interface CachePolicy { freshMs: number; maxAgeMs: number }
export const DEFAULT_CACHE_POLICY: CachePolicy = Object.freeze({ freshMs: 5 * 60_000, maxAgeMs: 7 * 24 * 3_600_000 });

/** ¿Se puede enseñar un dato guardado? `expired` = demasiado viejo para mostrarlo como si sirviera. */
export function freshness(savedAt: string, now: string, policy: CachePolicy = DEFAULT_CACHE_POLICY): { state: Freshness; ageMs: number } {
  const ageMs = Math.max(0, ms(now) - ms(savedAt));
  return { state: ageMs <= policy.freshMs ? 'fresh' : ageMs <= policy.maxAgeMs ? 'stale' : 'expired', ageMs };
}
