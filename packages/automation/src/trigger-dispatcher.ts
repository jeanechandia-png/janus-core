import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FlowRunOptions, FlowRunResult } from './flow-runner.js';
import { createTriggerEnvelope, type AutomationTriggerSpec } from './trigger.js';
import { CronError, isValidTimeZone, nextCronSlot, parseCron, type CronSpec } from './cron.js';
import type { AutomationWorkflow } from './workflow.js';

/**
 * Despachador de disparadores de flujos: programado (cron), webhook firmado y evento.
 *
 * Principios (verificados por pruebas en tests/trigger-dispatcher.test.ts):
 * - Solo dispara flujos PUBLICADOS; un borrador o una revisión histórica nunca se activa. Al registrar una revisión nueva, la anterior se desactiva.
 * - Idempotente: cada disparo lleva una clave de desduplicación (programado: nodo+instante; webhook: id de entrega; evento: id). Con el almacén
 *   duradero del ejecutor (SQLite) un reinicio no repite acciones.
 * - Programado: tras una caída se recupera UN solo disparo (el último perdido), solo si no es demasiado tarde; no se «inunda» con los atrasados.
 *   Nunca se lanza una ejecución solapada del mismo disparador.
 * - Webhook: autenticado con HMAC-SHA256 (secreto resuelto desde la bóveda, jamás del flujo ni de SQLite), marca de tiempo con tolerancia (anti-repetición),
 *   comparación en tiempo constante, tamaño máximo, límite de frecuencia y respuesta idéntica ante ruta desconocida o firma mala (no revela qué rutas existen).
 * - Sin conexión: un disparo cuyo nodo exige conexión se encola (de forma duradera si el almacén lo es) y, al reconectar, se REVALIDA
 *   (el flujo sigue publicado en la misma revisión y el disparador sigue enlazado) antes de ejecutarse.
 * - El contenido que llega (cuerpo del webhook, evento) es DATO, nunca instrucción: va a `$trigger` y no se interpreta.
 * - Sin red, sin gasto: esta pieza no abre puertos ni temporizadores; el runtime la llama (`tick`, `handleWebhook`, `fireEvent`, `flushOffline`).
 */

const WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const SECRET_REF = /^(vault|env):[A-Za-z0-9_.-]{1,80}$/i;
const WEBHOOK_PATH = /^\/[A-Za-z0-9._~/-]{1,120}$/;
const EVENT_TOPIC = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}(\.\*)?$/;
const DELIVERY_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export type BoundTrigger =
  | (BoundBase & { kind: 'schedule'; cron: CronSpec; timezone: string; maxLatenessMs: number })
  | (BoundBase & { kind: 'webhook'; method: (typeof WEBHOOK_METHODS)[number]; path: string; secretRef: string })
  | (BoundBase & { kind: 'event'; topic: string });

interface BoundBase {
  key: string;
  workflowId: string;
  revision: number;
  nodeId: string;
  onlineRequired: boolean;
}

export interface BindingProblem {
  workflowId: string;
  nodeId: string;
  message: string;
}

export const DEFAULT_MAX_LATENESS_MS = 2 * 3600_000;

