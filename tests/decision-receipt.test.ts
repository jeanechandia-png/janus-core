import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDecisionReceipt,
  verifyDecisionReceipt,
  verifyReceiptChain,
} from '../packages/core/src/decision-receipt.js';

test('decision receipts are tamper-evident and chainable', () => {
  const first = createDecisionReceipt({
    id: 'r1',
    runId: 'run1',
    blueprintId: 'bp1',
    blueprintRevision: 1,
    decisionKind: 'route_model',
    selectedWorker: 'local-qwen',
    confidence: 0.8,
    inputRefs: ['task:1'],
    outputSummary: 'selected local model',
    at: '2026-09-23T00:00:00.000Z',
  });

  const second = createDecisionReceipt({
    id: 'r2',
    runId: 'run1',
    blueprintId: 'bp1',
    blueprintRevision: 1,
    decisionKind: 'verify',
    selectedWorker: 'verifier-1',
    confidence: 0.9,
    inputRefs: [first.hash],
    outputSummary: 'verification passed',
    at: '2026-09-23T00:01:00.000Z',
    previousReceiptHash: first.hash,
  });

  assert.equal(verifyDecisionReceipt(first), true);
  assert.equal(verifyReceiptChain([first, second]).ok, true);
  assert.equal(verifyDecisionReceipt({ ...first, confidence: 0.1 }), false);
});
