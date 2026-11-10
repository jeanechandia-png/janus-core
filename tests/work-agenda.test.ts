import assert from 'node:assert/strict';
import test from 'node:test';
import { agendaForFounder, agendaForOwner, validateWorkAgendaItem, type WorkAgendaItem } from '../packages/core/src/work-agenda.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

const base = (over: Partial<WorkAgendaItem> = {}): WorkAgendaItem => ({
  id: 'ag_1', principalId: 'w1', kind: 'reminder', visibility: 'private', date: '2026-11-12', text: 'Llamar al dentista',
  done: false, createdAt: '2026-11-10T09:00:00Z', updatedAt: '2026-11-10T09:00:00Z', ...over,
});

test('un recordatorio personal es privado; la disponibilidad y lo ligado a un proyecto son siempre de trabajo', () => {
  assert.equal(validateWorkAgendaItem(base()).visibility, 'private');
  assert.equal(validateWorkAgendaItem(base({ visibility: 'work' })).visibility, 'work');
  // Aunque se pida «privado», un asunto de empresa no puede ocultarse al CEO.
  assert.equal(validateWorkAgendaItem(base({ kind: 'availability', text: '', visibility: 'private' })).visibility, 'work');
  assert.equal(validateWorkAgendaItem(base({ projectId: 'p-api', visibility: 'private' })).visibility, 'work');
  assert.equal(validateWorkAgendaItem(base({ visibility: 'cualquiera' as never })).visibility, 'private');
});

test('validación de fechas, horas y textos', () => {
  assert.throws(() => validateWorkAgendaItem(base({ date: '2026-02-30' })), /date/);
  assert.throws(() => validateWorkAgendaItem(base({ date: '12/11/2026' })), /date/);
  assert.throws(() => validateWorkAgendaItem(base({ time: '25:00' })), /time/);
  assert.throws(() => validateWorkAgendaItem(base({ time: '10:00', endTime: '09:00' })), /after start/);
  assert.throws(() => validateWorkAgendaItem(base({ text: '  ' })), /text is required/);
  assert.throws(() => validateWorkAgendaItem(base({ text: 'x'.repeat(501) })), /too long/);
  assert.throws(() => validateWorkAgendaItem(base({ kind: 'meeting' as never })), /kind/);
  assert.throws(() => validateWorkAgendaItem(base({ projectId: '../x' })), /project id/);
  assert.equal(validateWorkAgendaItem(base({ kind: 'availability', text: '', time: '09:00', endTime: '14:00' })).endTime, '14:00');
});

test('el CEO solo recibe lo de trabajo: lo privado no sale ni contado', () => {
  const items = [
    base({ id: 'a', principalId: 'w1' }),
    base({ id: 'b', principalId: 'w1', kind: 'availability', visibility: 'work', text: '', date: '2026-11-11' }),
    base({ id: 'c', principalId: 'w2', visibility: 'work', text: 'Demo cliente' }),
    base({ id: 'd', principalId: 'w2', text: 'Cita médica' }),
  ];
  const founder = agendaForFounder(items);
  assert.deepEqual(founder.map((item) => item.id), ['b', 'c']);
  assert.doesNotMatch(JSON.stringify(founder), /dentista|Cita médica/);
  assert.deepEqual(agendaForFounder(items, 'w2').map((item) => item.id), ['c']);
  // Cada persona ve todo lo suyo y nada de nadie más.
  assert.deepEqual(agendaForOwner(items, 'w1').map((item) => item.id), ['b', 'a']);
  assert.deepEqual(agendaForOwner(items, 'w3'), []);
});

test('SQLite: nadie sobrescribe ni borra un elemento ajeno', () => {
  const store = new SqliteStore(':memory:');
  store.upsertWorkAgendaItem(base());
  store.upsertWorkAgendaItem({ ...base(), principalId: 'w2', text: 'secuestrado' }); // mismo id, otro dueño: se ignora
  assert.equal(store.getWorkAgendaItem('ag_1')?.text, 'Llamar al dentista');
  assert.equal(store.getWorkAgendaItem('ag_1')?.principalId, 'w1');
  assert.equal(store.deleteWorkAgendaItem('ag_1', 'w2'), false);
  store.upsertWorkAgendaItem({ ...base(), done: true });
  assert.equal(store.listWorkAgendaItems('w1')[0]?.done, true);
  assert.equal(store.listWorkAgendaItems('w2').length, 0);
  assert.equal(store.deleteWorkAgendaItem('ag_1', 'w1'), true);
  assert.equal(store.listWorkAgendaItems().length, 0);
});

test('registro de aperturas de archivos: append-only y más reciente primero', () => {
  const store = new SqliteStore(':memory:');
  store.appendFileAccess({ id: 'fa1', principalId: 'w1', resourceId: 'r1', projectId: 'p1', name: 'a.pdf', action: 'view', at: '2026-11-10T09:00:00.000Z' });
  store.appendFileAccess({ id: 'fa2', principalId: 'w2', resourceId: 'r1', projectId: 'p1', name: 'a.pdf', action: 'view', at: '2026-11-10T10:00:00.000Z' });
  store.appendFileAccess({ id: 'fa1', principalId: 'otro', resourceId: 'x', projectId: 'x', name: 'x', action: 'view', at: '2026-11-10T11:00:00.000Z' });
  const log = store.listFileAccess();
  assert.deepEqual(log.map((entry) => [entry.id, entry.principalId]), [['fa2', 'w2'], ['fa1', 'w1']]);
});
