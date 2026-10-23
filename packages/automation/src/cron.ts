/**
 * Cron de 5 campos (minuto hora día-del-mes mes día-de-la-semana), sin dependencias y con zona horaria.
 *
 * Sintaxis: `*`, número, rango `a-b`, lista `a,b`, paso (`*` o `a-b` seguido de `/n`, o `a/n`), nombres de mes (jan–dec) y de día (sun–sat).
 * Día de la semana: 0–7 (0 y 7 = domingo). Como en cron clásico, si el día-del-mes y el día-de-la-semana están ambos restringidos,
 * basta que se cumpla uno de los dos.
 *
 * Cambios de hora (DST), decisión documentada: una hora local que NO existe (salto de primavera) se omite ese día; una hora local
 * que ocurre DOS veces (retroceso de otoño) se dispara solo la primera vez. Así un trabajo diario no se duplica ni se desplaza.
 */
export class CronError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CronError';
  }
}

export interface CronSpec {
  source: string;
  minutes: number[];
  hours: number[];
  daysOfMonth: number[];
  months: number[];
  daysOfWeek: number[];
  /** El campo empezaba por `*` (no restringe). Determina la regla O entre día-del-mes y día-de-la-semana. */
  domStar: boolean;
  dowStar: boolean;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_CRON_LENGTH = 120;

interface FieldDef { name: string; min: number; max: number; names?: string[]; nameBase?: number }

function parseField(text: string, def: FieldDef): number[] {
  const values = new Set<number>();
  for (const part of text.split(',')) {
    if (part === '') throw new CronError(`Campo «${def.name}» con un elemento vacío`);
    const [rangeText, stepText, ...extra] = part.split('/');
    if (extra.length > 0) throw new CronError(`Campo «${def.name}»: paso mal formado en «${part}»`);
    let step = 1;
    if (stepText !== undefined) {
      if (!/^\d{1,3}$/.test(stepText) || Number(stepText) < 1) throw new CronError(`Campo «${def.name}»: el paso debe ser un entero positivo (${part})`);
      step = Number(stepText);
    }
    const num = (token: string): number => {
      if (/^\d{1,3}$/.test(token)) return Number(token);
      const idx = def.names?.indexOf(token.toLowerCase()) ?? -1;
      if (idx >= 0) return idx + (def.nameBase ?? 0);
      throw new CronError(`Campo «${def.name}»: valor no válido «${token}»`);
    };
    let lo: number;
    let hi: number;
    if (rangeText === '*') {
      lo = def.min;
      hi = def.max;
    } else if (rangeText!.includes('-')) {
      const pieces = rangeText!.split('-');
      if (pieces.length !== 2) throw new CronError(`Campo «${def.name}»: rango mal formado «${rangeText}»`);
      lo = num(pieces[0]!);
      hi = num(pieces[1]!);
      if (lo > hi) throw new CronError(`Campo «${def.name}»: rango invertido «${rangeText}»`);
    } else {
      lo = num(rangeText!);
      hi = stepText !== undefined ? def.max : lo; // «a/n» = de a hasta el máximo cada n
    }
    if (lo < def.min || hi > def.max) throw new CronError(`Campo «${def.name}»: fuera de rango ${def.min}–${def.max} («${part}»)`);
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return [...values].sort((a, b) => a - b);
}

export function parseCron(expression: string): CronSpec {
  if (typeof expression !== 'string') throw new CronError('La expresión cron debe ser texto');
  const source = expression.trim().replace(/\s+/g, ' ');
  if (source.length === 0 || source.length > MAX_CRON_LENGTH) throw new CronError(`La expresión cron debe tener entre 1 y ${MAX_CRON_LENGTH} caracteres`);
  if (!/^[0-9A-Za-z*/,\- ]+$/.test(source)) throw new CronError('La expresión cron contiene caracteres no permitidos');
  const fields = source.split(' ');
  if (fields.length !== 5) throw new CronError(`El cron debe tener 5 campos (minuto hora día mes día-semana); tiene ${fields.length}`);
  const [m, h, dom, mon, dow] = fields as [string, string, string, string, string];
  const daysOfWeek = parseField(dow, { name: 'día de la semana', min: 0, max: 7, names: DAYS, nameBase: 0 }).map((d) => (d === 7 ? 0 : d));
  return {
    source,
    minutes: parseField(m, { name: 'minuto', min: 0, max: 59 }),
    hours: parseField(h, { name: 'hora', min: 0, max: 23 }),
    daysOfMonth: parseField(dom, { name: 'día del mes', min: 1, max: 31 }),
    months: parseField(mon, { name: 'mes', min: 1, max: 12, names: MONTHS, nameBase: 1 }),
    daysOfWeek: [...new Set(daysOfWeek)].sort((a, b) => a - b),
    domStar: dom.startsWith('*'),
    dowStar: dow.startsWith('*'),
  };
}

// ---------- Zonas horarias (Intl, sin dependencias) ----------

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (typeof timeZone !== 'string' || timeZone.length === 0 || timeZone.length > 64) return false;
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

interface LocalFields { year: number; month: number; day: number; hour: number; minute: number; weekday: number }

function localFields(instantMs: number, timeZone: string): LocalFields {
  const parts = formatterFor(timeZone).formatToParts(new Date(Math.floor(instantMs / 1000) * 1000));
  const get = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return { year, month, day, hour: get('hour') % 24, minute: get('minute'), weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

function offsetMs(instantMs: number, timeZone: string): number {
  const f = localFields(instantMs, timeZone);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute) - Math.floor(instantMs / 60_000) * 60_000;
}

/** Instante UTC de una hora local de pared; `null` si esa hora no existe (salto de primavera); si ocurre dos veces, la primera. */
function zonedToInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number | null {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const candidates = new Set([guess - offsetMs(guess - 86_400_000, timeZone), guess - offsetMs(guess + 86_400_000, timeZone)]);
  const valid = [...candidates].filter((t) => {
    const f = localFields(t, timeZone);
    return f.year === year && f.month === month && f.day === day && f.hour === hour && f.minute === minute;
  });
  return valid.length === 0 ? null : Math.min(...valid);
}

function dayMatches(spec: CronSpec, month: number, day: number, weekday: number): boolean {
  if (!spec.months.includes(month)) return false;
  const domOk = spec.daysOfMonth.includes(day);
  const dowOk = spec.daysOfWeek.includes(weekday);
  if (spec.domStar && spec.dowStar) return true;
  if (spec.domStar) return dowOk;
  if (spec.dowStar) return domOk;
  return domOk || dowOk;
}

/** Siguiente disparo ESTRICTAMENTE posterior a `after` (resolución de minuto). `null` si no hay ninguno en los próximos 5 años (p. ej. 31 de febrero). */
export function nextCronSlot(spec: CronSpec, after: Date, timeZone: string): Date | null {
  if (!isValidTimeZone(timeZone)) throw new CronError(`Zona horaria no válida: ${timeZone}`);
  const startMs = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
  const start = localFields(startMs, timeZone);
  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  for (let i = 0; i < 366 * 5; i += 1, cursor += 86_400_000) {
    const d = new Date(cursor);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (!dayMatches(spec, month, day, d.getUTCDay())) continue;
    for (const hour of spec.hours) {
      for (const minute of spec.minutes) {
        if (i === 0 && (hour < start.hour || (hour === start.hour && minute < start.minute))) continue;
        const instant = zonedToInstant(year, month, day, hour, minute, timeZone);
        if (instant !== null && instant >= startMs) return new Date(instant);
      }
    }
  }
  return null;
}
