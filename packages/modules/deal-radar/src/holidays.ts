/**
 * Vacaciones escolares de Países Bajos (fechas orientativas del Ministerio OCW; cada colegio puede variar).
 * Fuente verificada el 2026-10-22:
 * https://www.rijksoverheid.nl/themas/onderwijs/schoolvakanties/overzicht-schoolvakanties-per-schooljaar/overzicht-schoolvakanties-2026-2027
 * Regiones: https://www.rijksoverheid.nl/themas/onderwijs/schoolvakanties/regios-schoolvakantie.
 * Para otros cursos, el anfitrión añade ventanas con addHolidayWindows() desde la misma fuente oficial.
 */
import type { HolidayWindow } from './types.js';

const SRC = 'rijksoverheid.nl · schoolvakanties 2026-2027 (consultado 2026-10-22)';
type R = HolidayWindow['region'];
const w = (id: string, name: string, region: R, start: string, end: string): HolidayWindow => ({ id: id + '-' + region, name, region, start, end, source: SRC });

const NL_2026_2027: HolidayWindow[] = [
  w('herfst-2026', 'Herfstvakantie (otoño)', 'noord', '2026-10-10', '2026-10-18'),
  w('herfst-2026', 'Herfstvakantie (otoño)', 'midden', '2026-10-17', '2026-10-25'),
  w('herfst-2026', 'Herfstvakantie (otoño)', 'zuid', '2026-10-17', '2026-10-25'),
  ...(['noord', 'midden', 'zuid'] as R[]).map((r) => w('kerst-2026', 'Kerstvakantie (Navidad)', r, '2026-12-19', '2027-01-03')),
  w('voorjaar-2027', 'Voorjaarsvakantie (invierno)', 'noord', '2027-02-20', '2027-02-28'),
  w('voorjaar-2027', 'Voorjaarsvakantie (invierno)', 'midden', '2027-02-20', '2027-02-28'),
  w('voorjaar-2027', 'Voorjaarsvakantie (invierno)', 'zuid', '2027-02-13', '2027-02-21'),
  ...(['noord', 'midden', 'zuid'] as R[]).map((r) => w('mei-2027', 'Meivakantie (mayo)', r, '2027-04-24', '2027-05-02')),
  w('zomer-2027', 'Zomervakantie (verano)', 'noord', '2027-07-10', '2027-08-22'),
  w('zomer-2027', 'Zomervakantie (verano)', 'midden', '2027-07-17', '2027-08-29'),
  w('zomer-2027', 'Zomervakantie (verano)', 'zuid', '2027-07-24', '2027-09-05')
];
const EXTRA: HolidayWindow[] = [];

export function addHolidayWindows(list: HolidayWindow[]): void { EXTRA.push(...list); }

/** Ventanas de la región que aún no han terminado, ordenadas por fecha. */
export function upcomingHolidays(region: R, from: Date = new Date(), limit = 6): HolidayWindow[] {
  const today = from.toISOString().slice(0, 10);
  return NL_2026_2027.concat(EXTRA).filter((h) => h.region === region && h.end >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, limit);
}

export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
