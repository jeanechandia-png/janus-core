import test from 'node:test';
import assert from 'node:assert/strict';
import { CronError, isValidTimeZone, nextCronSlot, parseCron } from '../packages/automation/src/cron.js';

const AMS = 'Europe/Amsterdam';
const next = (expr: string, after: string, tz = 'UTC'): string | null => nextCronSlot(parseCron(expr), new Date(after), tz)?.toISOString() ?? null;

test('cron: cada 15 minutos; el siguiente es estrictamente posterior y los segundos se ignoran', () => {
  assert.equal(next('*/15 * * * *', '2026-10-23T10:07:30Z'), '2026-10-23T10:15:00.000Z');
  assert.equal(next('*/15 * * * *', '2026-10-23T10:15:00Z'), '2026-10-23T10:30:00.000Z', 'justo en el disparo → el siguiente');
  assert.equal(next('*/15 * * * *', '2026-10-23T10:15:59Z'), '2026-10-23T10:30:00.000Z');
});

test('cron: laborables a las 07:00 de Ámsterdam atraviesan el cambio de hora de otoño (CEST→CET el 25-oct-2026)', () => {
  // Viernes 23-oct 14:00 CEST → lunes 26-oct 07:00 CET = 06:00Z (ya con hora de invierno).
  assert.equal(next('0 7 * * 1-5', '2026-10-23T12:00:00Z', AMS), '2026-10-26T06:00:00.000Z');
  // Antes del cambio: jueves 22-oct tarde → viernes 07:00 CEST = 05:00Z.
  assert.equal(next('0 7 * * 1-5', '2026-10-22T12:00:00Z', AMS), '2026-10-23T05:00:00.000Z');
});

test('cron: una hora local que no existe (salto de primavera) se omite ese día, no se desplaza', () => {
  // 29-mar-2026 02:30 no existe en Ámsterdam (02:00 → 03:00): el siguiente es el 30-mar 02:30 CEST = 00:30Z.
  assert.equal(next('30 2 * * *', '2026-03-28T12:00:00Z', AMS), '2026-03-30T00:30:00.000Z');
});

test('cron: una hora local repetida (retroceso de otoño) se dispara solo la primera vez', () => {
  // 25-oct-2026 02:30 ocurre dos veces (00:30Z y 01:30Z): solo la primera.
  const first = next('30 2 * * *', '2026-10-24T12:00:00Z', AMS);
  assert.equal(first, '2026-10-25T00:30:00.000Z');
  assert.equal(next('30 2 * * *', first!, AMS), '2026-10-26T01:30:00.000Z', 'el siguiente es el día 26 (02:30 CET), no la segunda 02:30 del 25');
});

test('cron: día del mes y día de la semana restringidos a la vez se combinan con O; 7 = domingo; nombres', () => {
  // Día 13 O viernes. Desde el lunes 12-oct: martes 13 → viernes 16.
  assert.equal(next('0 0 13 * 5', '2026-10-12T00:00:00Z'), '2026-10-13T00:00:00.000Z');
  assert.equal(next('0 0 13 * 5', '2026-10-13T00:00:00Z'), '2026-10-16T00:00:00.000Z');
  assert.equal(next('0 0 * * 7', '2026-10-23T00:00:00Z'), '2026-10-25T00:00:00.000Z', 'domingo');
  assert.equal(next('0 9 * jan-mar mon-fri', '2026-10-23T00:00:00Z'), '2027-01-01T09:00:00.000Z', 'viernes 1-ene-2027');
});

test('cron: pasos con rango, listas y a/n', () => {
  assert.equal(next('0 8,16 * * *', '2026-10-23T09:00:00Z'), '2026-10-23T16:00:00.000Z');
  assert.equal(next('10-20/5 * * * *', '2026-10-23T09:11:00Z'), '2026-10-23T09:15:00.000Z');
  assert.deepEqual(parseCron('5/20 * * * *').minutes, [5, 25, 45]);
});

test('cron: lo que no se dispara nunca devuelve null (31 de febrero)', () => {
  assert.equal(next('0 0 31 2 *', '2026-10-23T00:00:00Z'), null);
});

test('cron: entradas malas se rechazan con un error claro', () => {
  const bad: Array<[string, RegExp]> = [
    ['* * * *', /5 campos/],
    ['* * * * * *', /5 campos/],
    ['', /entre 1 y/],
    ['61 * * * *', /fuera de rango/],
    ['* 24 * * *', /fuera de rango/],
    ['* * 0 * *', /fuera de rango/],
    ['* * * 13 *', /fuera de rango/],
    ['* * * * 8', /fuera de rango/],
    ['*/0 * * * *', /paso/],
    ['10-5 * * * *', /invertido/],
    ['1-2-3 * * * *', /mal formado/],
    ['a * * * *', /no válido/],
    ['*/5/2 * * * *', /mal formado/],
    ['1,,2 * * * *', /vacío/],
    ['* * * * *; rm -rf /', /no permitidos/],
    ['x'.repeat(200), /entre 1 y/],
  ];
  for (const [expr, why] of bad) assert.throws(() => parseCron(expr), (e: unknown) => e instanceof CronError && why.test(e.message), `«${expr.slice(0, 30)}» debería fallar con ${why}`);
});

test('zonas horarias: válidas e inválidas; una inválida al calcular lanza error', () => {
  assert.equal(isValidTimeZone('Europe/Amsterdam'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('No/Existe'), false);
  assert.equal(isValidTimeZone(''), false);
  assert.throws(() => nextCronSlot(parseCron('* * * * *'), new Date(), 'No/Existe'), CronError);
});