/** Extrae los disparadores activables de un flujo. Un flujo que no está publicado no enlaza nada. */
export function bindTriggers(workflow: AutomationWorkflow): { bindings: BoundTrigger[]; problems: BindingProblem[] } {
  const bindings: BoundTrigger[] = [];
  const problems: BindingProblem[] = [];
  if (workflow.status !== 'published') return { bindings, problems };
  for (const node of workflow.nodes) {
    if (node.kind !== 'trigger' || node.disabled) continue;
    const problem = (message: string): void => { problems.push({ workflowId: workflow.id, nodeId: node.id, message }); };
    const base: BoundBase = { key: `${workflow.id}@${workflow.revision}:${node.id}`, workflowId: workflow.id, revision: workflow.revision, nodeId: node.id, onlineRequired: node.parameters.onlineRequired === true };
    const params = node.parameters;
    switch (node.type) {
      case 'trigger.manual':
        break;
      case 'trigger.schedule': {
        const cronText = params.cron;
        const timezone = params.timezone;
        if (typeof cronText !== 'string') { problem('Falta la expresión cron'); break; }
        if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) { problem('Falta una zona horaria válida (p. ej. Europe/Amsterdam)'); break; }
        let cron: CronSpec;
        try { cron = parseCron(cronText); } catch (error) { problem(error instanceof CronError ? error.message : 'Cron no válido'); break; }
        let first: Date | null;
        try { first = nextCronSlot(cron, new Date(), timezone); } catch { first = null; }
        if (!first) { problem('El cron no se dispara nunca (p. ej. 31 de febrero)'); break; }
        const late = Number(params.maxLatenessMin);
        const maxLatenessMs = Number.isFinite(late) && late >= 1 && late <= 1440 ? Math.round(late) * 60_000 : DEFAULT_MAX_LATENESS_MS;
        bindings.push({ ...base, kind: 'schedule', cron, timezone, maxLatenessMs });
        break;
      }
      case 'trigger.webhook': {
        const method = String(params.method ?? 'POST').toUpperCase();
        const path = params.path;
        const secretRef = params.secretRef;
        if (!(WEBHOOK_METHODS as readonly string[]).includes(method)) { problem('Método de webhook no permitido'); break; }
        if (typeof path !== 'string' || !WEBHOOK_PATH.test(path) || path.includes('..') || path.includes('//')) { problem('Ruta de webhook no válida (empieza por «/», sin «..» ni «//»)'); break; }
        if (typeof secretRef !== 'string' || !SECRET_REF.test(secretRef)) { problem('El webhook necesita «secretRef» con forma vault:<nombre> o env:<NOMBRE> (el secreto nunca va en el flujo)'); break; }
        bindings.push({ ...base, kind: 'webhook', method: method as (typeof WEBHOOK_METHODS)[number], path, secretRef });
        break;
      }
      case 'trigger.event': {
        const topic = params.topic;
        if (typeof topic !== 'string' || !EVENT_TOPIC.test(topic)) { problem('Tema de evento no válido (letras, números, «.», «_» o «-»; admite «.*» al final)'); break; }
        bindings.push({ ...base, kind: 'event', topic });
        break;
      }
      case 'trigger.poll':
        problem('La consulta periódica aún no está soportada por el despachador; usa un disparador programado');
        break;
      default:
        problem(`Tipo de disparador desconocido: ${node.type}`);
    }
  }
  return { bindings, problems };
}

// ---------- Estado duradero (SqliteStore lo cumple tal cual) ----------

export interface QueuedTrigger {
  bindingKey: string;
  workflowId: string;
  revision: number;
  nodeId: string;
  dedupeKey: string;
  payload: unknown;
  trigger: AutomationTriggerSpec;
}

export interface TriggerState {
  getTriggerCursor(bindingKey: string): string | undefined;
  setTriggerCursor(bindingKey: string, lastSlot: string, at: string): void;
  enqueueTrigger(record: { id: string; workflowId: string; queuedAt: string; item: unknown }, maxItems: number): boolean;
  listQueuedTriggers(limit?: number): Array<{ id: string; workflowId: string; queuedAt: string; item: unknown }>;
  removeQueuedTrigger(id: string): void;
}

/** Estado en memoria (pruebas y entornos sin SQLite). Se pierde al reiniciar: para producción, usar SqliteStore. */
export class InMemoryTriggerState implements TriggerState {
  private readonly cursors = new Map<string, string>();
  private readonly queue = new Map<string, { id: string; workflowId: string; queuedAt: string; item: unknown }>();
  getTriggerCursor(key: string): string | undefined { return this.cursors.get(key); }
  setTriggerCursor(key: string, lastSlot: string): void { this.cursors.set(key, lastSlot); }
  enqueueTrigger(record: { id: string; workflowId: string; queuedAt: string; item: unknown }, maxItems: number): boolean {
    if (this.queue.size >= maxItems || this.queue.has(record.id)) return false;
    this.queue.set(record.id, record);
    return true;
  }
  listQueuedTriggers(limit = 100): Array<{ id: string; workflowId: string; queuedAt: string; item: unknown }> {
    return [...this.queue.values()].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id)).slice(0, limit);
  }
  removeQueuedTrigger(id: string): void { this.queue.delete(id); }
}

// ---------- Despachador ----------

