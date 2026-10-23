import type { FlowRunRecord, FlowRunEventRecord, FlowRunStatus } from '../../core/src/sqlite-store.js';
import { runWorkflow, type ApprovalDecision, type FlowDeps, type FlowEvent, type FlowRunOptions, type FlowRunResult, type FlowRunSnapshot } from './flow-runner.js';
import { redactSecrets } from './secret-shape.js';
import type { AutomationWorkflow } from './workflow.js';

// La definición de «aspecto de secreto» vive en secret-shape.ts (la comparte el editor de flujos); se reexporta por compatibilidad.
export { redactSecrets };

/**
 * Persistencia de las ejecuciones de flujos (local-first: SQLite guarda estado y auditoría).
 * - La desduplicación del disparador sobrevive a reinicios (no se repite una acción por reiniciar el servidor).
 * - Cada evento del flujo se guarda en orden, sin parámetros ni secretos (así los emite el ejecutor).
 * - La instantánea para reanudar se guarda con los valores de aspecto secreto sustituidos por `[redacted]`; si se ocultó
 *   algo, la ejecución NO se puede reanudar (falla cerrado) en lugar de continuar con datos alterados.
 * - Un flujo pausado (aprobación o espera) se reanuda con `resumeWorkflowRun` aunque haya cambiado el proceso.
 */
export interface FlowRunPersistence {
  claimFlowKey(key: string, at: string): boolean;
  saveFlowRun(record: FlowRunRecord): void;
  getFlowRun(runId: string): FlowRunRecord | undefined;
  appendFlowRunEvent(event: Omit<FlowRunEventRecord, 'seq'>): void;
}

const MAX_SNAPSHOT_BYTES = 2_000_000;

function toRecord(result: FlowRunResult, previous: FlowRunRecord | undefined, now: Date): FlowRunRecord {
  const redacted = redactSecrets({ snapshot: result.snapshot, outputs: result.outputs });
  const body = redacted.value as { snapshot: unknown; outputs: unknown };
  const snapshotBytes = Buffer.byteLength(JSON.stringify(body.snapshot ?? null), 'utf8');
  const tooBig = snapshotBytes > MAX_SNAPSHOT_BYTES;
  const finished = result.status !== 'paused';
  const at = now.toISOString();
  return {
    runId: result.runId,
    workflowId: result.snapshot.workflowId,
    revision: result.snapshot.revision,
    status: result.status as FlowRunStatus,
    startedAt: previous?.startedAt ?? result.log[0]?.at ?? at,
    updatedAt: at,
    ...(finished ? { finishedAt: at } : {}),
    ...(tooBig ? {} : { snapshot: body.snapshot }),
    resumable: result.status === 'paused' && !tooBig && redacted.redactions === 0,
    redactions: redacted.redactions,
    outputs: body.outputs,
    pendingApprovals: result.pendingApprovals,
    waiting: result.waiting,
    ...(result.error ? { error: result.error } : {}),
  };
}

function withPersistence(deps: FlowDeps, store: FlowRunPersistence): FlowDeps {
  const now = deps.now ?? (() => new Date());
  return {
    ...deps,
    runStore: { claim: (key: string) => store.claimFlowKey(key, now().toISOString()) },
    onEvent: async (event: FlowEvent) => {
      store.appendFlowRunEvent({ runId: event.runId, at: event.at, type: event.type, ...(event.nodeId ? { nodeId: event.nodeId } : {}), ...(event.attempt !== undefined ? { attempt: event.attempt } : {}), ...(event.detail ? { detail: event.detail } : {}) });
      await deps.onEvent?.(event);
    },
  };
}

/** Ejecuta un flujo y guarda la ejecución (estado, salidas, eventos y, si queda pausado, la instantánea). */
export async function runWorkflowPersisted(
  workflow: AutomationWorkflow,
  options: Omit<FlowRunOptions, 'resume'>,
  deps: FlowDeps,
  store: FlowRunPersistence,
): Promise<FlowRunResult> {
  const now = deps.now ?? (() => new Date());
  const result = await runWorkflow(workflow, options, withPersistence(deps, store));
  store.saveFlowRun(toRecord(result, store.getFlowRun(result.runId), now()));
  return result;
}

export class FlowResumeError extends Error {
  constructor(readonly code: 'not_found' | 'not_paused' | 'not_resumable' | 'workflow_mismatch', message: string) {
    super(message);
    this.name = 'FlowResumeError';
  }
}

/** Reanuda una ejecución pausada con las decisiones de aprobación indicadas. Falla cerrado si la instantánea no es fiable. */
export async function resumeWorkflowRun(
  workflow: AutomationWorkflow,
  runId: string,
  approvals: Record<string, ApprovalDecision>,
  deps: FlowDeps,
  store: FlowRunPersistence,
): Promise<FlowRunResult> {
  const record = store.getFlowRun(runId);
  if (!record) throw new FlowResumeError('not_found', `No existe la ejecución ${runId}`);
  if (record.status !== 'paused') throw new FlowResumeError('not_paused', `La ejecución ${runId} no está pausada (estado: ${record.status})`);
  if (!record.resumable || !record.snapshot) {
    throw new FlowResumeError('not_resumable', `La ejecución ${runId} no se puede reanudar con seguridad${record.redactions ? ': su instantánea contiene datos ocultados' : ''}`);
  }
  if (record.workflowId !== workflow.id || record.revision !== workflow.revision) {
    throw new FlowResumeError('workflow_mismatch', 'La ejecución pertenece a otro flujo o a otra revisión');
  }
  const now = deps.now ?? (() => new Date());
  const result = await runWorkflow(workflow, { resume: { snapshot: record.snapshot as FlowRunSnapshot, approvals } }, withPersistence(deps, store));
  store.saveFlowRun(toRecord(result, record, now()));
  return result;
}
