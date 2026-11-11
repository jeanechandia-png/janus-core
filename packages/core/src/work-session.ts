import { randomUUID } from 'node:crypto';

/**
 * Registro de sesiones de trabajo de un colaborador (plantilla laboral).
 *
 * - Append-only: cada evento lo declara la propia persona desde su dashboard.
 *   No hay captura automática de pantalla, teclado ni actividad del equipo.
 * - El tiempo registrado NO prueba productividad por sí solo: es un dato
 *   declarado que el CEO contrasta con avances y entregas verificables.
 * - Módulo puro (sin E/S): la persistencia vive en SqliteStore y la
 *   autorización en el runtime.
 */
export type WorkSessionEventKind =
  | 'start'
  | 'pause'
  | 'resume'
  | 'progress'
  | 'blocker'
  | 'delivery'
  | 'end';

export const WORK_SESSION_EVENT_KINDS: readonly WorkSessionEventKind[] = [
  'start', 'pause', 'resume', 'progress', 'blocker', 'delivery', 'end',
];

export const WORK_SESSION_NOTE_MAX = 2000;
export const WORK_SESSION_EVIDENCE_MAX = 12;

export interface WorkSessionEvent {
  id: string;
  sessionId: string;
  principalId: string;
  kind: WorkSessionEventKind;
  at: string;
  note?: string;
  projectId?: string;
  assignmentId?: string;
  evidenceRefs?: string[];
}

export type WorkSessionState = 'running' | 'paused' | 'ended';

export interface WorkSessionSummary {
  sessionId: string;
  principalId: string;
  state: WorkSessionState;
  startedAt: string;
  endedAt?: string;
  /** Tiempo declarado en marcha (sin pausas), en segundos. */
  activeSeconds: number;
  pausedSeconds: number;
  pauses: number;
  projectId?: string;
  assignmentId?: string;
  progress: Array<{ at: string; note: string }>;
  blockers: Array<{ at: string; note: string }>;
  deliveries: Array<{ at: string; note: string; evidenceRefs: string[] }>;
  lastEventAt: string;
}

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

function isoOrThrow(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('work session event time is invalid');
  return new Date(time).toISOString();
}

export function validateWorkSessionEvent(event: WorkSessionEvent): WorkSessionEvent {
  if (!SAFE_ID.test(event.id)) throw new Error('work session event id is invalid');
  if (!SAFE_ID.test(event.sessionId)) throw new Error('work session id is invalid');
  if (!event.principalId.trim()) throw new Error('work session principal is required');
  if (!WORK_SESSION_EVENT_KINDS.includes(event.kind)) throw new Error('work session event kind is invalid');
  const note = event.note?.trim();
  if (note && note.length > WORK_SESSION_NOTE_MAX) throw new Error('work session note is too long');
  if ((event.kind === 'progress' || event.kind === 'blocker' || event.kind === 'delivery') && !note) {
    throw new Error(`work session ${event.kind} requires a note`);
  }
  if (event.projectId !== undefined && !SAFE_ID.test(event.projectId)) throw new Error('work session project id is invalid');
  if (event.assignmentId !== undefined && !SAFE_ID.test(event.assignmentId)) throw new Error('work session assignment id is invalid');
  const evidenceRefs = (event.evidenceRefs ?? [])
    .map((ref) => String(ref).trim())
    .filter(Boolean);
  if (evidenceRefs.length > WORK_SESSION_EVIDENCE_MAX) throw new Error('too many evidence references');
  if (evidenceRefs.some((ref) => ref.length > 500)) throw new Error('evidence reference is too long');
  return {
    id: event.id,
    sessionId: event.sessionId,
    principalId: event.principalId.trim(),
    kind: event.kind,
    at: isoOrThrow(event.at),
    ...(note ? { note } : {}),
    ...(event.projectId ? { projectId: event.projectId } : {}),
    ...(event.assignmentId ? { assignmentId: event.assignmentId } : {}),
    ...(evidenceRefs.length ? { evidenceRefs } : {}),
  };
}

function byTime(a: WorkSessionEvent, b: WorkSessionEvent): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Estado de la sesión abierta más reciente de una persona (o `null`). */
export function openWorkSession(
  events: readonly WorkSessionEvent[],
  principalId: string,
): { sessionId: string; state: 'running' | 'paused' } | null {
  const summaries = summarizeWorkSessions(events, principalId, events.at(-1)?.at ?? new Date(0).toISOString());
  const open = summaries.filter((session) => session.state !== 'ended').at(-1);
  return open ? { sessionId: open.sessionId, state: open.state as 'running' | 'paused' } : null;
}

