/** Calendario de revisiones: semanal (los folletos de NL cambian cada semana) y temporadas de rebajas. */

/** Próxima ejecución semanal en la zona horaria indicada (por defecto lunes 08:00, Europe/Amsterdam). */
export function nextWeeklyRun(now: Date, weekday = 1, hour = 8, timeZone = 'Europe/Amsterdam'): Date {
  for (let add = 0; add <= 8; add++) {
    for (const probeHour of [hour]) {
      const day = new Date(now.getTime() + add * 86400000);
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(day);
      const get = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
      const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      if (wd !== weekday) continue;
      const candidate = zonedTime(Number(get('year')), Number(get('month')), Number(get('day')), probeHour, timeZone);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }
  return new Date(now.getTime() + 7 * 86400000);
}

/** Convierte una hora local de una zona a instante UTC (sin dependencias). */
export function zonedTime(y: number, m: number, d: number, h: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h);
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asLocal = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return new Date(guess - (asLocal - guess));
}

/** Temporadas en las que conviene revisar ropa/calzado/electrónica con más frecuencia. */
export interface SalesSeason { id: string; name: string; months: number[]; kinds: string[] }
export const SALES_SEASONS: SalesSeason[] = [
  { id: 'winter-sale', name: 'Rebajas de invierno (cambio de temporada)', months: [1], kinds: ['fashion', 'kids'] },
  { id: 'summer-sale', name: 'Rebajas de verano (cambio de temporada)', months: [7], kinds: ['fashion', 'kids'] },
  { id: 'back-to-school', name: 'Vuelta al cole', months: [8, 9], kinds: ['kids', 'electronics'] },
  { id: 'black-friday', name: 'Black Friday / Cyber Monday', months: [11], kinds: ['fashion', 'electronics', 'kids', 'subscription', 'tool'] },
  { id: 'apple-launch', name: 'Presentación de iPhone (los modelos anteriores bajan)', months: [9], kinds: ['electronics'] }
];
export function activeSeasons(now: Date): SalesSeason[] {
  const m = now.getUTCMonth() + 1;
  return SALES_SEASONS.filter((s) => s.months.includes(m));
}
