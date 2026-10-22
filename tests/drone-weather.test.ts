import test from 'node:test';
import assert from 'node:assert/strict';
import { checkHour, dayVerdict, periods } from '../packages/modules/drone-weather/src/index.js';
const H = (h: number, o: Partial<{ t: number; w: number; g: number; r: number; mm: number; storm: boolean; vis: number }> = {}) => ({ h, t: 12, w: 10, g: 15, r: 5, mm: 0, day: h >= 8 && h < 18, ...o });
test('veredicto por hora', () => {
  assert.equal(checkHour(H(11)).verdict, 'si');
  assert.equal(checkHour(H(11, { w: 28 })).verdict, 'precaucion');
  assert.equal(checkHour(H(11, { g: 45 })).verdict, 'no');
  assert.equal(checkHour(H(11, { r: 60, mm: 1 })).verdict, 'no');
  assert.equal(checkHour(H(11, { storm: true })).verdict, 'no');
  assert.equal(checkHour(H(21)).verdict, 'precaucion');
});
test('mejor franja del día y periodos', () => {
  const hs = Array.from({ length: 24 }, (_, h) => H(h, h >= 14 ? { r: 70, mm: 1 } : {}));
  const d = dayVerdict(hs);
  assert.equal(d.verdict, 'si'); assert.deepEqual(d.windows, [{ from: 8, to: 14 }]);
  const p = periods(hs); assert.equal(p.length, 3); assert.equal(p[1]!.r, 70); assert.equal(p[0]!.label, 'Mañana');
});
test('sin datos: sin valores infinitos y veredicto prudente', () => {
  const p = periods([]); assert.equal(p.length, 3); assert.ok(p.every((x) => Number.isFinite(x.t) && Number.isFinite(x.w)));
  assert.equal(dayVerdict([]).verdict, 'no');
});
test('visibilidad baja y tormenta mandan sobre un buen viento', () => {
  assert.equal(checkHour(H(10, { vis: 0.5 })).verdict, 'no');
  assert.equal(checkHour(H(10, { storm: true, w: 5, g: 8 })).verdict, 'no');
  const hs = Array.from({ length: 24 }, (_, h) => H(h, { storm: true }));
  assert.equal(dayVerdict(hs).verdict, 'no');
});
test('perfil propio: un dron más resistente amplía la franja', () => {
  const fuerte = { name: 'Dron X', maxWindKmh: 60, windOkKmh: 40, windWarnKmh: 50, gustOkKmh: 50, gustWarnKmh: 60, minTempC: -10, waterproof: true };
  assert.equal(checkHour(H(11, { w: 35, g: 45 })).verdict, 'no');
  assert.equal(checkHour(H(11, { w: 35, g: 45 }), fuerte).verdict, 'si');
});
