import { hmToMinutes, localTime, normalizeText } from './time.js';

export const ACTIVITY_CATEGORIES = ['chat', 'youtube', 'tv', 'interests', 'school', 'agenda', 'home', 'camera'] as const;
export type KidActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const CATEGORY_LABELS_ES: Readonly<Record<KidActivityCategory, string>> = Object.freeze({
  chat: 'Charla con su compañero',
  youtube: 'Vídeos (YouTube)',
  tv: 'Tele',
  interests: 'Sus intereses y planes',
  school: 'Cole y tareas',
  agenda: 'Agenda',
  home: 'Control de la casa',
  camera: 'Cámara y escáner',
});

/** Categorías que cuentan para el tope diario total (ocio). Cole, agenda, casa y cámara nunca se cortan por tiempo total. */
export const LIMITED_CATEGORIES: readonly KidActivityCategory[] = ['chat', 'youtube', 'tv', 'interests'];
/** Categorías que siguen disponibles aunque sea fuera de horario (apagar una luz, ver un recordatorio). */
export const ALWAYS_AVAILABLE: readonly KidActivityCategory[] = ['agenda', 'home'];

export interface TimeLimits {
  allowedFrom: string;
  allowedUntil: string;
  totalDailyMinutes: number;
  perCategoryMinutes: Partial<Record<KidActivityCategory, number>>;
  /** Aviso de transición antes de que se acabe el tiempo (minutos). */
  warnMinutesBefore: number;
}

export const DEFAULT_LIMITS: TimeLimits = {
  allowedFrom: '07:00',
  allowedUntil: '20:30',
  totalDailyMinutes: 120,
  perCategoryMinutes: { youtube: 30, tv: 45 },
  warnMinutesBefore: 5,
};

export interface ActivityEvent {
  at: string;
  category: KidActivityCategory;
  seconds: number;
  detail?: string;
}

export type MinutesByCategory = Partial<Record<KidActivityCategory, number>>;

export function summarizeActivity(events: readonly ActivityEvent[], fromIso: string, toIso: string): { byCategory: MinutesByCategory; totalMinutes: number; limitedMinutes: number } {
  const seconds: Partial<Record<KidActivityCategory, number>> = {};
  for (const event of events) {
    if (event.at < fromIso || event.at >= toIso) continue;
    if (!(ACTIVITY_CATEGORIES as readonly string[]).includes(event.category)) continue;
    const value = Number.isFinite(event.seconds) ? Math.max(0, Math.min(event.seconds, 3600)) : 0;
    seconds[event.category] = (seconds[event.category] ?? 0) + value;
  }
  const byCategory: MinutesByCategory = {};
  let total = 0;
  let limited = 0;
  for (const category of ACTIVITY_CATEGORIES) {
    const minutes = Math.round(((seconds[category] ?? 0) / 60) * 10) / 10;
    if (minutes > 0) byCategory[category] = minutes;
    total += minutes;
    if (LIMITED_CATEGORIES.includes(category)) limited += minutes;
  }
  return { byCategory, totalMinutes: Math.round(total * 10) / 10, limitedMinutes: Math.round(limited * 10) / 10 };
}

export interface AccessDecision {
  allowed: boolean;
  reason?: 'outside-hours' | 'category-limit' | 'daily-limit';
  /** Mensaje para la niña, amable y concreto. */
  message: string;
  minutesLeft?: number;
  /** Avisar «te quedan N minutos» para que el cambio de actividad no sea de golpe. */
  warn?: { minutesLeft: number; message: string };
}

