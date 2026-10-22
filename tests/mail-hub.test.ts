import test from 'node:test';
import assert from 'node:assert/strict';
import { addAccount, connectionConfig, pickerGroups, priorityOf, removeAccount, secretRefFor, unifiedInbox, type MailAccount } from '../packages/modules/mail-hub/src/index.js';

test('varias cuentas por proveedor, sin duplicados, con etiquetas automáticas', () => {
  const l: MailAccount[] = [];
  addAccount(l, { provider: 'gmail', address: 'uno@gmail.com' });
  addAccount(l, { provider: 'gmail', address: 'dos@gmail.com', scope: 'business' });
  addAccount(l, { provider: 'icloud', address: 'Persona@iCloud.com' });
  assert.equal(l.filter((a) => a.provider === 'gmail').length, 2);
  assert.equal(l[1]?.label, 'Gmail 2');
  assert.throws(() => addAccount(l, { provider: 'gmail', address: 'UNO@gmail.com' }), /ya está/);
  assert.throws(() => addAccount(l, { provider: 'yahoo', address: 'no-es-correo' }), /no válida/);
  assert.equal(removeAccount(l, 'gmail:dos@gmail.com'), true);
});

test('iCloud: IMAP verificado, usuario sin dominio y contraseña solo por referencia', () => {
  const l: MailAccount[] = [];
  const a = addAccount(l, { provider: 'icloud', address: 'persona@icloud.com' });
  assert.equal(a.secretRef, secretRefFor('icloud', 'persona@icloud.com'));
  assert.ok(!JSON.stringify(a).includes('secreto-real'));
  assert.deepEqual(connectionConfig(a, () => undefined), { missing: a.secretRef });
  const c = connectionConfig(a, (r) => (r === a.secretRef ? 'secreto-real' : undefined));
  assert.deepEqual(c, { host: 'imap.mail.me.com', port: 993, tls: true, user: 'persona', pass: 'secreto-real' });
  const g = addAccount(l, { provider: 'gmail', address: 'x@gmail.com' });
  assert.deepEqual(connectionConfig(g, () => 'nunca'), { oauth: true, provider: 'gmail', address: 'x@gmail.com' });
});

test('selector agrupado con «añadir cuenta» y bandeja unificada ordenada', () => {
  const l: MailAccount[] = [];
  addAccount(l, { provider: 'gmail', address: 'a@gmail.com' }); addAccount(l, { provider: 'gmail', address: 'b@gmail.com' }); addAccount(l, { provider: 'icloud', address: 'c@icloud.com' });
  const g = pickerGroups(l, { 'gmail:a@gmail.com': 3 });
  assert.deepEqual(g.map((x) => x.provider), ['icloud', 'gmail']);
  assert.equal(g[1]?.accounts[0]?.unread, 3); assert.ok(g.every((x) => x.canAdd));
  const msgs = [{ accountId: 'gmail:a@gmail.com', id: '1', from: 'x', subject: 'hola', date: '2026-10-20', unread: true }, { accountId: 'icloud:c@icloud.com', id: '2', from: 'y', subject: 'Factura octubre', date: '2026-10-22', unread: true }];
  assert.deepEqual(unifiedInbox(l, msgs).map((m) => m.id), ['2', '1']);
  assert.deepEqual(unifiedInbox(l, msgs, { provider: 'gmail' }).map((m) => m.id), ['1']);
  assert.equal(priorityOf(msgs[1]!, ['y']).level, 3);
});
