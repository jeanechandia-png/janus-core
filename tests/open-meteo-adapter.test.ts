import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN_METEO_ATTRIBUTION, OpenMeteoError, fetchHourlyForecast } from '../packages/adapters/src/open-meteo-adapter.js';

const body = {
  hourly: {
    time: ['2026-11-04T00:00', '2026-11-04T01:00', '2026-11-05T09:00', 'basura'],
    temperature_2m: [8.5, 8.1, 10.2, 99],
    apparent_temperature: [6.2, 5.9, 8.8, 0],
    precipitation_probability: [10, 20, 70, 0],
    precipitation: [0, 0.1, 1.4, 0],
    wind_speed_10m: [12, 14, 22, 0],
    uv_index: [0, 0, 1.2, 0],
  },
};

const respond = (payload: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(payload), { status })) as typeof fetch;

test('Open-Meteo: agrupa por día, ignora horas mal formadas y conserva las variables opcionales', async () => {
  let requested = '';
  const spy: typeof fetch = async (input) => { requested = String(input); return new Response(JSON.stringify(body)); };
  const result = await fetchHourlyForecast({ lat: 52.3731, lon: 4.8922, timeZone: 'Europe/Amsterdam', fetchImpl: spy });
  assert.deepEqual(Object.keys(result), ['2026-11-04', '2026-11-05']);
  assert.equal(result['2026-11-04']!.length, 2);
  assert.deepEqual(result['2026-11-05']![0], { hour: 9, tempC: 10.2, feelsLikeC: 8.8, precipProb: 70, precipMm: 1.4, windKmh: 22, uv: 1.2 });
  const url = new URL(requested);
  assert.equal(url.hostname, 'api.open-meteo.com');
  assert.equal(url.searchParams.get('timezone'), 'Europe/Amsterdam');
  assert.equal(url.searchParams.get('latitude'), '52.3731');
  assert.ok(!requested.includes('apikey'), 'no lleva clave');
  assert.match(OPEN_METEO_ATTRIBUTION, /Open-Meteo/);
});

test('Open-Meteo: si faltan variables opcionales no rompe', async () => {
  const minimal = { hourly: { time: ['2026-11-04T10:00'], temperature_2m: [11] } };
  const result = await fetchHourlyForecast({ lat: 1, lon: 2, timeZone: 'Europe/Amsterdam', fetchImpl: respond(minimal) });
  assert.deepEqual(result['2026-11-04'], [{ hour: 10, tempC: 11 }]);
});

test('Open-Meteo: rechaza entradas peligrosas y clasifica los errores', async () => {
  await assert.rejects(() => fetchHourlyForecast({ lat: 91, lon: 0, timeZone: 'Europe/Amsterdam' }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'bad_input');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam;rm -rf' }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'bad_input');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam', baseUrl: 'https://evil.example.com' }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'bad_input');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam', baseUrl: 'http://api.open-meteo.com' }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'bad_input');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam', fetchImpl: respond({}, 500) }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'http');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam', fetchImpl: respond({ hourly: { time: [1], temperature_2m: [] } }) }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'shape');
  await assert.rejects(() => fetchHourlyForecast({ lat: 1, lon: 1, timeZone: 'Europe/Amsterdam', fetchImpl: (async () => { throw new Error('boom'); }) as typeof fetch }), (error: unknown) => error instanceof OpenMeteoError && error.code === 'network');
});
