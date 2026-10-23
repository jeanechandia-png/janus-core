import test from 'node:test';
import assert from 'node:assert/strict';
import { planScene, applyActions, parseIntent, greeting, tuyaCommand, type Device } from '../packages/modules/home-scenes/src/index.js';

const D: Device[] = [
  { id: 'salon', name: 'Salón', room: 'salón', kind: 'light', adapter: 'tuya', externalId: 'bf1', tags: ['ambiente'] },
  { id: 'arbol', name: 'Árbol', room: 'salón', kind: 'plug', adapter: 'tuya', externalId: 'bf2', tags: ['navidad'] },
  { id: 'pasillo', name: 'Pasillo', room: 'pasillo', kind: 'light', adapter: 'tuya', externalId: 'bf3', tags: ['noche'] },
  { id: 'termo', name: 'Calefacción', room: 'casa', kind: 'thermostat', adapter: 'demo', tags: [] }
];

test('llegada de noche: luces de ambiente + calefacción; idempotente', () => {
  const ctx = { now: new Date('2026-10-22T19:30:00'), comfortTemp: 21 };
  const a = planScene('llegada', D, {}, ctx);
  assert.deepEqual(a.map((x) => x.deviceId + ':' + x.cmd), ['salon:on', 'termo:setTemp']);
  const s = applyActions({}, a);
  assert.equal(planScene('llegada', D, s, ctx).length, 0);
  assert.equal(planScene('llegada', D, {}, { now: new Date('2026-10-22T12:00:00') }).some((x) => x.deviceId === 'salon'), false);
});

test('órdenes por voz', () => {
  assert.deepEqual(parseIntent('Enciende las luces de Navidad'), { scene: 'navidad' });
  assert.deepEqual(parseIntent('apaga todo'), { scene: 'todo-off' });
  assert.deepEqual(parseIntent('pon la calefacción a 21,5'), { temp: 21.5 });
  assert.deepEqual(parseIntent('ya llegué'), { scene: 'llegada' });
  assert.equal(parseIntent('qué tiempo hace'), null);
});

test('saludo y comando Tuya', () => {
  assert.equal(greeting('Jean', new Date('2026-10-22T19:30:00'), 'llegada'), 'Hola, Jean. ¿Qué tal tu día?');
  assert.equal(greeting('Jean', new Date('2026-10-22T07:00:00'), 'despertar'), 'Buenos días, Jean.');
  assert.deepEqual(tuyaCommand(D[0]!, { deviceId: 'salon', cmd: 'on' }), { path: '/v1.0/iot-03/devices/bf1/commands', body: { commands: [{ code: 'switch_led', value: true }] } });
  assert.throws(() => tuyaCommand(D[3]!, { deviceId: 'termo', cmd: 'setTemp', value: 20 }));
});
