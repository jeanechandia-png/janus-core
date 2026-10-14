import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRODUCT_CATALOG,
  addDays,
  agendaBlock,
  buildDashboardSnapshot,
  buildProductCards,
  normalizeCalendarEvents,
  pendingSales,
  summarizeProductState,
} from '../packages/core/src/dashboard.js';

const TZ = 'Europe/Amsterdam';

test('normaliza eventos de calendario, descarta cancelados y ordena por hora', () => {
  const events = normalizeCalendarEvents([
    { id: 'b', summary: 'Llamada cliente', start: { dateTime: '2026-10-15T11:00:00+02:00' }, end: { dateTime: '2026-10-15T11:30:00+02:00' } },
    { id: 'a', summary: '  ', start: { date: '2026-10-15' }, end: { date: '2026-10-16' } },
    { id: 'x', status: 'cancelled', summary: 'Cancelada', start: { dateTime: '2026-10-15T09:00:00+02:00' } },
    { id: 'y', summary: 'Sin inicio' },
    'basura',
  ], 'work', 'Empresa');
  assert.deepEqual(events.map((event) => event.id), ['a', 'b']);
  assert.equal(events[0]!.allDay, true);
  assert.equal(events[0]!.title, '(sin título)');
  assert.equal(events[1]!.scope, 'work');
});

test('separa la agenda de hoy y mañana en la zona horaria del Founder', () => {
  const events = normalizeCalendarEvents([
    { id: 'tarde', summary: 'Hoy tarde', start: { dateTime: '2026-10-14T23:30:00+02:00' } },
    { id: 'madrugada', summary: 'Mañana temprano', start: { dateTime: '2026-10-14T22:30:00Z' } },
    { id: 'pasado', summary: 'Pasado mañana', start: { date: '2026-10-16' } },
  ], 'personal', 'Personal');
  const block = agendaBlock('personal', { kind: 'events', events, today: '2026-10-14', timeZone: TZ });
  assert.equal(block.state, 'live');
  assert.deepEqual(block.today.map((event) => event.id), ['tarde']);
  // 22:30Z = 00:30 del 15 en Ámsterdam: pertenece a mañana, no a hoy.
  assert.deepEqual(block.tomorrow.map((event) => event.id), ['madrugada']);
});

test('los ámbitos no configurados o con error no inventan citas', () => {
  const missing = agendaBlock('work', { kind: 'unconfigured', reason: 'Define JANUS_CALENDARS_WORK' });
  assert.equal(missing.state, 'unconfigured');
  assert.deepEqual(missing.today, []);
  const failed = agendaBlock('work', { kind: 'error', reason: 'HTTP 401' });
  assert.equal(failed.state, 'error');
  assert.deepEqual(failed.tomorrow, []);
});

test('el estado del producto distingue declarado, observado y error', () => {
  const declared = { label: 'Terminado', by: 'Founder', at: '2026-10-13' };
  assert.equal(summarizeProductState(declared, []), 'declared');
  assert.equal(summarizeProductState(null, []), 'unconfigured');
  assert.equal(summarizeProductState(declared, [{ label: 'x', state: 'live' }]), 'live');
  assert.equal(summarizeProductState(declared, [{ label: 'x', state: 'live' }, { label: 'y', state: 'unconfigured' }]), 'unconfigured');
  assert.equal(summarizeProductState(declared, [{ label: 'x', state: 'live' }, { label: 'y', state: 'error' }]), 'error');
});

test('el catálogo cubre las líneas del grupo y las declaraciones llevan autor y fecha', () => {
  const ids = PRODUCT_CATALOG.map((product) => product.id);
  for (const id of ['infinityseed-group', 'chatbox', 'janus', 'iba']) assert.ok(ids.includes(id), id);
  for (const product of PRODUCT_CATALOG) {
    if (product.declared) {
      assert.equal(product.declared.by, 'Founder');
      assert.match(product.declared.at, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  const cards = buildProductCards({ chatbox: [{ label: 'Netlify', state: 'live' }] });
  assert.equal(cards.find((card) => card.id === 'chatbox')!.state, 'live');
  assert.equal(cards.find((card) => card.id === 'iba')!.state, 'declared');
});

test('ventas sin fuente conectada: pendiente, en euros y sin cifras', () => {
  const sales = pendingSales();
  assert.equal(sales.state, 'pending');
  assert.equal(sales.currency, 'EUR');
  assert.equal(sales.today, null);
  assert.equal(sales.month, null);
});

test('la instantánea prioriza lo que necesita atención y no expone secretos', () => {
  const now = new Date('2026-10-14T05:30:00Z');
  const events = normalizeCalendarEvents([
    { id: 'w1', summary: 'Reunión socios', start: { dateTime: '2026-10-14T10:00:00+02:00' } },
  ], 'work', 'Empresa');
  const snapshot = buildDashboardSnapshot({
    now,
    timeZone: TZ,
    agenda: {
      work: agendaBlock('work', { kind: 'events', events, today: '2026-10-14', timeZone: TZ }),
      personal: agendaBlock('personal', { kind: 'unconfigured', reason: 'Define JANUS_CALENDARS_PERSONAL' }),
    },
    products: buildProductCards({ chatbox: [{ label: 'Netlify', state: 'error', detail: 'HTTP 500' }] }),
    sales: pendingSales(),
    janus: { approvalsPending: 2, confidence: null, capabilities: { available: 3, total: 10 } },
    integrations: [
      { id: 'openai', name: 'OpenAI', state: 'key_present', validatedLive: false },
      { id: 'asana', name: 'Asana', state: 'no_key', validatedLive: false },
    ],
  });
  assert.equal(snapshot.date, '2026-10-14');
  assert.equal(snapshot.attention[0]!.level, 'high');
  assert.ok(snapshot.attention.some((item) => item.text.includes('2 acciones esperan')));
  assert.ok(snapshot.attention.some((item) => item.text.includes('Infinity ChatBox') && item.text.includes('HTTP 500')));
  assert.ok(snapshot.attention.some((item) => item.text.includes('1 cita de la empresa')));
  assert.equal(snapshot.attention.at(-1)!.level, 'low');
  assert.doesNotMatch(JSON.stringify(snapshot), /token|secret|apiKey/i);
});

test('addDays cruza fin de mes correctamente', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