export function evaluateAccess(input: {
  now: Date;
  timeZone?: string;
  category: KidActivityCategory;
  usedTodayMinutes: MinutesByCategory;
  limits: TimeLimits;
  /** Minutos extra concedidos hoy por el tutor. */
  bonusMinutes?: number;
}): AccessDecision {
  const { limits, category } = input;
  const local = localTime(input.now, input.timeZone);
  const from = hmToMinutes(limits.allowedFrom);
  const until = hmToMinutes(limits.allowedUntil);
  const inside = from <= until ? local.minutesOfDay >= from && local.minutesOfDay < until : local.minutesOfDay >= from || local.minutesOfDay < until;
  if (!inside && !ALWAYS_AVAILABLE.includes(category)) {
    return { allowed: false, reason: 'outside-hours', message: `Ahora toca descansar. Puedes volver a las ${limits.allowedFrom}. 🌙` };
  }
  if (!LIMITED_CATEGORIES.includes(category)) return { allowed: true, message: 'Adelante.' };

  const bonus = Math.max(0, input.bonusMinutes ?? 0);
  const used = input.usedTodayMinutes;
  const limitedUsed = LIMITED_CATEGORIES.reduce((sum, key) => sum + (used[key] ?? 0), 0);
  const totalLeft = limits.totalDailyMinutes + bonus - limitedUsed;
  const categoryCap = limits.perCategoryMinutes[category];
  const categoryLeft = categoryCap === undefined ? Infinity : categoryCap + bonus - (used[category] ?? 0);

  if (totalLeft <= 0) return { allowed: false, reason: 'daily-limit', message: 'Hoy ya usaste tu tiempo de pantalla. ¡Buen trabajo! Mañana hay más. 🌟', minutesLeft: 0 };
  if (categoryLeft <= 0) return { allowed: false, reason: 'category-limit', message: `Ya viste todo lo de hoy en ${CATEGORY_LABELS_ES[category].toLowerCase()}. Puedes hacer otra cosa divertida. 🎈`, minutesLeft: 0 };

  const minutesLeft = Math.floor(Math.min(totalLeft, categoryLeft));
  const decision: AccessDecision = { allowed: true, message: 'Adelante.', minutesLeft };
  if (minutesLeft <= limits.warnMinutesBefore) {
    decision.warn = { minutesLeft, message: `Te quedan ${minutesLeft} minutos. Ve terminando lo que haces, ¿vale? ⏰` };
  }
  return decision;
}

export function validateLimits(input: unknown): { ok: true; limits: TimeLimits } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Límites no válidos.' };
  const raw = input as Record<string, unknown>;
  const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
  const from = raw.allowedFrom ?? DEFAULT_LIMITS.allowedFrom;
  const until = raw.allowedUntil ?? DEFAULT_LIMITS.allowedUntil;
  if (typeof from !== 'string' || !hm.test(from) || typeof until !== 'string' || !hm.test(until)) return { ok: false, message: 'Las horas deben ser HH:MM.' };
  const total = raw.totalDailyMinutes ?? DEFAULT_LIMITS.totalDailyMinutes;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 || total > 600) return { ok: false, message: 'El tope diario debe estar entre 0 y 600 minutos.' };
  const warn = raw.warnMinutesBefore ?? DEFAULT_LIMITS.warnMinutesBefore;
  if (typeof warn !== 'number' || !Number.isFinite(warn) || warn < 0 || warn > 30) return { ok: false, message: 'El aviso previo debe estar entre 0 y 30 minutos.' };
  const perCategory: Partial<Record<KidActivityCategory, number>> = {};
  const given = (raw.perCategoryMinutes ?? DEFAULT_LIMITS.perCategoryMinutes) as Record<string, unknown>;
  if (typeof given !== 'object' || given === null) return { ok: false, message: 'Topes por actividad no válidos.' };
  for (const [key, value] of Object.entries(given)) {
    if (!(ACTIVITY_CATEGORIES as readonly string[]).includes(key)) return { ok: false, message: `Actividad desconocida: ${key}.` };
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 600) return { ok: false, message: 'Los topes por actividad deben estar entre 0 y 600 minutos.' };
    perCategory[key as KidActivityCategory] = Math.round(value);
  }
  return { ok: true, limits: { allowedFrom: from, allowedUntil: until, totalDailyMinutes: Math.round(total), perCategoryMinutes: perCategory, warnMinutesBefore: Math.round(warn) } };
}

export function categoryFromText(text: string): KidActivityCategory | null {
  const norm = normalizeText(text);
  return (ACTIVITY_CATEGORIES as readonly string[]).includes(norm) ? (norm as KidActivityCategory) : null;
}
