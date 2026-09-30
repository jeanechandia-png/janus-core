import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import {
  createCitationLedgerSnapshot,
  createWorkGraphSnapshot,
} from '../packages/core/src/kernel-persistence.js';
import { buildImprovementIndex } from '../packages/core/src/improvement-index.js';
import type { CitationLedger } from '../packages/core/src/citation-ledger.js';
import type { DurableJob } from '../packages/core/src/job-engine.js';

test('sqlite persists remaining Intelligence Kernel state and preserves improvement history', () => {
  const store = new SqliteStore(':memory:');

  const graph = createWorkGraphSnapshot({
    id: 'wg-1',
    runId: 'run-1',
    goal: 'Research, analyze and verify',
    nodes: [
      {
        id: 'research',
        label: 'Research',
        kind: 'research',
        dependsOn: [],
        objective: 'Collect evidence',
        expectedOutput: 'sources',
      },
      {
        id: 'verify',
        label: 'Verify',
        kind: 'verification',
        dependsOn: ['research'],
        objective: 'Verify evidence',
        expectedOutput: 'verified sources',
      },
    ],
    completedNodeIds: ['research'],
    runningNodeIds: ['verify'],
    createdAt: '2026-09-30T16:00:00.000Z',
    updatedAt: '2026-09-30T16:05:00.000Z',
  });
  store.upsertWorkGraph(graph);

  const job: DurableJob = {
    id: 'job-1',
    kind: 'document-analysis',
    status: 'running',
    createdAt: '2026-09-30T16:00:00.000Z',
    updatedAt: '2026-09-30T16:05:00.000Z',
    maxConcurrency: 2,
    partitions: [
      {
        id: 'p1',
        order: 1,
        inputRef: 'doc:1',
        status: 'completed',
        attempts: 1,
        checkpoint: 'artifact:p1',
      },
      {
        id: 'p2',
        order: 2,
        inputRef: 'doc:2',
        status: 'running',
        attempts: 1,
      },
    ],
  };
  store.upsertDurableJob(job);

  const ledger: CitationLedger = {
    sources: [
      {
        id: 'source-1',
        sourceType: 'file',
        title: 'Primary document',
        checksum: 'sha256:abc',
      },
    ],
    claims: [
      {
        claim: 'The source supports the result.',
        citations: [{ sourceId: 'source-1', locator: 'unit:4' }],
      },
    ],
  };
  const ledgerSnapshot = createCitationLedgerSnapshot<CitationLedger>({
    id: 'ledger-1',
    runId: 'run-1',
    ledger,
    createdAt: '2026-09-30T16:03:00.000Z',
    updatedAt: '2026-09-30T16:06:00.000Z',
  });
  store.upsertCitationLedger(ledgerSnapshot);

  const firstIndex = buildImprovementIndex(
    [
      {
        id: 'signal-1',
        dimension: 'execution',
        observedAt: '2026-09-30T16:00:00.000Z',
        source: 'verification',
        metric: 'task-success',
        value: 70,
        evidenceRef: 'run:1',
      },
    ],
    '2026-09-30T16:10:00.000Z',
  );
  const secondIndex = buildImprovementIndex(
    [
      {
        id: 'signal-1',
        dimension: 'execution',
        observedAt: '2026-09-30T16:00:00.000Z',
        source: 'verification',
        metric: 'task-success',
        value: 70,
        evidenceRef: 'run:1',
      },
      {
        id: 'signal-2',
        dimension: 'execution',
        observedAt: '2026-09-30T17:00:00.000Z',
        source: 'verification',
        metric: 'task-success',
        value: 90,
        evidenceRef: 'run:2',
      },
    ],
    '2026-09-30T17:10:00.000Z',
  );
  store.appendImprovementIndex(firstIndex, 'janus-core');
  store.appendImprovementIndex(secondIndex, 'janus-core');

  assert.deepEqual(store.getWorkGraph('wg-1'), graph);
  assert.deepEqual(store.listWorkGraphs('run-1'), [graph]);

  assert.deepEqual(store.getDurableJob('job-1'), job);
  assert.equal(store.listDurableJobs('running')[0]?.partitions[1]?.checkpoint, undefined);

  assert.deepEqual(store.getCitationLedger('ledger-1'), ledgerSnapshot);
  assert.equal(store.listCitationLedgers('run-1')[0]?.ledger.claims[0]?.citations[0]?.locator, 'unit:4');

  const history = store.listImprovementIndexHistory('janus-core');
  assert.equal(history.length, 2);
  assert.equal(history[0]?.generatedAt, firstIndex.generatedAt);
  assert.equal(history[1]?.generatedAt, secondIndex.generatedAt);
  assert.equal(store.getLatestImprovementIndex('janus-core')?.generatedAt, secondIndex.generatedAt);

  store.close();
});
