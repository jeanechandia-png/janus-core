/**
 * Límite diario de consultas a JANUS por colaborador (control de consumo).
 * - Cuenta ejecuciones iniciadas por un operador en el día natural de la zona horaria de JANUS.
 * - Puro y sin E/S: el runtime aporta las marcas de tiempo desde su registro durable de ejecuciones.
 * - El Founder no tiene este límite. 0 o un valor no válido = sin límite configurado.
 */
export const DEFAULT_OPERATOR_DAILY_RUNS = 60;

export function parseOperatorDailyRuns(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_OPERATOR_DAILY_RUNS;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_OPERATOR_DAILY_RUNS;
}

export function localDayKey(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export interface OperatorUsage { used: number; limit: number; remaining: number | null; allowed: boolean; day: string }

export function operatorDailyUsage(input: {
  runTimestamps: readonly string[];
  now: string;
  timeZone: string;
  limit: number;
}): OperatorUsage {
  const day = localDayKey(input.now, input.timeZone);
  const used = input.runTimestamps.filter((at) => localDayKey(at, input.timeZone) === day).length;
  if (!(input.limit > 0)) return { used, limit: 0, remaining: null, allowed: true, day };
  return { used, limit: input.limit, remaining: Math.max(0, input.limit - used), allowed: used < input.limit, day };
}
