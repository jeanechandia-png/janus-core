/**
 * Previsión por horas desde Open-Meteo (https://open-meteo.com): sin clave, gratuita para uso no comercial (tope de
 * 10 000 llamadas/día) y con atribución CC BY 4.0 («Datos: Open-Meteo.com»). Solo lectura; sin secretos.
 * Variables horarias: temperature_2m, apparent_temperature, precipitation_probability, precipitation, wind_speed_10m,
 * uv_index (las tres últimas y la sensación térmica: POR CONFIRMAR contra la respuesta real; si faltan, se omiten sin romper).
 */
import type { HourForecast } from '../../modules/kid-dashboard/src/outfit.js';

export const OPEN_METEO_ATTRIBUTION = 'Datos: Open-Meteo.com (CC BY 4.0)';

export interface OpenMeteoOptions {
  lat: number;
  lon: number;
  timeZone: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export type ForecastByDay = Record<string, HourForecast[]>;

export class OpenMeteoError extends Error {
  constructor(message: string, readonly code: 'bad_input' | 'http' | 'network' | 'shape') {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

export async function fetchHourlyForecast(options: OpenMeteoOptions): Promise<ForecastByDay> {
  const { lat, lon } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new OpenMeteoError('Coordenadas no válidas', 'bad_input');
  if (!/^[A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2}$/.test(options.timeZone)) throw new OpenMeteoError('Zona horaria no válida', 'bad_input');
  const base = new URL(options.baseUrl ?? 'https://api.open-meteo.com');
  if (base.protocol !== 'https:' || !/(^|\.)open-meteo\.com$/.test(base.hostname)) throw new OpenMeteoError('Solo se admite https y open-meteo.com', 'bad_input');

  const url = new URL('/v1/forecast', base);
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lon.toFixed(4));
  url.searchParams.set('hourly', 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,uv_index');
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('timezone', options.timeZone);
  url.searchParams.set('forecast_days', '2');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  let body: unknown;
  try {
    const response = await (options.fetchImpl ?? fetch)(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new OpenMeteoError(`Open-Meteo respondió ${response.status}`, 'http');
    body = await response.json();
  } catch (error) {
    if (error instanceof OpenMeteoError) throw error;
    throw new OpenMeteoError('No se pudo consultar el tiempo', 'network');
  } finally {
    clearTimeout(timer);
  }

  const hourly = (body as { hourly?: Record<string, unknown> } | null)?.hourly;
  const times = hourly?.time;
  const temps = hourly?.temperature_2m;
  if (!Array.isArray(times) || !Array.isArray(temps) || times.length !== temps.length) throw new OpenMeteoError('Respuesta inesperada de Open-Meteo', 'shape');
  const series = (key: string): unknown[] | undefined => (Array.isArray(hourly?.[key]) ? (hourly![key] as unknown[]) : undefined);
  const feels = series('apparent_temperature');
  const prob = series('precipitation_probability');
  const mm = series('precipitation');
  const wind = series('wind_speed_10m');
  const uv = series('uv_index');
  const num = (list: unknown[] | undefined, index: number) => (typeof list?.[index] === 'number' && Number.isFinite(list[index] as number) ? (list[index] as number) : undefined);

  const out: ForecastByDay = {};
  times.forEach((stamp, index) => {
    const match = typeof stamp === 'string' ? stamp.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):00$/) : null;
    const temp = num(temps, index);
    if (!match || temp === undefined) return;
    const hour: HourForecast = { hour: Number(match[2]), tempC: temp };
    const f = num(feels, index); if (f !== undefined) hour.feelsLikeC = f;
    const p = num(prob, index); if (p !== undefined) hour.precipProb = p;
    const m = num(mm, index); if (m !== undefined) hour.precipMm = m;
    const w = num(wind, index); if (w !== undefined) hour.windKmh = w;
    const u = num(uv, index); if (u !== undefined) hour.uv = u;
    (out[match[1]!] ??= []).push(hour);
  });
  return out;
}
