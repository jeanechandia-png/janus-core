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
      kendra: agendaBlock('kendra', { kind: 'events', events: normalizeCalendarEvents([{ id: 'k1', summary: 'Médico', start: { dateTime: '2026-10-14T16:00:00+02:00' } }], 'kendra', 'Kendra'), today: '2026-10-14', timeZone: TZ }),
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
  assert.ok(snapshot.attention.some((item) => item.text === 'Kendra tiene hoy «Médico».'));
  assert.equal(snapshot.social.state, 'unconfigured');
  assert.equal(snapshot.attention.at(-1)!.level, 'low');
  assert.doesNotMatch(JSON.stringify(snapshot), /token|secret|apiKey/i);
});

test('addDays cruza fin de mes correctamente', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('redes: valida la configuración de cuentas y descarta entradas inválidas', async () => {
  const { parseSocialAccounts } = await import('../packages/core/src/dashboard.js');
  const accounts = parseSocialAccounts(JSON.stringify([
    { id: 'infinityseedgroup', igUserId: '17841400000000001', label: 'Infinity Seed Group', productId: 'infinityseed-group', followerGoal: 10000 },
    { id: 'malo', igUserId: 'no-numérico' },
    { id: 'sin-meta', igUserId: '17841400000000002', followerGoal: -5 },
  ]));
  assert.deepEqual(accounts.map((account) => account.id), ['infinityseedgroup', 'sin-meta']);
  assert.equal(accounts[0]!.followerGoal, 10000);
  assert.equal(accounts[1]!.followerGoal, null);
  assert.throws(() => parseSocialAccounts('{no es json'), /JSON array/);
  assert.deepEqual(parseSocialAccounts(undefined), []);
});

test('redes: un reel con #ChatBox en la cuenta del grupo cuenta para ChatBox', async () => {
  const { attributeReel, normalizeReels } = await import('../packages/core/src/dashboard.js');
  assert.deepEqual(attributeReel('Nuevo asistente #ChatBox #ia', 'infinityseed-group'), { productId: 'chatbox', attribution: 'hashtag' });
  assert.deepEqual(attributeReel('Marketing 360 con dron', 'infinityseed-group'), { productId: 'infinityseed-group', attribution: 'cuenta' });
  const rows = normalizeReels([
    { id: 'r1', caption: 'Primer reel\n#infinity_chatbox', publishedAt: '2026-10-10T10:00:00Z', permalink: 'https://www.instagram.com/reel/abc/', metrics: { views: 1200, likes: 80, comments: 4 } },
    { id: 'r2', caption: '', publishedAt: '2026-10-12T10:00:00Z', permalink: 'javascript:alert(1)', metrics: { views: null } },
  ], 'infinityseed-group');
  assert.deepEqual(rows.map((row) => row.id), ['r2', 'r1']);
  assert.equal(rows[0]!.title, 'Reel sin texto');
  assert.equal(rows[0]!.permalink, null);
  assert.equal(rows[1]!.productId, 'chatbox');
  assert.equal(rows[1]!.views, 1200);
  assert.equal(rows[0]!.views, null);
});

test('redes: historial diario, variación semanal y avance hacia la meta del Founder', async () => {
  const { buildSocialAccountCard, followerHistory } = await import('../packages/core/src/dashboard.js');
  const history = followerHistory([
    { date: '2026-10-01', followers: 900 }, { date: '2026-10-07', followers: 950 },
    { date: '2026-10-07', followers: 960 }, { date: '2026-10-14', followers: 1000 }, { date: 'basura', followers: 1 },
  ]);
  assert.deepEqual(history.map((point) => point.followers), [900, 960, 1000]);
  const card = buildSocialAccountCard({
    config: { id: 'isg', igUserId: '17841400000000001', label: 'Infinity Seed', productId: 'infinityseed-group', followerGoal: 10000 },
    state: 'live', followers: 1000, history,
  });
  assert.equal(card.delta7d, 40);
  assert.equal(card.progress, 0.1);
  const noGoal = buildSocialAccountCard({ config: { id: 'x', igUserId: '17841400000000003', label: 'X', productId: 'chatbox', followerGoal: null }, state: 'unconfigured', reason: 'Falta META_ACCESS_TOKEN' });
  assert.equal(noGoal.progress, null);
  assert.equal(noGoal.followers, null);
  assert.equal(noGoal.delta7d, null);
});
