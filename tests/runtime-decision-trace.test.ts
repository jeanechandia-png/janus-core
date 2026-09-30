import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyReceiptChain } from '../packages/core/src/decision-receipt.js';
import {
  appendChainedDecisionReceipt,
  createRuntimeDecisionBlueprint,
  ensureDecisionBlueprint,
} from '../packages/core/src/runtime-decision-trace.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('creates a stable runtime blueprint and preserves revisions as immutable', () => {
  const store = new SqliteStore(':memory:');
  try {
    const blueprint = createRuntimeDecisionBlueprint({
      createdAt: '2026-09-30T18:30:00.000Z',
      toolCatalog: {
        'google-workspace': ['gmail.messages.search', 'drive.files.search'],
        github: ['file.read', 'repo.get'],
      },
    });

    const ensured = ensureDecisionBlueprint(store, blueprint);
    assert.equal(ensured.id, 'janus-runtime-execution');
    assert.equal(ensured.revision, 1);
    assert.deepEqual(
      ensured.tools.map((tool) => [tool.tool, tool.actions]),
      [
        ['github', ['file.read', 'repo.get']],
        ['google-workspace', ['drive.files.search', 'gmail.messages.search']],
      ],
    );

    ensureDecisionBlueprint(store, blueprint);
    assert.equal(store.listDecisionBlueprints(blueprint.id).length, 1);

    assert.throws(
      () => ensureDecisionBlueprint(store, { ...blueprint, objective: 'mutated objective' }),
      /immutable/i,
    );
  } finally {
    store.close();
  }
});

test('appends tamper-evident decision receipts as a per-run hash chain', () => {
  const store = new SqliteStore(':memory:');
  try {
    const blueprint = ensureDecisionBlueprint(
      store,
      createRuntimeDecisionBlueprint({
        createdAt: '2026-09-30T18:30:00.000Z',
        toolCatalog: { github: ['repo.get'] },
      }),
    );

    const first = appendChainedDecisionReceipt(store, {
      blueprint,
      runId: 'run_test',
      decisionKind: 'blueprint_selection',
      selectedWorker: blueprint.id + '@' + blueprint.revision,
      confidence: 1,
      inputRefs: ['run:run_test'],
      outputSummary: 'Runtime blueprint selected.',
      at: '2026-09-30T18:31:00.000Z',
    });

    const second = appendChainedDecisionReceipt(store, {
      blueprint,
      runId: 'run_test',
      decisionKind: 'plan_verification',
      selectedWorker: 'janus-core/plan-validator',
      confidence: 1,
      inputRefs: ['receipt:' + first.hash],
      outputSummary: 'Plan validated.',
      at: '2026-09-30T18:31:01.000Z',
    });

    assert.equal(second.previousReceiptHash, first.hash);
    const receipts = store.listDecisionReceipts('run_test');
    assert.equal(receipts.length, 2);
    assert.deepEqual(verifyReceiptChain(receipts), { ok: true });
  } finally {
    store.close();
  }
});