export type TriggerOutcome =
  | { status: 'ran'; runId: string; runStatus: FlowRunResult['status'] }
  | { status: 'deduplicated' }
  | { status: 'queued_offline' }
  | { status: 'skipped_overlap' }
  | { status: 'missed_late'; lateByMs: number }
  | { status: 'stale' }
  | { status: 'queue_full' }
  | { status: 'error'; message: string };

export interface TriggerAuditEntry {
  at: string;
  event: string;
  bindingKey?: string;
  detail?: string;
}

export interface TriggerDispatcherOptions {
  /** Ejecuta un flujo (normalmente `runWorkflowPersisted` con el almacén de SQLite). Debe respetar `trigger.dedupeKey`. */
  run(workflow: AutomationWorkflow, options: Omit<FlowRunOptions, 'resume'>): Promise<FlowRunResult>;
  now?: () => Date;
  online?: () => boolean;
  /** Resuelve `vault:<nombre>` / `env:<NOMBRE>` a su valor. Nunca se registra ni se devuelve. */
  resolveSecret?: (ref: string) => string | undefined;
  state?: TriggerState;
  audit?: (entry: TriggerAuditEntry) => void;
  maxBodyBytes?: number;
  webhookToleranceMs?: number;
  /** Entregas por minuto y por webhook (tras autenticar). */
  webhookRatePerMinute?: number;
  maxQueued?: number;
  queueTtlMs?: number;
}

export interface WebhookRequest {
  method: string;
  /** Ruta sin consulta. */
  path: string;
  headers: Record<string, string | string[] | undefined>;
  /** Cuerpo EXACTO recibido (la firma se calcula sobre estos bytes). */
  body: string;
}

export interface WebhookResponse {
  /** 401 = cualquier fallo ANTES de autenticar (ruta desconocida, cuerpo excesivo, firma mala o caducada): todos idénticos para no revelar qué rutas existen. */
  status: 202 | 400 | 401 | 429;
  body: { ok: boolean; message: string };
  /** Resultado de la ejecución, solo para uso en proceso y pruebas; el HTTP responde sin esperar. */
  done?: Promise<TriggerOutcome>;
}

export interface TickReport {
  at: string;
  fired: Array<{ bindingKey: string; slot: string; missedSlots: number; outcome: TriggerOutcome }>;
}

export class FlowTriggerDispatcher {
  private readonly workflows = new Map<string, AutomationWorkflow>();
  private readonly bound = new Map<string, BoundTrigger>();
  private readonly nextDue = new Map<string, Date | null>();
  private readonly inflight = new Set<string>();
  private readonly deliveries = new Map<string, number[]>();
  private readonly problemsByWorkflow = new Map<string, BindingProblem[]>();
  private readonly now: () => Date;
  private readonly online: () => boolean;
  private readonly state: TriggerState;
  private readonly maxBodyBytes: number;
  private readonly toleranceMs: number;
  private readonly ratePerMinute: number;
  private readonly maxQueued: number;
  private readonly queueTtlMs: number;

  constructor(private readonly options: TriggerDispatcherOptions) {
    this.now = options.now ?? (() => new Date());
    this.online = options.online ?? (() => true);
    this.state = options.state ?? new InMemoryTriggerState();
    this.maxBodyBytes = options.maxBodyBytes ?? 256 * 1024;
    this.toleranceMs = options.webhookToleranceMs ?? 5 * 60_000;
    this.ratePerMinute = options.webhookRatePerMinute ?? 60;
    this.maxQueued = options.maxQueued ?? 500;
    this.queueTtlMs = options.queueTtlMs ?? 24 * 3600_000;
  }

  private audit(event: string, bindingKey?: string, detail?: string): void {
    try { this.options.audit?.({ at: this.now().toISOString(), event, ...(bindingKey ? { bindingKey } : {}), ...(detail ? { detail: detail.slice(0, 300) } : {}) }); } catch { /* la auditoría nunca rompe el despacho */ }
  }

