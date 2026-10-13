import assert from 'node:assert/strict';
import test from 'node:test';
import { ApprovalDecisionError, ApprovalQueue, type ApprovalRecord } from '../packages/core/src/approval-queue.js';

const base = { runId: 'run-1', actionId: 's1', label: 'Generar vídeo en Runway', tool: 'runway', operation: 'video.create', risk: 'high' };

test('a sensitive action waits until the Founder approves; the decision is single and audited', async () => {
  const audit: ApprovalRecord[] = [];
  const queue = new ApprovalQueue({ onTransition: (record) => audit.push(record) });
  const { record, outcome } = queue.request(base);
  assert.equal(queue.pending().length, 1);
  queue.decide(record.id, { approved: true, decidedBy: 'founder', note: 'ok' });
  const result = await outcome;
  assert.equal(result.approved, true);
  assert.equal(result.record.decidedBy, 'founder');
  assert.equal(queue.pending().length, 0);
  assert.deepEqual(audit.map((item) => item.status), ['pending', 'approved']);
  assert.throws(() => queue.decide(record.id, { approved: false, decidedBy: 'founder' }), (error: unknown) => error instanceof ApprovalDecisionError && error.code === 'already_decided');
  assert.throws(() => queue.decide('approval_nope', { approved: true, decidedBy: 'founder' }), /not found/);
});

test('rejection, expiry and run cancellation never approve', async () => {
  const queue = new ApprovalQueue({ timeoutMs: 30 });
  const rejected = queue.request(base);
  queue.decide(rejected.record.id, { approved: false, decidedBy: 'founder', note: 'No, demasiado caro' });
  assert.deepEqual(await rejected.outcome.then((o) => [o.approved, o.status, o.reason]), [false, 'rejected', 'No, demasiado caro']);
  const expired = queue.request(base);
  assert.deepEqual(await expired.outcome.then((o) => [o.approved, o.status]), [false, 'expired']);
  const long = new ApprovalQueue({ timeoutMs: 60_000 });
  const a = long.request({ ...base, runId: 'run-x' });
  const b = long.request({ ...base, runId: 'run-y' });
  assert.equal(long.cancelRun('run-x'), 1);
  assert.equal((await a.outcome).status, 'cancelled');
  assert.equal(long.pending()[0]!.id, b.record.id);
  long.decide(b.record.id, { approved: false, decidedBy: 'founder' });
  assert.equal(long.recent(5).length, 2);
});
