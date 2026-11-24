import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addLocation, alertText, contactLinks, emergencyCall, newSosEvent, normalizeConfig, normalizePhone, resolveSos, validLocation, HOLD_MS } from '../packages/modules/guardian-angel/src/index.js';

test('Ángel Guardián: el espejo de la app es idéntico al módulo (sin copias divergentes)', () => {
  assert.equal(readFileSync('apps/pwa/guardian-angel.js', 'utf8'), readFileSync('packages/modules/guardian-angel/src/guardian-angel.js', 'utf8'));
});

test('Ángel Guardián: plantilla de contactos con país, principal y teléfonos internacionales', () => {
  assert.equal(normalizePhone('06 1234 5678', 'NL'), '+31612345678');
  assert.equal(normalizePhone('0031 6 1234 5678'), '+31612345678');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizeConfig({ guardians: [] }).ok, false);
  const bad = normalizeConfig({ guardians: [{ role: 'vecino', name: 'X', phone: '+31612345678' }] });
  assert.equal(bad.ok, false);
  const ok = normalizeConfig({ country: 'NL', childName: 'Niña', guardians: [{ role: 'padre', name: 'Papá prueba', phone: '06 1234 5678' }, { role: 'madre', name: 'Mamá prueba', phone: '+31 6 8765 4321', whatsapp: false, primary: true }] });
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.equal(ok.config.emergencyNumber, '112');
  assert.deepEqual(ok.config.guardians.map((g) => g.primary), [false, true], 'un solo principal');
  assert.equal(normalizeConfig({ country: 'CO', guardians: [{ role: 'tutor_legal', name: 'Tutor', phone: '+57 300 123 4567' }] }).ok && emergencyCall({ country: 'CO', emergencyNumber: '123' }), 'tel:123');
});

test('Ángel Guardián: aviso con ubicación precisa y enlaces de llamada, SMS y WhatsApp', () => {
  assert.equal(validLocation({ lat: 200, lon: 5 }), null);
  const loc = validLocation({ lat: 51.9851034, lon: 5.8987296, accuracy: 7.6 });
  assert.deepEqual(loc, { lat: 51.985103, lon: 5.89873, accuracy: 8 });
  const text = alertText({ childName: 'Niña', kind: 'peligro', location: loc, lang: 'es' });
  assert.equal(text, 'SOS · Niña se siente en peligro. Ubicación: https://maps.google.com/?q=51.985103,5.89873 (±8 m)');
  assert.match(alertText({ kind: 'perdida', lang: 'nl' }), /verdwaald\. Locatie nog onbekend\.$/);
  const links = contactLinks({ phone: '+31612345678', whatsapp: true }, text);
  assert.equal(links.call, 'tel:+31612345678');
  assert.match(links.sms ?? '', /^sms:\+31612345678\?&body=SOS%20%C2%B7%20Ni%C3%B1a/);
  assert.match(links.whatsapp ?? '', /^https:\/\/wa\.me\/31612345678\?text=/);
  assert.equal(contactLinks({ phone: '+31612345678', whatsapp: false }, text).whatsapp, undefined);
  assert.ok(HOLD_MS >= 1500, 'pulsación larga contra avisos accidentales');
});

test('Ángel Guardián: evento con ubicaciones y cierre', () => {
  const event = newSosEvent({ id: 'sos_1', at: '2026-11-24T12:00:00.000Z', kind: 'ayuda', location: { lat: 52, lon: 5 } });
  assert.equal(event.locations.length, 1);
  const moved = addLocation(event, { lat: 52.001, lon: 5.001, accuracy: 5 }, '2026-11-24T12:00:30.000Z');
  assert.equal(moved.locations.length, 2);
  const done = resolveSos(moved, '2026-11-24T12:05:00.000Z');
  assert.equal(done.status, 'resuelto');
  assert.equal(addLocation(done, { lat: 52, lon: 5 }, 'x').locations.length, 2, 'cerrado: ya no se guarda ubicación');
});

test('Primeros auxilios: grafo completo, el 112 llega antes de comprimir y nunca se pide nada en la boca', async () => {
  const { FIRST_AID, FIRST_AID_ENTRIES, FIRST_AID_SOURCES, COMPRESSIONS_PER_MINUTE } = await import('../packages/modules/guardian-angel/src/index.js');
  for (const [id, step] of Object.entries(FIRST_AID)) for (const [, next] of step.next) assert.ok(FIRST_AID[next], `${id} → ${next} existe`);
  for (const [, entry] of FIRST_AID_ENTRIES) assert.ok(FIRST_AID[entry]);
  assert.ok(COMPRESSIONS_PER_MINUTE >= 100 && COMPRESSIONS_PER_MINUTE <= 120, 'ritmo ERC 100–120/min');
  // Desde «no contesta» hay que pasar por «llamar» (112) antes de «rcp».
  assert.deepEqual(FIRST_AID.responde!.next.find(([label]) => /No contesta/.test(label)), ['No contesta', 'llamar']);
  assert.equal(FIRST_AID.llamar!.call112, true);
  assert.ok(FIRST_AID.respira!.next.some(([label, next]) => /No estoy segura/.test(label) && next === 'rcp'), 'en la duda, actuar como si no respirara');
  assert.match(FIRST_AID.convulsion!.say, /No le metas nada en la boca/);
  assert.ok(FIRST_AID_SOURCES.length >= 4, 'varias fuentes que se apoyan entre sí');
  for (const step of Object.values(FIRST_AID)) assert.ok(step.simple.startsWith('O sea'), 'cada paso tiene su forma fácil');
});
