import assert from 'node:assert/strict';
import test from 'node:test';
import { composeFounderMessage, isMessageForFounder } from '../packages/core/src/work-message.js';

const base = { id: 'm1', fromPrincipalId: 'founder', toPrincipalId: 'colab-a', subject: ' Prioridad ', body: ' Primero A. ', now: '2026-11-10T22:00:00Z' };

test('el mensaje del CEO va a una persona concreta y no cuenta como «nuevo» para el CEO', () => {
  const m = composeFounderMessage(base);
  assert.equal(m.toPrincipalId, 'colab-a'); assert.equal(m.recipientId, 'colab-a');
  assert.equal(m.subject, 'Prioridad'); assert.equal(m.body, 'Primero A.'); assert.equal(m.status, 'delivered');
  assert.equal(isMessageForFounder(m), false);
  assert.equal(isMessageForFounder({ ...m, toPrincipalId: undefined }), true);
});

test('adjuntos: exigen proyecto, permiten mensaje sin texto y están acotados', () => {
  const file = { resourceId: 'r1', name: 'plano.pdf' };
  assert.throws(() => composeFounderMessage({ ...base, attachments: [file] }), /project/);
  const m = composeFounderMessage({ ...base, body: '', projectId: 'p1', attachments: [file] });
  assert.deepEqual(m.attachments, [file]); assert.equal(m.body, '(archivo adjunto)');
  assert.throws(() => composeFounderMessage({ ...base, projectId: 'p1', attachments: Array.from({ length: 9 }, (_, i) => ({ resourceId: 'r' + i, name: 'f' + i })) }), /too many/);
});

test('validación: asunto, cuerpo y destinatario', () => {
  assert.throws(() => composeFounderMessage({ ...base, subject: ' ' }), /subject/);
  assert.throws(() => composeFounderMessage({ ...base, body: ' ' }), /body/);
  assert.throws(() => composeFounderMessage({ ...base, toPrincipalId: 'a b' }), /recipient/);
  assert.equal(composeFounderMessage({ ...base, replyToId: 'm0' }).replyToId, 'm0');
});