  /** Registra (o reemplaza) un flujo. Desactiva SIEMPRE los enlaces anteriores del mismo flujo; solo un flujo publicado enlaza disparadores. */
  register(workflow: AutomationWorkflow): { bound: number; problems: BindingProblem[] } {
    this.unregister(workflow.id);
    const { bindings, problems } = bindTriggers(workflow);
    const accepted: BoundTrigger[] = [];
    for (const binding of bindings) {
      if (binding.kind === 'webhook') {
        const clash = [...this.bound.values()].find((other) => other.kind === 'webhook' && other.method === binding.method && other.path === binding.path);
        if (clash) { problems.push({ workflowId: workflow.id, nodeId: binding.nodeId, message: `La ruta ${binding.method} ${binding.path} ya la usa el flujo ${clash.workflowId}; no se enlaza (evita secuestros y ambigüedad)` }); continue; }
      }
      accepted.push(binding);
    }
    if (workflow.status === 'published') this.workflows.set(workflow.id, workflow);
    const at = this.now();
    for (const binding of accepted) {
      this.bound.set(binding.key, binding);
      if (binding.kind === 'schedule') {
        const cursor = this.state.getTriggerCursor(binding.key);
        this.nextDue.set(binding.key, nextCronSlot(binding.cron, cursor ? new Date(cursor) : at, binding.timezone));
      }
    }
    this.problemsByWorkflow.set(workflow.id, problems);
    for (const p of problems) this.audit('binding_problem', `${p.workflowId}:${p.nodeId}`, p.message);
    return { bound: accepted.length, problems };
  }

  unregister(workflowId: string): void {
    for (const [key, binding] of [...this.bound]) {
      if (binding.workflowId !== workflowId) continue;
      this.bound.delete(key);
      this.nextDue.delete(key);
      this.inflight.delete(key);
    }
    this.workflows.delete(workflowId);
    this.problemsByWorkflow.delete(workflowId);
  }

  bindings(): BoundTrigger[] {
    return [...this.bound.values()];
  }

  status(): { bindings: number; schedule: number; webhook: number; event: number; queued: number; online: boolean; problems: BindingProblem[]; nextDue: Array<{ bindingKey: string; at: string | null }> } {
    const all = this.bindings();
    return {
      bindings: all.length,
      schedule: all.filter((b) => b.kind === 'schedule').length,
      webhook: all.filter((b) => b.kind === 'webhook').length,
      event: all.filter((b) => b.kind === 'event').length,
      queued: this.state.listQueuedTriggers(this.maxQueued).length,
      online: this.online(),
      problems: [...this.problemsByWorkflow.values()].flat(),
      nextDue: [...this.nextDue].map(([bindingKey, date]) => ({ bindingKey, at: date ? date.toISOString() : null })),
    };
  }

  // ----- Programados -----

  /** Lo llama el runtime periódicamente (p. ej. cada 30 s). Dispara lo vencido: un solo disparo por enlace (el último), si no es demasiado tarde. */
  async tick(): Promise<TickReport> {
    const now = this.now();
    const fired: TickReport['fired'] = [];
    const jobs: Array<Promise<void>> = [];
    for (const binding of this.bound.values()) {
      if (binding.kind !== 'schedule') continue;
      const due = this.nextDue.get(binding.key);
      if (!due || due.getTime() > now.getTime()) continue;
      let slot: Date | null = due;
      let last = due;
      let count = 0;
      while (slot && slot.getTime() <= now.getTime() && count < 100_000) {
        last = slot;
        count += 1;
        slot = nextCronSlot(binding.cron, slot, binding.timezone);
      }
      this.nextDue.set(binding.key, slot);
      this.state.setTriggerCursor(binding.key, last.toISOString(), now.toISOString());
      const missedSlots = count - 1;
      const lateByMs = now.getTime() - last.getTime();
      jobs.push((async () => {
        let outcome: TriggerOutcome;
        if (lateByMs > binding.maxLatenessMs) {
          outcome = { status: 'missed_late', lateByMs };
          this.audit('schedule_missed', binding.key, `disparo de ${last.toISOString()} descartado: ${Math.round(lateByMs / 60_000)} min tarde`);
        } else {
          const payload = { trigger: 'schedule', cron: binding.cron.source, timezone: binding.timezone, scheduledFor: last.toISOString(), firedAt: now.toISOString(), missedSlots };
          outcome = await this.dispatch(binding, payload, `schedule:${binding.nodeId}:${last.toISOString()}`, { type: 'schedule', cron: binding.cron.source, timezone: binding.timezone }, true);
        }
        fired.push({ bindingKey: binding.key, slot: last.toISOString(), missedSlots, outcome });
      })());
    }
    await Promise.all(jobs);
    return { at: now.toISOString(), fired };
  }

