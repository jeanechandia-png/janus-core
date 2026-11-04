import { HM, addDays, daysBetween, foldAccents, hmToMinutes, isValidYmd, localTime, weekdayOf } from './time.js';
import { stripLinks } from './safety.js';

export const AGENDA_KINDS = ['cita', 'turno', 'escuela', 'cumple', 'actividad', 'recordatorio'] as const;
export type AgendaKind = (typeof AGENDA_KINDS)[number];

export interface AgendaItem {
  id: string;
  title: string;
  date: string;
  time?: string;
  kind: AgendaKind;
  notes?: string;
  /** Minutos antes del evento en que se recuerda (0 = a la hora). */
  remindMinutesBefore: number[];
  createdBy: 'kid' | 'parent';
  done?: boolean;
}

export const DEFAULT_REMINDERS = [60, 0];
const DEFAULT_EVENT_TIME = '09:00';

export type AgendaValidation = { ok: true; item: Omit<AgendaItem, 'id'> } | { ok: false; message: string };

export function normalizeAgendaInput(input: unknown, createdBy: 'kid' | 'parent'): AgendaValidation {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? stripLinks(raw.title).replace(/\s+/g, ' ').trim() : '';
  if (title.length < 1 || title.length > 80) return { ok: false, message: 'El título debe tener entre 1 y 80 letras.' };
  if (!isValidYmd(raw.date)) return { ok: false, message: 'La fecha no es válida.' };
  if (raw.time !== undefined && raw.time !== '' && (typeof raw.time !== 'string' || !HM.test(raw.time))) return { ok: false, message: 'La hora debe ser HH:MM.' };
  const kind = raw.kind === undefined ? 'recordatorio' : raw.kind;
  if (typeof kind !== 'string' || !(AGENDA_KINDS as readonly string[]).includes(kind)) return { ok: false, message: 'Tipo de evento no válido.' };
  const reminders = Array.isArray(raw.remindMinutesBefore) ? raw.remindMinutesBefore : DEFAULT_REMINDERS;
  const cleaned = [...new Set(reminders.filter((value): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2880))].slice(0, 4);
  const notes = typeof raw.notes === 'string' ? stripLinks(raw.notes).trim().slice(0, 300) : undefined;
  return {
    ok: true,
    item: {
      title,
      date: raw.date as string,
      ...(typeof raw.time === 'string' && raw.time ? { time: raw.time } : {}),
      kind: kind as AgendaKind,
      ...(notes ? { notes } : {}),
      remindMinutesBefore: cleaned.length > 0 ? cleaned.sort((a, b) => b - a) : DEFAULT_REMINDERS,
      createdBy,
    },
  };
}

const sortKey = (item: AgendaItem) => `${item.date} ${item.time ?? '99:99'}`;

export function upcomingAgenda(items: readonly AgendaItem[], now: Date, timeZone: string, days = 14): AgendaItem[] {
  const today = localTime(now, timeZone).ymd;
  const last = addDays(today, days);
  return items.filter((item) => !item.done && item.date >= today && item.date <= last).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

const epochMinutes = (ymd: string, minutes: number) => daysBetween('1970-01-01', ymd) * 1440 + minutes;

export interface DueReminder { key: string; item: AgendaItem; minutesBefore: number; minutesUntilEvent: number }

/** Recordatorios que ya tocan y no se han entregado. Un evento sin hora cuenta como las 09:00. Caduca 60 min después del evento. */
export function dueReminders(items: readonly AgendaItem[], now: Date, timeZone: string, delivered: ReadonlySet<string>): DueReminder[] {
  const local = localTime(now, timeZone);
  const nowMinutes = epochMinutes(local.ymd, local.minutesOfDay);
  const due: DueReminder[] = [];
  for (const item of items) {
    if (item.done) continue;
    const event = epochMinutes(item.date, hmToMinutes(item.time ?? DEFAULT_EVENT_TIME));
    for (const before of item.remindMinutesBefore) {
      const key = `${item.id}:${before}`;
      const at = event - before;
      if (nowMinutes >= at && nowMinutes <= event + 60 && !delivered.has(key)) due.push({ key, item, minutesBefore: before, minutesUntilEvent: event - nowMinutes });
    }
  }
  return due.sort((a, b) => a.minutesUntilEvent - b.minutesUntilEvent);
}

export function reminderText(due: DueReminder): string {
  const { item, minutesUntilEvent } = due;
  if (minutesUntilEvent <= 0) return `Ahora: ${item.title}`;
  if (minutesUntilEvent < 90) return `En ${minutesUntilEvent} minutos: ${item.title}`;
  return `Hoy${item.time ? ` a las ${item.time}` : ''}: ${item.title}`;
}

// ── Voz: «el sábado tengo el cumpleaños de mi prima», «mañana a las 5 tengo dentista» ─────────────────────────

const WEEKDAY_WORDS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };

