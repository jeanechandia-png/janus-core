/**
 * Agenda del colaborador (plantilla laboral).
 *
 * Privacidad (decisión del CEO, 10-nov-2026):
 * - 'private': recordatorios personales. Solo los ve su dueño. El CEO NO los recibe por ninguna ruta.
 * - 'work':    todo lo relacionado con la empresa. Lo ven su dueño y el CEO.
 * Reglas que no dependen de la interfaz: la disponibilidad de trabajo y cualquier elemento ligado a un
 * proyecto son SIEMPRE 'work' (un asunto de empresa no puede marcarse como privado).
 * Módulo puro: la persistencia vive en SqliteStore y la autorización en el runtime.
 */
export type WorkAgendaKind = 'reminder' | 'availability';
export type WorkAgendaVisibility = 'private' | 'work';

export interface WorkAgendaItem {
  id: string;
  principalId: string;
  kind: WorkAgendaKind;
  visibility: WorkAgendaVisibility;
  /** Día local de la persona, AAAA-MM-DD. */
  date: string;
  /** HH:MM (opcional). En disponibilidad es la hora de inicio. */
  time?: string;
  endTime?: string;
  text: string;
  projectId?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export const WORK_AGENDA_TEXT_MAX = 500;
export const WORK_AGENDA_MAX_ITEMS = 400;

const SAFE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateWorkAgendaItem(item: WorkAgendaItem): WorkAgendaItem {
  if (!SAFE_ID.test(item.id)) throw new Error('agenda item id is invalid');
  if (!item.principalId.trim()) throw new Error('agenda principal is required');
  if (item.kind !== 'reminder' && item.kind !== 'availability') throw new Error('agenda kind is invalid');
  if (!validDate(item.date)) throw new Error('agenda date is invalid');
  if (item.time !== undefined && !TIME.test(item.time)) throw new Error('agenda time is invalid');
  if (item.endTime !== undefined && !TIME.test(item.endTime)) throw new Error('agenda end time is invalid');
  if (item.time && item.endTime && item.endTime <= item.time) throw new Error('agenda end time must be after start');
  const text = item.text.trim();
  if (item.kind === 'reminder' && !text) throw new Error('agenda text is required');
  if (text.length > WORK_AGENDA_TEXT_MAX) throw new Error('agenda text is too long');
  if (item.projectId !== undefined && !SAFE_ID.test(item.projectId)) throw new Error('agenda project id is invalid');
  if (!Number.isFinite(Date.parse(item.createdAt)) || !Number.isFinite(Date.parse(item.updatedAt))) {
    throw new Error('agenda timestamps are invalid');
  }
  // Un asunto de empresa nunca es privado, lo pida quien lo pida.
  const visibility: WorkAgendaVisibility = item.kind === 'availability' || item.projectId
    ? 'work'
    : item.visibility === 'work' ? 'work' : 'private';
  return {
    id: item.id,
    principalId: item.principalId.trim(),
    kind: item.kind,
    visibility,
    date: item.date,
    ...(item.time ? { time: item.time } : {}),
    ...(item.endTime ? { endTime: item.endTime } : {}),
    text,
    ...(item.projectId ? { projectId: item.projectId } : {}),
    done: item.done === true,
    createdAt: new Date(item.createdAt).toISOString(),
    updatedAt: new Date(item.updatedAt).toISOString(),
  };
}

function byWhen(a: WorkAgendaItem, b: WorkAgendaItem): number {
  const ka = `${a.date} ${a.time ?? '99:99'} ${a.id}`;
  const kb = `${b.date} ${b.time ?? '99:99'} ${b.id}`;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/** Lo que ve la propia persona: todo lo suyo (privado incluido), nada de nadie más. */
export function agendaForOwner(items: readonly WorkAgendaItem[], principalId: string, fromDate?: string): WorkAgendaItem[] {
  return items
    .filter((item) => item.principalId === principalId && (!fromDate || item.date >= fromDate || !item.done))
    .map((item) => ({ ...item }))
    .sort(byWhen);
}

/** Lo que ve el CEO: solo asuntos de empresa. Los privados no salen ni resumidos ni contados. */
export function agendaForFounder(items: readonly WorkAgendaItem[], principalId?: string): WorkAgendaItem[] {
  return items
    .filter((item) => item.visibility === 'work' && (!principalId || item.principalId === principalId))
    .map((item) => ({ ...item }))
    .sort(byWhen);
}
