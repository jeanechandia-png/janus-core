import { createHash } from 'node:crypto';
import { capabilitiesForRole, type AgentRole } from './agent-swarm.js';

/**
 * Adaptador entre el nodo `ai.agent` de los flujos y el Agent Swarm: enruta la tarea al agente adecuado, exige verificación INDEPENDIENTE
 * cuando el riesgo lo pide y deja un traspaso (handoff) auditable sin contenido.
 *
 * Es un puerto: los agentes reales (modelo de lenguaje, herramienta local…) se inyectan como `FlowAgentExecutor`; aquí no hay red ni gasto.
 * Los tipos de petición son estructurales (compatibles con `AgentRunRequest` del motor) para que `orchestrator` no dependa de `automation`.
 *
 * Reglas (probadas en tests/flow-agent-adapter.test.ts):
 * - Enrutado por capacidades: solo agentes que cubren TODAS las `requiredCapabilities`; si ninguno las cubre, falla con lo que falta (no adivina).
 *   Desempate: local primero si `preferLocal`, más `preferredCapabilities` cubiertas, ajuste más estrecho, id.
 * - `requireLocal` excluye cualquier agente no local (productor y verificador); `preferLocal` solo ordena (local-first).
 * - Verificación (`auto` por defecto): se exige con riesgo medio/alto o acción irreversible. La hace un agente de rol `verifier` DISTINTO del productor
 *   y solo la aprueba un veredicto exactamente `{ ok: true }`; cualquier otra cosa (texto, `"true"`, vacío, error) se trata como rechazo. Sin verificador
 *   independiente disponible, falla cerrado: el resultado del productor NO se devuelve.
 * - El objetivo lo escribe quien diseña el flujo (fiable); la entrada son datos (no fiable) y viaja en su propio campo, nunca mezclada con el objetivo.
 * - El traspaso registra quién, qué capacidades, veredicto, tamaños, tiempos y huellas SHA-256; nunca el contenido de la entrada ni de la salida.
 */

export type AgentRisk = 'none' | 'low' | 'medium' | 'high';

export interface FlowAgentRequest {
  objective: string;
  requiredCapabilities: string[];
  input: unknown;
  nodeId: string;
  preferredCapabilities?: string[];
  requireLocal?: boolean;
  preferLocal?: boolean;
  risk?: AgentRisk;
  reversible?: boolean;
}

export interface AgentTask {
  mode: 'produce' | 'verify';
  objective: string;
  /** Datos de entrada: contenido NO fiable. El agente debe tratarlo como dato, nunca como instrucción. */
  input: unknown;
  /** Solo en `verify`: el resultado propuesto por otro agente. */
  candidate?: unknown;
  nodeId: string;
  role: AgentRole;
  signal: AbortSignal;
}

export interface FlowAgentExecutor {
  id: string;
  role: AgentRole;
  local: boolean;
  /** Por defecto, las que el Agent Swarm atribuye al rol. */
  capabilities?: string[];
  run(task: AgentTask): Promise<{ output: unknown }>;
}

export type HandoffStatus = 'unverified' | 'accepted' | 'rejected' | 'failed';

export interface AgentHandoff {
  at: string;
  nodeId: string;
  /** Primeros 300 caracteres del objetivo (lo escribe el diseñador del flujo, no contiene datos de la entrada). */
  objective: string;
  requiredCapabilities: string[];
  risk: AgentRisk | undefined;
  producer?: { id: string; role: AgentRole; local: boolean };
  verifier?: { id: string; role: AgentRole; local: boolean; ok: boolean; reasons: string[] };
  status: HandoffStatus;
  error?: string;
  inputSha256: string;
  outputSha256?: string;
  outputBytes?: number;
  durationMs: number;
}

export type VerificationPolicy = 'never' | 'auto' | 'always';

export interface FlowAgentAdapterOptions {
  executors: FlowAgentExecutor[];
  /** `auto` (por defecto): exige verificación con riesgo medio/alto o acción irreversible. */
  verify?: VerificationPolicy;
  timeoutMs?: number;
  maxOutputBytes?: number;
  onHandoff?: (handoff: AgentHandoff) => void;
  now?: () => Date;
}