  // ----- Eventos -----

  async fireEvent(event: { topic: string; id?: string; payload?: unknown }): Promise<Array<{ bindingKey: string; outcome: TriggerOutcome }>> {
    if (typeof event.topic !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(event.topic)) return [];
    const id = typeof event.id === 'string' && DELIVERY_ID.test(event.id) ? event.id : undefined;
    const results: Array<{ bindingKey: string; outcome: TriggerOutcome }> = [];
    for (const binding of this.bound.values()) {
      if (binding.kind !== 'event') continue;
      const matches = binding.topic.endsWith('.*') ? event.topic.startsWith(binding.topic.slice(0, -1)) : binding.topic === event.topic;
      if (!matches) continue;
      const payload = { trigger: 'event', topic: event.topic, ...(id ? { eventId: id } : {}), data: event.payload ?? null, receivedAt: this.now().toISOString() };
      const outcome = await this.dispatch(binding, payload, id ? `event:${binding.nodeId}:${id}` : undefined, { type: 'event', topic: binding.topic }, true);
      results.push({ bindingKey: binding.key, outcome });
    }
    return results;
  }

  // ----- Webhooks -----

  handleWebhook(request: WebhookRequest): WebhookResponse {
    const generic401: WebhookResponse = { status: 401, body: { ok: false, message: 'No autorizado' } };
    const method = String(request.method).toUpperCase();
    const binding = [...this.bound.values()].find((b): b is Extract<BoundTrigger, { kind: 'webhook' }> => b.kind === 'webhook' && b.method === method && b.path === request.path);
    // Misma respuesta para «no existe», «demasiado grande» y «firma mala»: no se revela qué rutas hay. El motivo real queda en la auditoría.
    if (!binding) { this.audit('webhook_unknown_route', undefined, `${method} ${String(request.path).slice(0, 120)}`); return generic401; }
    if (Buffer.byteLength(request.body, 'utf8') > this.maxBodyBytes) { this.audit('webhook_too_large', binding.key); return generic401; }
    const header = firstHeader(request.headers, 'x-janus-signature');
    const parsed = header ? /^t=(\d{10}),v1=([0-9a-f]{64})$/i.exec(header.trim()) : null;
    if (!parsed) { this.audit('webhook_bad_signature', binding.key, 'cabecera ausente o mal formada'); return generic401; }
    const timestampMs = Number(parsed[1]) * 1000;
    if (Math.abs(this.now().getTime() - timestampMs) > this.toleranceMs) { this.audit('webhook_stale', binding.key, 'marca de tiempo fuera de tolerancia'); return generic401; }
    const secret = this.options.resolveSecret?.(binding.secretRef);
    if (!secret) { this.audit('webhook_secret_missing', binding.key, 'el secreto no está disponible; se rechaza (falla cerrado)'); return generic401; }
    const expected = createHmac('sha256', secret).update(`${parsed[1]}.${request.body}`).digest();
    const received = Buffer.from(parsed[2]!, 'hex');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) { this.audit('webhook_bad_signature', binding.key, 'firma no coincide'); return generic401; }

    const nowMs = this.now().getTime();
    const recent = (this.deliveries.get(binding.key) ?? []).filter((t) => nowMs - t < 60_000);
    if (recent.length >= this.ratePerMinute) { this.audit('webhook_rate_limited', binding.key); return { status: 429, body: { ok: false, message: 'Demasiadas entregas; reintenta más tarde' } }; }
    recent.push(nowMs);
    this.deliveries.set(binding.key, recent);

