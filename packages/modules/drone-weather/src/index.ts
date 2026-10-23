/**
 * drone-weather · ¿Se puede volar el dron? (pieza LEGO, sin red).
 * Perfil por defecto: Potensic Atom 2 — resistencia al viento nivel 5, hasta 38 km/h; < 249 g
 *   (maisondudrone.com, prueba completa). Normas UE categoría abierta: UAS.OPEN.010 (< 120 m del terreno) y UAS.OPEN.060 (mantener a la vista, VLOS) — EASA Easy Access Rules.
 * Umbrales con margen de seguridad (RECOMENDACIÓN, ajustables): viento sostenido ≤ 25 km/h bien, ≤ 32 precaución;
 * ráfagas ≤ 30 bien, ≤ 38 precaución; sin lluvia ni tormenta; visibilidad ≥ 1 km; temperatura ≥ 0 °C; de día.
 */
export interface DroneProfile { name: string; maxWindKmh: number; windOkKmh: number; windWarnKmh: number; gustOkKmh: number; gustWarnKmh: number; minTempC: number; waterproof: boolean }
export const ATOM2: DroneProfile = { name: 'Potensic Atom 2', maxWindKmh: 38, windOkKmh: 25, windWarnKmh: 32, gustOkKmh: 30, gustWarnKmh: 38, minTempC: 0, waterproof: false };
export interface HourWx { h: number; t: number; w: number; g: number; r: number; mm: number; vis?: number; storm?: boolean; day: boolean }
export type Verdict = 'si' | 'precaucion' | 'no';
export interface DroneCheck { verdict: Verdict; reasons: string[] }

export function checkHour(x: HourWx, p: DroneProfile = ATOM2): DroneCheck {
  const no: string[] = [], warn: string[] = [];
  if (x.storm) no.push('tormenta');
  if (!p.waterproof && (x.mm > 0.1 || x.r >= 50)) no.push('lluvia ' + x.r + '%');
  else if (!p.waterproof && x.r >= 30) warn.push('posible lluvia ' + x.r + '%');
  if (x.w > p.windWarnKmh || x.g > p.gustWarnKmh) no.push('viento ' + x.w + ' km/h, ráfagas ' + x.g);
  else if (x.w > p.windOkKmh || x.g > p.gustOkKmh) warn.push('viento ' + x.w + ' km/h, ráfagas ' + x.g);
  if (x.vis !== undefined && x.vis < 1) no.push('visibilidad ' + x.vis + ' km');
  if (x.t < p.minTempC) warn.push('frío ' + x.t + '° (batería)');
  if (!x.day) warn.push('de noche: luz verde intermitente obligatoria');
  return { verdict: no.length ? 'no' : warn.length ? 'precaucion' : 'si', reasons: no.length ? no : warn };
}

/** Mejores franjas de vuelo del día (bloques consecutivos con veredicto "si"). */
export function bestWindows(hours: HourWx[], p: DroneProfile = ATOM2): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = []; let start = -1;
  hours.forEach((x, i) => { const ok = checkHour(x, p).verdict === 'si'; if (ok && start < 0) start = x.h; if ((!ok || i === hours.length - 1) && start >= 0) { out.push({ from: start, to: ok ? x.h + 1 : x.h }); start = -1; } });
  return out;
}

export function dayVerdict(hours: HourWx[], p: DroneProfile = ATOM2): DroneCheck & { windows: Array<{ from: number; to: number }> } {
  const day = hours.filter((x) => x.day), windows = bestWindows(day, p);
  if (windows.length) return { verdict: 'si', reasons: ['mejor franja ' + windows.map((w) => w.from + ':00–' + w.to + ':00').join(', ')], windows };
  const checks = day.map((x) => checkHour(x, p)), anyWarn = checks.some((c) => c.verdict === 'precaucion');
  const worst = checks.find((c) => c.verdict === 'no') || checks[0] || { verdict: 'no' as Verdict, reasons: ['sin datos'] };
  return { verdict: anyWarn ? 'precaucion' : 'no', reasons: anyWarn ? checks.find((c) => c.verdict === 'precaucion')!.reasons : worst.reasons, windows };
}

/** Resumen por franjas del día: mañana (7–12), tarde (13–18), noche (19–23). */
export function periods(hours: HourWx[]): Array<{ id: 'manana' | 'tarde' | 'noche'; label: string; t: number; tmin: number; r: number; w: number; g: number; mm: number; storm: boolean }> {
  const def: Array<['manana' | 'tarde' | 'noche', string, number, number]> = [['manana', 'Mañana', 7, 12], ['tarde', 'Tarde', 13, 18], ['noche', 'Noche', 19, 23]];
  return def.map(([id, label, a, b]) => { const hs = hours.filter((x) => x.h >= a && x.h <= b);
    if (!hs.length) return { id, label, t: 0, tmin: 0, r: 0, w: 0, g: 0, mm: 0, storm: false }; /* sin datos: sin -Infinity */
    return { id, label, t: Math.round(Math.max(...hs.map((x) => x.t))), tmin: Math.round(Math.min(...hs.map((x) => x.t))), r: Math.max(0, ...hs.map((x) => x.r)), w: Math.max(0, ...hs.map((x) => x.w)), g: Math.max(0, ...hs.map((x) => x.g)), mm: +hs.reduce((s, x) => s + x.mm, 0).toFixed(1), storm: hs.some((x) => !!x.storm) }; });
}