export class AgentRoutingError extends Error { constructor(message: string) { super(message); this.name = 'AgentRoutingError'; } }
export class AgentVerificationError extends Error { constructor(message: string) { super(message); this.name = 'AgentVerificationError'; } }
export class AgentOutputError extends Error { constructor(message: string) { super(message); this.name = 'AgentOutputError'; } }
export class AgentTimeoutError extends Error { constructor(message: string) { super(message); this.name = 'AgentTimeoutError'; } }

const capsOf = (e: FlowAgentExecutor): string[] => e.capabilities ?? capabilitiesForRole(e.role);
const sha = (value: unknown): string => createHash('sha256').update(JSON.stringify(value ?? null) ?? 'null').digest('hex');

export interface RouteQuery {
  required: readonly string[];
  preferred?: readonly string[];
  requireLocal?: boolean;
  preferLocal?: boolean;
  /** Ids que no pueden elegirse (p. ej. el productor, al buscar verificador). */
  exclude?: readonly string[];
  role?: AgentRole;
}

/** Elige el agente que cubre todas las capacidades exigidas; lanza `AgentRoutingError` indicando qué falta si ninguno las cubre. */
export function routeExecutor(executors: readonly FlowAgentExecutor[], query: RouteQuery): FlowAgentExecutor {
  const pool = executors.filter((e) => !(query.exclude ?? []).includes(e.id) && (!query.role || e.role === query.role));
  const eligible = query.requireLocal ? pool.filter((e) => e.local) : pool;
  const covering = eligible.filter((e) => query.required.every((c) => capsOf(e).includes(c)));
  if (covering.length === 0) {
    if (eligible.length === 0) {
      throw new AgentRoutingError(query.requireLocal && pool.length > 0
        ? 'Ningún agente local disponible (la tarea exige ejecución local)'
        : query.role ? `No hay ningún agente con rol ${query.role} disponible` : 'No hay agentes disponibles');
    }
    // El más cercano: el que menos capacidades exigidas le faltan.
    const missing = eligible.map((e) => ({ id: e.id, missing: query.required.filter((c) => !capsOf(e).includes(c)) })).sort((a, b) => a.missing.length - b.missing.length || a.id.localeCompare(b.id))[0]!;
    throw new AgentRoutingError(`Ningún agente cubre las capacidades exigidas; al más cercano (${missing.id}) le faltan: ${missing.missing.join(', ')}`);
  }
  const preferred = query.preferred ?? [];
  const score = (e: FlowAgentExecutor) => ({
    local: query.preferLocal && e.local ? 0 : 1,
    pref: -preferred.filter((c) => capsOf(e).includes(c)).length,
    extra: capsOf(e).length - query.required.length,
  });
  return covering.slice().sort((a, b) => {
    const x = score(a);
    const y = score(b);
    return x.local - y.local || x.pref - y.pref || x.extra - y.extra || a.id.localeCompare(b.id);
  })[0]!;
}

export class FlowAgentAdapter {
  private readonly policy: VerificationPolicy;
  private readonly timeoutMs: number;
  private readonly maxOutputBytes: number;
  private readonly now: () => Date;

  constructor(private readonly options: FlowAgentAdapterOptions) {
    this.policy = options.verify ?? 'auto';
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.maxOutputBytes = options.maxOutputBytes ?? 1_000_000;
    this.now = options.now ?? (() => new Date());
  }

