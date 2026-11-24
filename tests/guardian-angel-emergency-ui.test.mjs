import test from 'node:test';
import assert from 'node:assert/strict';
import { sosDeliveryLabel, refugeSearchUrl, orderedGuardians } from '../apps/pwa/guardian-angel-ui.js';

test('SOS: registro no equivale a recepción, ubicación sin confirmación y práctica privada', () => {
  const lastLoc = { lat: 52, lon: 5, accuracy: 15, at: '2026-11-24T12:00:00.000Z' };
  assert.match(sosDeliveryLabel({ lastLoc, sosId: 'sos_test' }), /recepción por la familia sin confirmar/);
  assert.match(sosDeliveryLabel({ lastLoc, sosId: 'sos_test' }), /envío todavía sin confirmar/);
  assert.match(sosDeliveryLabel({ lastLoc, sosId: 'sos_test', sentAt: lastLoc.at }), /registrada en Janus/);
  assert.match(sosDeliveryLabel({ createFailed: true, gpsError: true }), /No se confirmó el SOS/);
  assert.match(sosDeliveryLabel({ practice: true, lastLoc }), /no se envía ubicación/);
  assert.doesNotMatch(sosDeliveryLabel({ lastLoc: { lat:52, lon:5 } }), /±0/);
});

test('SOS: búsqueda externa solo por categorías permitidas, no destinos privados', () => {
  assert.equal(refugeSearchUrl(null,'police'), null);
  assert.equal(refugeSearchUrl({lat:null,lon:null},'police'), null);
  assert.equal(refugeSearchUrl({lat:999,lon:5},'hospital'), null);
  assert.equal(refugeSearchUrl({lat:52,lon:5},'home'), null);
  const u = new URL(refugeSearchUrl({lat:52,lon:5},'police'));
  assert.equal(u.hostname,'www.google.com');
  assert.equal(u.searchParams.get('query'),'politie near 52,5');
});

test('SOS: contacto principal primero, luego madre y familiar, sin mutar datos', () => {
  const input = [{role:'familiar',name:'Familiar'}, {role:'madre',name:'Madre'}, {role:'padre',name:'Padre',primary:true}];
  assert.deepEqual(orderedGuardians(input).map(g=>g.role),['padre','madre','familiar']);
  assert.equal(input[0].role,'familiar');
});
