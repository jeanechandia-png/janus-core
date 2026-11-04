/**
 * Qué ponerse y si el día sirve para salir, a partir de la previsión por horas de UN día local.
 * Rangos en °C (Europa). Son RECOMENDACIONES de Janus, no hechos médicos ni meteorológicos oficiales.
 */

export interface HourForecast {
  hour: number;
  tempC: number;
  feelsLikeC?: number;
  /** 0–100 */
  precipProb?: number;
  precipMm?: number;
  windKmh?: number;
  uv?: number;
}

export interface OutfitAdvice {
  summary: string;
  wear: string[];
  bring: string[];
  outdoorOk: boolean;
  bestOutdoorWindow?: { fromHour: number; toHour: number };
  /** Frases cortas para la niña, listas para mostrar. */
  lines: string[];
}

const avg = (values: number[]) => (values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length);
const feels = (hour: HourForecast) => hour.feelsLikeC ?? hour.tempC;

function windowStats(hours: readonly HourForecast[], from: number, to: number) {
  const slice = hours.filter((hour) => hour.hour >= from && hour.hour < to);
  return {
    count: slice.length,
    feels: avg(slice.map(feels)),
    rainProb: Math.max(0, ...slice.map((hour) => hour.precipProb ?? 0)),
    rainMm: slice.reduce((sum, hour) => sum + (hour.precipMm ?? 0), 0),
    wind: Math.max(0, ...slice.map((hour) => hour.windKmh ?? 0)),
    uv: Math.max(0, ...slice.map((hour) => hour.uv ?? 0)),
  };
}

export function clothingForFeelsLike(feelsC: number): { layers: string[]; note: string } {
  if (feelsC < 0) return { layers: ['abrigo grueso', 'gorro', 'guantes', 'bufanda', 'calcetines gordos'], note: 'hace mucho frío' };
  if (feelsC < 7) return { layers: ['abrigo', 'jersey', 'gorro o bufanda'], note: 'hace frío' };
  if (feelsC < 13) return { layers: ['chaqueta', 'jersey'], note: 'fresquito' };
  if (feelsC < 18) return { layers: ['sudadera o jersey ligero'], note: 'templado' };
  if (feelsC < 24) return { layers: ['camiseta', 'rebeca por si acaso'], note: 'agradable' };
  return { layers: ['ropa ligera', 'gorra'], note: 'hace calor' };
}

export function outfitAdvice(hours: readonly HourForecast[], focus: { fromHour: number; toHour: number } = { fromHour: 8, toHour: 18 }): OutfitAdvice | null {
  const stats = windowStats(hours, focus.fromHour, focus.toHour);
  if (stats.count === 0 || Number.isNaN(stats.feels)) return null;

  const { layers, note } = clothingForFeelsLike(stats.feels);
  const wear = [...layers];
  const bring: string[] = [];
  const rainy = stats.rainProb >= 40 || stats.rainMm >= 0.5;
  const windy = stats.wind >= 35;
  if (rainy) {
    wear.push('chubasquero o impermeable');
    bring.push(windy ? 'chubasquero (con este viento el paraguas se vuela)' : 'paraguas o chubasquero');
    if (stats.rainProb >= 60 || stats.rainMm >= 2) wear.push('botas de agua');
  }
  if (stats.uv >= 3) bring.push('gorra y protector solar');
  if (windy) bring.push('ropa ajustada que no vuele');

  // Mejor franja para salir: horas seguidas con poca lluvia, sensación ≥ 8 °C y viento moderado.
  const good = hours.filter((hour) => hour.hour >= focus.fromHour && hour.hour < focus.toHour && (hour.precipProb ?? 0) < 25 && (hour.precipMm ?? 0) < 0.2 && feels(hour) >= 8 && (hour.windKmh ?? 0) < 35).map((hour) => hour.hour);
  let best: { fromHour: number; toHour: number } | undefined;
  for (let index = 0; index < good.length; index += 1) {
    let end = index;
    while (end + 1 < good.length && good[end + 1] === good[end]! + 1) end += 1;
    const length = end - index + 1;
    if (length >= 2 && (!best || length > best.toHour - best.fromHour)) best = { fromHour: good[index]!, toHour: good[end]! + 1 };
    index = end;
  }
  const outdoorOk = good.length >= 2;

  const lines = [
    `Hoy ${note} (se siente como ${Math.round(stats.feels)}°).`,
    `Ponte: ${wear.join(', ')}.`,
    ...(bring.length > 0 ? [`Lleva: ${bring.join('; ')}.`] : []),
    outdoorOk && best ? `Buen rato para jugar fuera: de ${best.fromHour}:00 a ${best.toHour}:00.` : 'Hoy es mejor un plan de interior. 🏠',
  ];
  return {
    summary: `${note}${rainy ? ', con lluvia' : ''}${windy ? ', con viento' : ''}`,
    wear,
    bring,
    outdoorOk,
    ...(best ? { bestOutdoorWindow: best } : {}),
    lines,
  };
}