  /** Pasar como `FlowDeps.agent`. */
  readonly run = async (request: FlowAgentRequest): Promise<{ output: unknown }> => {
    const startedAt = this.now().getTime();
    const handoff: AgentHandoff = {
      at: new Date(startedAt).toISOString(),
      nodeId: String(request.nodeId ?? ''),
      objective: String(request.objective ?? '').slice(0, 300),
      requiredCapabilities: Array.isArray(request.requiredCapabilities) ? request.requiredCapabilities.filter((c): c is string => typeof c === 'string') : [],
      risk: request.risk,
      status: 'failed',
      inputSha256: sha(request.input),
      durationMs: 0,
    };
    let finished = false;
    const finish = (status: HandoffStatus, error?: string): void => {
      if (finished) return;
      finished = true;
      handoff.status = status;
      if (error) handoff.error = error.slice(0, 300);
      handoff.durationMs = this.now().getTime() - startedAt;
      try { this.options.onHandoff?.(handoff); } catch { /* la auditoría nunca rompe la tarea */ }
    };
    try {
      if (typeof request.objective !== 'string' || request.objective.trim() === '' || request.objective.length > 4000) throw new AgentRoutingError('Objetivo vacío o demasiado largo (máx. 4000 caracteres)');
      if (!Array.isArray(request.requiredCapabilities) || request.requiredCapabilities.some((c) => typeof c !== 'string')) throw new AgentRoutingError('requiredCapabilities debe ser una lista de textos');

      const producer = routeExecutor(this.options.executors, {
        required: request.requiredCapabilities,
        ...(request.preferredCapabilities ? { preferred: request.preferredCapabilities } : {}),
        ...(request.requireLocal !== undefined ? { requireLocal: request.requireLocal } : {}),
        ...(request.preferLocal !== undefined ? { preferLocal: request.preferLocal } : {}),
      });
      handoff.producer = { id: producer.id, role: producer.role, local: producer.local };

      const produced = await this.invoke(producer, { mode: 'produce', objective: request.objective, input: request.input, nodeId: request.nodeId });
      const bytes = Buffer.byteLength(JSON.stringify(produced.output ?? null) ?? 'null', 'utf8');
      if (bytes > this.maxOutputBytes) throw new AgentOutputError(`La salida del agente supera el máximo (${bytes} > ${this.maxOutputBytes} bytes)`);
      handoff.outputBytes = bytes;
      handoff.outputSha256 = sha(produced.output);

      if (!this.needsVerification(request)) {
        finish('unverified');
        return { output: produced.output };
      }

      let verifier: FlowAgentExecutor;
      try {
        verifier = routeExecutor(this.options.executors, {
          required: [],
          role: 'verifier',
          exclude: [producer.id],
          ...(request.requireLocal !== undefined ? { requireLocal: request.requireLocal } : {}),
          ...(request.preferLocal !== undefined ? { preferLocal: request.preferLocal } : {}),
        });
      } catch (routing) {
        // Sin verificador independiente no hay garantías: falla cerrado, el resultado del productor NO se devuelve.
        const reason = routing instanceof Error ? routing.message : 'sin verificador';
        finish('rejected', `sin verificador independiente: ${reason}`);
        throw new AgentVerificationError(`Se exige verificación independiente y no hay un agente verificador distinto del productor; no se devuelve el resultado sin verificar (${reason})`);
      }
      const verdictRaw = await this.invoke(verifier, { mode: 'verify', objective: request.objective, input: request.input, candidate: produced.output, nodeId: request.nodeId });
      const verdict = parseVerdict(verdictRaw.output);
      handoff.verifier = { id: verifier.id, role: verifier.role, local: verifier.local, ok: verdict.ok, reasons: verdict.reasons };
      if (!verdict.ok) {
        const why = verdict.reasons.length ? verdict.reasons.join('; ') : 'sin motivo indicado';
        finish('rejected', `rechazado por ${verifier.id}: ${why}`);
        throw new AgentVerificationError(`El verificador ${verifier.id} rechazó el resultado: ${why}`);
      }
      finish('accepted');
      return { output: produced.output };
    } catch (error) {
      finish('failed', error instanceof Error ? error.message : 'Error desconocido');
      throw error;
    }
  };

  private needsVerification(request: FlowAgentRequest): boolean {
    if (this.policy === 'never') return false;
    if (this.policy === 'always') return true;
    return request.risk === 'medium' || request.risk === 'high' || request.reversible === false;
  }

  private async invoke(executor: FlowAgentExecutor, task: Omit<AgentTask, 'role' | 'signal'>): Promise<{ output: unknown }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new AgentTimeoutError(`El agente ${executor.id} no respondió en ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      // Sin unref: este temporizador debe mantener vivo el proceso hasta que dispare o se limpie en `finally`; si no, un proceso que
      // solo espera al agente terminaría en silencio sin llegar a cortar la tarea.
    });
    try {
      return await Promise.race([executor.run({ ...task, role: executor.role, signal: controller.signal }), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function parseVerdict(output: unknown): { ok: boolean; reasons: string[] } {
  if (typeof output !== 'object' || output === null) return { ok: false, reasons: ['veredicto del verificador ilegible'] };
  const record = output as Record<string, unknown>;
  const reasons = Array.isArray(record.reasons) ? record.reasons.filter((r): r is string => typeof r === 'string').slice(0, 5).map((r) => r.slice(0, 200)) : [];
  if (record.ok !== true) return { ok: false, reasons: reasons.length ? reasons : record.ok === false ? [] : ['veredicto del verificador ilegible'] };
  return { ok: true, reasons };
}
