import { isValidYmd, addDays } from './time.js';
import { stripLinks } from './safety.js';

export type TaskStatus = 'pendiente' | 'en-curso' | 'hecha';

export interface SchoolTask {
  id: string;
  title: string;
  subject?: string;
  due?: string;
  status: TaskStatus;
  projectId?: string;
  steps?: { text: string; done: boolean }[];
  createdBy: 'kid' | 'parent';
  doneAt?: string;
}

export interface SchoolProject { id: string; title: string; emoji?: string }

export type TaskValidation = { ok: true; task: Omit<SchoolTask, 'id'> } | { ok: false; message: string };

const clean = (value: unknown, max: number) => (typeof value === 'string' ? stripLinks(value).replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function normalizeTaskInput(input: unknown, createdBy: 'kid' | 'parent', knownProjectIds: readonly string[] = []): TaskValidation {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const title = clean(raw.title, 100);
  if (!title) return { ok: false, message: 'Escribe qué tienes que hacer.' };
  if (raw.due !== undefined && raw.due !== '' && !isValidYmd(raw.due)) return { ok: false, message: 'La fecha de entrega no es válida.' };
  if (raw.projectId !== undefined && raw.projectId !== '' && !knownProjectIds.includes(String(raw.projectId))) return { ok: false, message: 'Ese proyecto no existe.' };
  const steps = Array.isArray(raw.steps)
    ? raw.steps.slice(0, 12).map((step) => ({ text: clean((step as { text?: unknown })?.text, 80), done: (step as { done?: unknown })?.done === true })).filter((step) => step.text)
    : undefined;
  const subject = clean(raw.subject, 30);
  return {
    ok: true,
    task: {
      title,
      ...(subject ? { subject } : {}),
      ...(typeof raw.due === 'string' && raw.due ? { due: raw.due } : {}),
      status: 'pendiente',
      ...(typeof raw.projectId === 'string' && raw.projectId ? { projectId: raw.projectId } : {}),
      ...(steps && steps.length > 0 ? { steps } : {}),
      createdBy,
    },
  };
}

export function setTaskStatus(tasks: readonly SchoolTask[], id: string, status: TaskStatus, nowIso: string): SchoolTask[] {
  return tasks.map((task) => {
    if (task.id !== id) return task;
    const { doneAt: _drop, ...rest } = task;
    return status === 'hecha' ? { ...rest, status, doneAt: nowIso, ...(rest.steps ? { steps: rest.steps.map((step) => ({ ...step, done: true })) } : {}) } : { ...rest, status };
  });
}

export function toggleStep(tasks: readonly SchoolTask[], id: string, index: number): SchoolTask[] {
  return tasks.map((task) => {
    if (task.id !== id || !task.steps?.[index]) return task;
    const steps = task.steps.map((step, i) => (i === index ? { ...step, done: !step.done } : step));
    const allDone = steps.every((step) => step.done);
    return { ...task, steps, status: allDone ? 'hecha' : task.status === 'hecha' ? 'en-curso' : task.status };
  });
}

export function overdueTasks(tasks: readonly SchoolTask[], today: string): SchoolTask[] {
  return tasks.filter((task) => task.status !== 'hecha' && task.due !== undefined && task.due < today).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
}

export function dueSoonTasks(tasks: readonly SchoolTask[], today: string, days = 7): SchoolTask[] {
  const last = addDays(today, days);
  return tasks.filter((task) => task.status !== 'hecha' && task.due !== undefined && task.due >= today && task.due <= last).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
}

export function projectProgress(projectId: string, tasks: readonly SchoolTask[]): { done: number; total: number; percent: number } {
  const own = tasks.filter((task) => task.projectId === projectId);
  const done = own.filter((task) => task.status === 'hecha').length;
  return { done, total: own.length, percent: own.length === 0 ? 0 : Math.round((done / own.length) * 100) };
}

export function normalizeProjectInput(input: unknown): { ok: true; project: Omit<SchoolProject, 'id'> } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const title = clean(raw.title, 60);
  if (!title) return { ok: false, message: 'Ponle nombre al proyecto.' };
  const emoji = typeof raw.emoji === 'string' && [...raw.emoji].length <= 2 ? raw.emoji : undefined;
  return { ok: true, project: { title, ...(emoji ? { emoji } : {}) } };
}