    let data: unknown = null;
    if (request.body.trim() !== '') {
      try { data = JSON.parse(request.body) as unknown; } catch { return { status: 400, body: { ok: false, message: 'El cuerpo debe ser JSON válido' } }; }
    }
    const headerId = firstHeader(request.headers, 'x-janus-delivery-id');
    const deliveryId = headerId && DELIVERY_ID.test(headerId) ? headerId : createHash('sha256').update(`${parsed[1]}.${request.body}`).digest('hex');
    const payload = { trigger: 'webhook', method, path: binding.path, deliveryId, data, receivedAt: this.now().toISOString() };
    const done = this.dispatch(binding, payload, `webhook:${binding.nodeId}:${deliveryId}`, { type: 'webhook', method: binding.method, path: binding.path }, true);
    return { status: 202, body: { ok: true, message: 'Aceptado' }, done };
  }

  // ----- Sin conexión -----

  /** Al reconectar: revalida y ejecuta lo encolado, del más antiguo al más nuevo. */
  async flushOffline(): Promise<Array<{ id: string; outcome: TriggerOutcome | { status: 'dropped'; reason: string } }>> {
    const results: Array<{ id: string; outcome: TriggerOutcome | { status: 'dropped'; reason: string } }> = [];
    if (!this.online()) return results;
    for (const record of this.state.listQueuedTriggers(this.maxQueued)) {
      const item = record.item as QueuedTrigger;
      const age = this.now().getTime() - new Date(record.queuedAt).getTime();
      const binding = this.bound.get(item.bindingKey);
      const workflow = this.workflows.get(item.workflowId);
      let drop: string | undefined;
      if (age > this.queueTtlMs) drop = 'caducado';
      else if (!binding || !workflow || workflow.revision !== item.revision || workflow.status !== 'published') drop = 'revalidación fallida: el flujo ya no está publicado en esa revisión o el disparador ya no está enlazado';
      if (drop) {
        this.state.removeQueuedTrigger(record.id);
        this.audit('queue_dropped', item.bindingKey, drop);
        results.push({ id: record.id, outcome: { status: 'dropped', reason: drop } });
        continue;
      }
      const outcome = await this.dispatch(binding!, item.payload, item.dedupeKey, item.trigger, false);
      this.state.removeQueuedTrigger(record.id);
      results.push({ id: record.id, outcome });
    }
    return results;
  }

  // ----- Núcleo -----

  private async dispatch(binding: BoundTrigger, payload: unknown, dedupeKey: string | undefined, trigger: AutomationTriggerSpec, allowQueue: boolean): Promise<TriggerOutcome> {
    const workflow = this.workflows.get(binding.workflowId);
    if (!workflow || workflow.revision !== binding.revision || workflow.status !== 'published') {
      this.audit('stale_binding', binding.key);
      return { status: 'stale' };
    }
    if (allowQueue && binding.onlineRequired && !this.online()) {
      const id = dedupeKey ?? `${binding.key}:${this.now().getTime()}:${Math.random().toString(36).slice(2, 8)}`;
      const item: QueuedTrigger = { bindingKey: binding.key, workflowId: binding.workflowId, revision: binding.revision, nodeId: binding.nodeId, dedupeKey: id, payload, trigger };
      if (this.state.listQueuedTriggers(this.maxQueued).some((queued) => queued.id === id)) return { status: 'queued_offline' };
      if (!this.state.enqueueTrigger({ id, workflowId: binding.workflowId, queuedAt: this.now().toISOString(), item }, this.maxQueued)) {
        this.audit('queue_full', binding.key);
        return { status: 'queue_full' };
      }
      this.audit('queued_offline', binding.key);
      return { status: 'queued_offline' };
    }
    if (binding.kind === 'schedule' && this.inflight.has(binding.key)) {
      this.audit('skipped_overlap', binding.key);
      return { status: 'skipped_overlap' };
    }
    this.inflight.add(binding.key);
    try {
      createTriggerEnvelope({ id: dedupeKey ?? binding.key, workflowId: binding.workflowId, workflowRevision: binding.revision, trigger, payload, ...(dedupeKey ? { dedupeKey } : {}), onlineRequired: binding.onlineRequired });
      const result = await this.options.run(workflow, { trigger: { payload, nodeId: binding.nodeId, ...(dedupeKey ? { dedupeKey } : {}) } });
      if (result.status === 'deduplicated') return { status: 'deduplicated' };
      return { status: 'ran', runId: result.runId, runStatus: result.status };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : 'Error desconocido';
      this.audit('run_error', binding.key, message);
      return { status: 'error', message };
    } finally {
      this.inflight.delete(binding.key);
    }
  }
}

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== name) continue;
    return Array.isArray(value) ? value[0] : value;
  }
  return undefined;
}

/** Firma que debe enviar el emisor de un webhook (útil para pruebas y para documentar el contrato). */
export function signWebhook(secret: string, body: string, timestampSeconds: number): string {
  return `t=${timestampSeconds},v1=${createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex')}`;
}

