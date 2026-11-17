import assert from 'node:assert/strict';
import test from 'node:test';
import { HitlDeniedError, HitlGate, classifyOperation, strictest, type HitlApprovalRequest } from '../packages/core/src/operation-risk.js';

const lvl = (d: Parameters<typeof classifyOperation>[0], p?: Parameters<typeof classifyOperation>[1]) => classifyOperation(d, p).level;

test('lecturas y borradores se ejecutan solos', () => {
  assert.equal(lvl({ service: 'github', operation: 'listRepos', method: 'GET', path: '/user/repos' }), 'auto');
  assert.equal(lvl({ service: 'iba', operation: 'clients', graphql: 'query' }), 'auto');
  assert.equal(lvl({ service: 'mail', operation: 'createDraft', method: 'POST', path: '/drafts' }), 'auto');
  assert.equal(lvl({ service: 'janus', operation: 'runTests', method: 'POST', environment: 'sandbox' }), 'auto');
  assert.equal(lvl({ service: 'db', operation: 'query', sql: 'SELECT id FROM clients WHERE active = 1' }), 'auto');
});

test('destructivo o producción: restringido siempre, aunque el servicio sea de confianza', () => {
  const trusted = { trustedForMinorWrites: ['github', 'iba', 'db', 'web'] };
  assert.equal(lvl({ service: 'github', operation: 'deleteRepo', method: 'DELETE', path: '/repos/x' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'iba', operation: 'removeUser', method: 'POST', path: '/users/remove' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'iba', operation: 'eliminarImagen', method: 'POST' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'db', operation: 'exec', sql: 'DROP TABLE users' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'db', operation: 'exec', sql: 'SELECT 1; DELETE FROM users' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'web', operation: 'updatePage', method: 'PUT', environment: 'production' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'web', operation: 'deploySite', method: 'POST' }, trusted), 'restricted');
  assert.equal(lvl({ service: 'pay', operation: 'createPayment', method: 'POST' }, { trustedForMinorWrites: ['pay'] }), 'restricted');
  assert.equal(lvl({ service: 'mcp', operation: 'cleanup', destructiveHint: true }), 'restricted');
});

test('escrituras normales esperan aprobación; adición menor solo en servicios de confianza', () => {
  const note = { service: 'iba', operation: 'addNote', method: 'POST', path: '/notes' };
  assert.equal(lvl(note), 'approval');
  assert.equal(lvl(note, { trustedForMinorWrites: ['iba'] }), 'auto');
  assert.equal(lvl({ service: 'iba', operation: 'editNote', method: 'PATCH', path: '/notes/1' }, { trustedForMinorWrites: ['iba'] }), 'approval');
  assert.equal(lvl({ service: 'db', operation: 'exec', sql: "INSERT INTO notes VALUES ('x')" }), 'approval');
  assert.equal(lvl({ service: 'x', operation: 'thing' }), 'approval', 'sin método conocido se asume escritura');
  assert.equal(lvl({ service: 'mcp', operation: 'saveThing', method: 'POST', readOnlyHint: true }), 'approval', 'una pista de solo lectura no rebaja un método que escribe');
  assert.equal(strictest('auto', 'approval'), 'approval'); assert.equal(strictest('restricted', 'approval'), 'restricted');
});

test('la puerta pausa hasta la decisión, avisa al dispositivo y sin aprobación no ejecuta', async () => {
  const asked: HitlApprovalRequest[] = []; const notified: string[] = []; const audit: string[] = [];
  let decide!: (v: { approved: boolean; status: string; approvalId: string }) => void;
  const gate = new HitlGate({
    requestApproval: (request) => { asked.push(request); return new Promise((resolve) => { decide = resolve; }); },
    notify: (request) => { notified.push(request.operation); throw new Error('sin red'); },
    audit: (event) => audit.push(`${event.operation}:${event.outcome}`),
  });
  assert.equal((await gate.authorize({ service: 'github', operation: 'listRepos', method: 'GET' }, { runId: 'r', actionId: 'a1' })).level, 'auto');
  assert.equal(asked.length, 0);
  let settled = false;
  const waiting = gate.authorize({ service: 'github', operation: 'deleteRepo', method: 'DELETE' }, { runId: 'r', actionId: 'a2', target: 'infinity/web' }).then((v) => { settled = true; return v; });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(settled, false, 'el hilo queda en pausa'); assert.equal(asked[0]!.risk, 'restricted'); assert.equal(asked[0]!.reversible, false);
  assert.deepEqual(notified, ['github.deleteRepo'], 'un fallo del aviso no rompe la espera');
  decide({ approved: true, status: 'approved', approvalId: 'approval_1' });
  assert.equal((await waiting).approvalId, 'approval_1');
  const denied = gate.authorize({ service: 'iba', operation: 'addNote', method: 'POST' }, { runId: 'r', actionId: 'a3' });
  await new Promise((resolve) => setTimeout(resolve, 5)); decide({ approved: false, status: 'expired', approvalId: 'approval_2' });
  await assert.rejects(denied, (error: unknown) => error instanceof HitlDeniedError && error.status === 'expired');
  assert.deepEqual(audit, ['github.listRepos:auto', 'github.deleteRepo:approved', 'iba.addNote:denied']);
});