function nextWeekday(todayYmd: string, weekday: number, forceNext: boolean): string {
  const today = weekdayOf(todayYmd);
  let delta = (weekday - today + 7) % 7;
  if (delta === 0 && forceNext) delta = 7;
  return addDays(todayYmd, delta);
}

export interface AgendaDraft { title: string; date: string; time?: string; kind: AgendaKind }

/** Texto plegado (sin tildes, misma longitud) + marcas de lo ya consumido, para conservar acentos y ñ en el título. */
class Cutter {
  readonly folded: string;
  private readonly removed: boolean[];
  constructor(private readonly original: string) {
    this.folded = foldAccents(original);
    this.removed = new Array<boolean>(original.length).fill(false);
  }
  /** Busca en el texto no consumido; marca lo encontrado y devuelve sus grupos. */
  take(pattern: RegExp): RegExpExecArray | null {
    const view = this.view();
    const match = pattern.exec(view);
    if (!match) return null;
    for (let index = match.index; index < match.index + match[0].length; index += 1) this.removed[index] = true;
    return match;
  }
  has(pattern: RegExp): boolean { return pattern.test(this.view()); }
  private view(): string { return this.folded.split('').map((char, index) => (this.removed[index] ? ' ' : char)).join(''); }
  remainder(): string { return this.original.split('').map((char, index) => (this.removed[index] ? ' ' : char)).join('').replace(/\s+/g, ' ').trim(); }
}

export function parseAgendaUtterance(text: string, now: Date, timeZone: string): AgendaDraft | null {
  const input = text.normalize('NFC').slice(0, 300);
  const cut = new Cutter(input);
  const all = cut.folded;
  if (!/\b(tengo|recuerdame|apunta|anota|agenda|hay|toca|es el|es mi)\b/.test(all)) return null;
  const today = localTime(now, timeZone).ymd;
  let date: string | null = null;

  let m: RegExpExecArray | null;
  if ((m = cut.take(/\bpasado manana\b/))) date = addDays(today, 2);
  else if ((m = cut.take(/\bmanana\b/))) date = addDays(today, 1);
  else if ((m = cut.take(/\bhoy\b/))) date = today;
  else if ((m = cut.take(/\b(?:el\s+)?(?:proximo\s+)?fin de semana\b/))) date = nextWeekday(today, 6, false);
  else if ((m = cut.take(/\b(?:el\s+)?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/))) {
    const day = Number(m[1]); const month = MONTHS[m[2]!]!;
    let year = Number(today.slice(0, 4));
    const build = (y: number) => `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (!isValidYmd(build(year))) return null;
    if (build(year) < today) year += 1;
    date = isValidYmd(build(year)) ? build(year) : null;
  } else if ((m = cut.take(/\b(?:(?:el|este)\s+)?(proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/))) {
    const weekday = WEEKDAY_WORDS[m[2]!];
    if (weekday === undefined) return null;
    date = nextWeekday(today, weekday, Boolean(m[1]));
  }
  if (!date) return null;

  let time: string | undefined;
  const t = cut.take(/\ba las?\s+(\d{1,2})(?::(\d{2}))?(?:\s*(y media|y cuarto|menos cuarto))?(?:\s*(?:de la|por la|en la)?\s*(manana|tarde|noche))?\b/);
  if (t) {
    let hour = Number(t[1]); let minute = t[2] ? Number(t[2]) : 0;
    if (t[3] === 'y media') minute = 30; else if (t[3] === 'y cuarto') minute = 15; else if (t[3] === 'menos cuarto') { hour -= 1; minute = 45; }
    if (t[4] === 'tarde' || t[4] === 'noche') { if (hour < 12) hour += 12; }
    else if (!t[4] && hour >= 1 && hour <= 7) hour += 12;
    if (hour <= 23 && minute <= 59) time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const wasReminder = /recuerdame/.test(all);
  while (cut.take(/\b(?:tengo|recuerdame|apunta|anota|agenda|que|me|toca|hay|es el|es mi|el|la|los|las|un|una|de|mi|para)\b/)) { /* quita palabras de relleno */ }
  const title = cut.remainder();
  if (!title) return null;
  const kind: AgendaKind = /cumple/.test(all) ? 'cumple' : /turno/.test(all) ? 'turno' : /medico|dentista|doctor|cita/.test(all) ? 'cita' : /cole|escuela|examen|excursion|deberes|tarea/.test(all) ? 'escuela' : wasReminder ? 'recordatorio' : 'actividad';
  return { title: title.charAt(0).toUpperCase() + title.slice(1), date, ...(time ? { time } : {}), kind };
}
