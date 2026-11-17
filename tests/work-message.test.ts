import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  derivePrivateTextKey, evaluateWorkMessage, isSealedText, openPrivateText, parseInternalRecipients, sealPrivateText,
} from '../packages/core/src/work-message.js';
import { FallbackModelRouter } from '../packages/gateways/src/model-router.js';
import { validateProjectWorkspace } from '../packages/core/src/project-context.js';
import { validateWorkAgendaItem } from '../packages/core/src/work-agenda.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import type { ModelGateway, ModelResponse } from '../packages/gateways/src/contracts.js';

const allowed = [{ id: 'ceo', label: 'CEO' }, { id: 'empresa', label: 'Empresa' }];
const send = (recipient: string) => evaluateWorkMessage({ id: 'm1', fromPrincipalId: 'w1', recipient, subject: 'Asunto', body: 'Cuerpo', allowed, now: '2026-11-10T12:00:00Z' });

test('mensajes: solo destinatarios internos; lo externo se rechaza solo y no se guarda la dirección', () => {
  assert.equal(send('ceo').status, 'delivered');
  assert.equal(send(' CEO ').recipientId, 'ceo');
  for (const outside of ['alguien@gmail.com', 'mi.correo@personal.example', 'https://sitio.example', 'cliente']) {
    const message = send(outside);
    assert.equal(message.status, 'rejected'); assert.equal(message.decision, 'recipient_outside_company');
    assert.equal(message.recipientId, 'external');
    assert.doesNotMatch(JSON.stringify(message), /gmail|personal\.example|sitio\.example/);
  }
  assert.throws(() => evaluateWorkMessage({ id: 'm', fromPrincipalId: 'w', recipient: 'ceo', subject: ' ', body: 'x', allowed, now: '2026-11-10T12:00:00Z' }), /subject/);
  assert.throws(() => evaluateWorkMessage({ id: 'm', fromPrincipalId: 'w', recipient: 'ceo', subject: 's', body: 'x'.repeat(4001), allowed, now: '2026-11-10T12:00:00Z' }), /too long/);
  assert.throws(() => send(''), /recipient/);
});

test('destinatarios internos: configuración tolerante, por defecto solo el CEO', () => {
  assert.deepEqual(parseInternalRecipients(undefined), [{ id: 'ceo', label: 'CEO' }]);
  assert.deepEqual(parseInternalRecipients('ceo:CEO, empresa:Empresa ,malo, x@y:Mal,ceo:Duplicado'), [{ id: 'ceo', label: 'Duplicado' }, { id: 'empresa', label: 'Empresa' }]);
  assert.deepEqual(parseInternalRecipients(',,,'), [{ id: 'ceo', label: 'CEO' }]);
});

test('agenda privada cifrada en reposo: ilegible sin la clave, intacta con ella', () => {
  const key = derivePrivateTextKey(randomBytes(32).toString('base64'));
  assert.ok(key);
  const sealed = sealPrivateText('Cita con el médico', key);
  assert.ok(isSealedText(sealed)); assert.doesNotMatch(sealed, /médico|Cita/);
  assert.equal(openPrivateText(sealed, key), 'Cita con el médico');
  assert.notEqual(sealPrivateText('Cita con el médico', key), sealed, 'cada cifrado usa un vector nuevo');
  assert.equal(sealPrivateText(sealed, key), sealed, 'no se cifra dos veces');
  assert.equal(openPrivateText(sealed, derivePrivateTextKey(randomBytes(32).toString('base64'))), '', 'otra clave no lo abre');
  assert.equal(openPrivateText(sealed.slice(0, -3) + 'AAA', key), '', 'dato manipulado: vacío, nunca texto corrupto');
  assert.equal(openPrivateText(sealed, null), '');
  // Sin clave configurada se guarda tal cual (y se dice en la documentación).
  assert.equal(sealPrivateText('texto', null), 'texto'); assert.equal(openPrivateText('texto', key), 'texto');
  assert.equal(derivePrivateTextKey(''), null); assert.equal(derivePrivateTextKey('Y29ydGE='), null);
  // En SQLite queda el texto sellado, no el original.
  const store = new SqliteStore(':memory:');
  const item = validateWorkAgendaItem({ id: 'ag1', principalId: 'w1', kind: 'reminder', visibility: 'private', date: '2026-12-01', text: 'Cita con el médico', done: false, createdAt: '2026-11-10T09:00:00Z', updatedAt: '2026-11-10T09:00:00Z', timeZone: 'America/Bogota' });
  store.upsertWorkAgendaItem({ ...item, text: sealPrivateText(item.text, key) });
  assert.doesNotMatch(JSON.stringify(store.listWorkAgendaItems()), /médico/);
  assert.equal(item.timeZone, 'America/Bogota');
  assert.equal(validateWorkAgendaItem({ ...item, timeZone: 'No/Existe' }).timeZone, undefined);
});

test('«solo modelo propio»: el enrutador se queda sin proveedores externos o devuelve null', async () => {
  const calls: string[] = [];
  const provider = (id: string) => ({ id, gateway: { complete: async () => { calls.push(id); return { text: id } as ModelResponse; } } as ModelGateway });
  const router = new FallbackModelRouter([provider('anthropic'), provider('custom'), provider('gemini')]);
  const local = router.only(['custom']);
  assert.deepEqual(local?.providerIds(), ['custom']);
  await local!.complete({ messages: [] } as never);
  assert.deepEqual(calls, ['custom']);
  assert.equal(new FallbackModelRouter([provider('anthropic'), provider('openai')]).only(['custom']), null, 'sin modelo propio no se cae a uno externo');
  const base = { id: 'p1', name: 'P', status: 'active' as const, createdBy: 'founder', createdAt: '2026-11-10T09:00:00Z', updatedAt: '2026-11-10T09:00:00Z' };
  assert.equal(validateProjectWorkspace({ ...base, modelPolicy: 'local_only' }).modelPolicy, 'local_only');
  assert.throws(() => validateProjectWorkspace({ ...base, modelPolicy: 'cualquiera' as never }), /modelPolicy/);
});

test('avisos: suscripciones por persona y recordatorio avisado una sola vez', () => {
  const store = new SqliteStore(':memory:');
  store.upsertPushSubscription({ endpoint: 'https://web.push.apple.com/a', principalId: 'w1', p256dh: 'k', auth: 'a', createdAt: '2026-11-10T09:00:00Z' });
  store.upsertPushSubscription({ endpoint: 'https://web.push.apple.com/b', principalId: 'w2', p256dh: 'k', auth: 'a', createdAt: '2026-11-10T09:00:00Z' });
  assert.equal(store.listPushSubscriptions('w1').length, 1);
  store.deletePushSubscription('https://web.push.apple.com/a', 'w2'); // otra persona no puede dar de baja mi dispositivo
  assert.equal(store.listPushSubscriptions('w1').length, 1);
  store.deletePushSubscription('https://web.push.apple.com/a', 'w1');
  assert.equal(store.listPushSubscriptions('w1').length, 0);
  assert.equal(store.markReminderPushed('ag1', '2026-11-10T09:00:00Z'), true);
  assert.equal(store.markReminderPushed('ag1', '2026-11-10T09:01:00Z'), false);
});