/**
 * Decide el siguiente evento permitido y devuelve el evento listo para guardar.
 * Lanza un error con un código legible si la transición no es válida.
 */
export function nextWorkSessionEvent(input: {
  events: readonly WorkSessionEvent[];
  principalId: string;
  kind: WorkSessionEventKind;
  at: string;
  note?: string;
  projectId?: string;
  assignmentId?: string;
  evidenceRefs?: string[];
  id?: string;
}): WorkSessionEvent {
  const own = input.events.filter((event) => event.principalId === input.principalId);
  const open = openWorkSession(own, input.principalId);
  let sessionId: string;
  if (input.kind === 'start') {
    if (open) throw new Error('work_session_already_open');
    sessionId = `ws_${randomUUID()}`;
  } else {
    if (!open) throw new Error('work_session_not_open');
    if (input.kind === 'pause' && open.state !== 'running') throw new Error('work_session_not_running');
    if (input.kind === 'resume' && open.state !== 'paused') throw new Error('work_session_not_paused');
    sessionId = open.sessionId;
  }
  const last = own.filter((event) => event.sessionId === sessionId).sort(byTime).at(-1);
  const at = isoOrThrow(input.at);
  if (last && at < last.at) throw new Error('work_session_time_regression');
  return validateWorkSessionEvent({
    id: input.id ?? `wse_${randomUUID()}`,
    sessionId,
    principalId: input.principalId,
    kind: input.kind,
    at,
    ...(input.note !== undefined ? { note: input.note } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
    ...(input.evidenceRefs ? { evidenceRefs: input.evidenceRefs } : {}),
  });
}

/** Resume las sesiones de UNA persona. `now` cierra el cómputo de las abiertas. */
export function summarizeWorkSessions(
  events: readonly WorkSessionEvent[],
  principalId: string,
  now: string,
): WorkSessionSummary[] {
  const nowMs = Date.parse(now);
  const groups = new Map<string, WorkSessionEvent[]>();
  for (const event of events) {
    if (event.principalId !== principalId) continue;
    const list = groups.get(event.sessionId) ?? [];
    list.push(event);
    groups.set(event.sessionId, list);
  }
  const summaries: WorkSessionSummary[] = [];
  for (const [sessionId, list] of groups) {
    list.sort(byTime);
    const first = list[0];
    if (!first || first.kind !== 'start') continue;
    let state: WorkSessionState = 'running';
    let activeMs = 0;
    let pausedMs = 0;
    let pauses = 0;
    let cursor = Date.parse(first.at);
    let endedAt: string | undefined;
    const progress: WorkSessionSummary['progress'] = [];
    const blockers: WorkSessionSummary['blockers'] = [];
    const deliveries: WorkSessionSummary['deliveries'] = [];
    let projectId = first.projectId;
    let assignmentId = first.assignmentId;
    for (const event of list.slice(1)) {
      if (state === 'ended') break;
      const at = Date.parse(event.at);
      const delta = Math.max(0, at - cursor);
      if (state === 'running') activeMs += delta; else pausedMs += delta;
      cursor = at;
      if (event.projectId) projectId = event.projectId;
      if (event.assignmentId) assignmentId = event.assignmentId;
      if (event.kind === 'pause' && state === 'running') { state = 'paused'; pauses += 1; }
      else if (event.kind === 'resume' && state === 'paused') state = 'running';
      else if (event.kind === 'end') { state = 'ended'; endedAt = event.at; }
      else if (event.kind === 'progress' && event.note) progress.push({ at: event.at, note: event.note });
      else if (event.kind === 'blocker' && event.note) blockers.push({ at: event.at, note: event.note });
      else if (event.kind === 'delivery' && event.note) {
        deliveries.push({ at: event.at, note: event.note, evidenceRefs: [...(event.evidenceRefs ?? [])] });
      }
    }
    if (state !== 'ended' && Number.isFinite(nowMs)) {
      const delta = Math.max(0, nowMs - cursor);
      if (state === 'running') activeMs += delta; else pausedMs += delta;
    }
    summaries.push({
      sessionId,
      principalId,
      state,
      startedAt: first.at,
      ...(endedAt ? { endedAt } : {}),
      activeSeconds: Math.round(activeMs / 1000),
      pausedSeconds: Math.round(pausedMs / 1000),
      pauses,
      ...(projectId ? { projectId } : {}),
      ...(assignmentId ? { assignmentId } : {}),
      progress,
      blockers,
      deliveries,
      lastEventAt: list.at(-1)!.at,
    });
  }
  return summaries.sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0));
}
