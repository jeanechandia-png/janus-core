/** Planificación de viajes alrededor de las vacaciones escolares: qué buscar, cuándo y con qué antelación. */
import type { DealRadarProfile, HolidayWindow, TravelSearch } from './types.js';
import { daysBetween } from './holidays.js';

/** Antelación recomendada para empezar a vigilar precios (días). Heurística conservadora, ajustable por el anfitrión. */
export const LEAD_DAYS: Record<TravelSearch['mode'], number> = { flight: 90, train: 60, bus: 45, car: 30, hotel: 75, park: 45 };

export function travelSearches(profile: DealRadarProfile, windows: HolidayWindow[], from: Date = new Date()): TravelSearch[] {
  const today = from.toISOString().slice(0, 10), out: TravelSearch[] = [];
  for (const win of windows) {
    if (win.end < today) continue;
    const depart = win.start > today ? win.start : today;
    const nights = Math.max(1, daysBetween(depart, win.end));
    for (const d of profile.travel.destinations) {
      for (const mode of d.modes) {
        const lead = LEAD_DAYS[mode], daysToStart = daysBetween(today, depart);
        // Prioridad: destino × cercanía de la ventana de compra (dentro de la antelación recomendada sube).
        const urgency = daysToStart <= lead ? 1 : Math.max(0.3, lead / Math.max(1, daysToStart));
        out.push({
          windowId: win.id, windowName: win.name, mode, destination: d.name, country: d.country, depart, return: win.end, nights,
          travellers: { adults: profile.travel.adults, children: profile.travel.childAges.length, childAges: profile.travel.childAges.slice() },
          priority: Math.round(d.priority * urgency * 100) / 100
        });
      }
    }
  }
  return out.sort((a, b) => b.priority - a.priority || a.depart.localeCompare(b.depart));
}
