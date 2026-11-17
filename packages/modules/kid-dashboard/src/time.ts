/** Utilidades de fecha/hora local sin dependencias (solo Intl). Las fechas viajan como 'YYYY-MM-DD' y las horas como 'HH:MM'. */

export interface LocalTime {
  ymd: string;
  hm: string;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  minutesOfDay: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localTime(now: Date, timeZone = 'Europe/Amsterdam'): LocalTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    hm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    weekday: WEEKDAYS[get('weekday')] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

export const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidYmd(value: unknown): value is string {
  if (typeof value !== 'string' || !YMD.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((new Date(`${toYmd}T00:00:00Z`).getTime() - new Date(`${fromYmd}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Minúsculas, sin tildes ni signos: para comparar frases en español/inglés/neerlandés. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ:+.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minúsculas y sin tildes, CARÁCTER A CARÁCTER (misma longitud que el original): permite usar posiciones del texto plegado en el original. */
export function foldAccents(text: string): string {
  return text.split('').map((char) => (char.normalize('NFD')[0] ?? char).toLowerCase()).join('');
}
