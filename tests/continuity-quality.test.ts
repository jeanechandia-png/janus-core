import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bootstrapContinuity,
  ErrorLedger,
  type ChronologyRecord,
} from '../packages/core/src/continuity.js';
import {
  DeliveryGate,
  type QualityDimension,
  type QualityReviewer,
} from '../packages/core/src/delivery-gate.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('continuity bootstrap replays sessions chronologically and resumes from latest valid state', () => {
  const older: ChronologyRecord = {
    id: 'r1',
    sessionId: 'chat-1',
    at: '2026-09-20T09:00:00.000Z',
    sequence: 1,
    kind: 'instruction',
    subject: 'voice-parity',
    content: 'Voice must execute tools.',
    status: 'current',
  };
  const newer: ChronologyRecord = {
    id: 'r3',
    sessionId: 'chat-2',
    at: '2026-09-21T09:00:00.000Z',
    sequence: 1,
    kind: 'instruction',
    subject: 'voice-parity',
    content: 'Voice must speak, execute and show activity simultaneously.',
    status: 'current',
    supersedesId: 'r1',
  };
  const task: ChronologyRecord = {
    id: 'r4',
    sessionId: 'chat-2',
    at: '2026-09-21T09:01:00.000Z',
    sequence: 2,
    kind: 'task',
    subject: 'janus-development',
    content: 'Continue from continuity engine implementation.',
    status: 'current',
  };

  const snapshot = bootstrapContinuity([
    { sessionId: 'chat-2', startedAt: '2026-09-21T09:00:00.000Z', records: [task, newer] },
    { sessionId: 'chat-1', startedAt: '2026-09-20T09:00:00.000Z', records: [older] },
  ]);

  assert.deepEqual(snapshot.orderedRecords.map((record) => record.id), ['r1', 'r3', 'r4']);
  assert.equal(snapshot.currentBySubject['voice-parity']?.id, 'r3');
  assert.equal(snapshot.historical.some((record) => record.id === 'r1'), true);
  assert.equal(snapshot.activeInstructions[0]?.id, 'r3');
  assert.equal(snapshot.resumeFrom?.id, 'r4');
  assert.equal(snapshot.latestSessionId, 'chat-2');
});

test('error ledger escalates recurrences and requires review of failed protection', () => {
  const ledger = new ErrorLedger();
  const base = {
    fingerprint: 'stale-state-documentation',
    error: 'STATE.md described completed work as pending.',
    cause: 'State document was not refreshed after implementation.',
    impact: 'A future session could rebuild completed work.',
    lesson: 'Current state must be refreshed after every completed phase.',
    preventiveRule: 'Before new work, sync VIGENTE state against code, tests and chronology.',
    solutions: ['Refresh STATE.md', 'Add continuity bootstrap'],
    change: 'Added continuity engine.',
    verification: 'CI and state review.',
  };

  const first = ledger.record({
    ...base,
    id: 'err-1',
    at: '2026-09-21T10:00:00.000Z',
  });
  const second = ledger.record({
    ...base,
    id: 'err-2',
    at: '2026-09-22T10:00:00.000Z',
  });
  const third = ledger.record({
    ...base,
    id: 'err-3',
    at: '2026-09-23T10:00:00.000Z',
  });

  assert.equal(first.priority, 'normal');
  assert.equal(second.priority, 'high');
  assert.equal(second.requiresProtectionReview, true);
  assert.equal(third.priority, 'critical');
  assert.equal(third.recurrenceCount, 3);
  assert.deepEqual(ledger.preventiveRules(), [
    'Before new work, sync VIGENTE state against code, tests and chronology.',
  ]);
});

test('continuity and lessons survive SQLite roundtrip', () => {
  const store = new SqliteStore(':memory:');
  try {
    const record: ChronologyRecord = {
      id: 'record-1',
      sessionId: 'chat-9',
      at: '2026-09-22T00:30:00.000Z',
      sequence: 7,
      kind: 'instruction',
      subject: 'chronological-continuity',
      content: 'Always reconstruct context in chronological order before continuing.',
      status: 'stable',
      metadata: { source: 'user' },
    };
    store.appendChronologyRecord(record);

    const ledger = new ErrorLedger();
    const lesson = ledger.record({
      id: 'lesson-1',
      fingerprint: 'repeat-old-error',
      at: '2026-09-22T00:31:00.000Z',
      error: 'Repeated a known error.',
      cause: 'Previous lesson was not loaded.',
      impact: 'Lost time.',
      lesson: 'Load lessons before planning.',
      preventiveRule: 'Bootstrap the error ledger before execution.',
      solutions: ['Persist lessons locally'],
      change: 'Added SQLite error ledger.',
      verification: 'Roundtrip test.',
    });
    store.upsertErrorLesson(lesson);

    assert.deepEqual(store.listChronologyRecords(), [record]);
    assert.deepEqual(store.listErrorLessons(), [lesson]);
  } finally {
    store.close();
  }
});

test('delivery gate requires every automatic quality filter before release', async () => {
  const dimensions: QualityDimension[] = [
    'coherence',
    'structural',
    'visual',
    'architectural',
    'orthographic',
    'synthesis',
  ];
  const reviewers: QualityReviewer[] = dimensions.map((dimension) => ({
    dimension,
    name: `reviewer-${dimension}`,
    review: async () => [],
  }));

  const gate = new DeliveryGate(reviewers, {
    now: () => new Date('2026-09-22T00:40:00.000Z'),
  });
  const passed = await gate.evaluate({
    id: 'artifact-1',
    kind: 'document',
    content: 'Resultado final revisado.',
  });

  assert.equal(passed.passed, true);
  assert.equal(passed.reviews.length, 6);

  const incomplete = new DeliveryGate(reviewers.slice(0, -1));
  const rejected = await incomplete.evaluate({
    id: 'artifact-2',
    kind: 'text',
    content: 'No debe salir sin filtro de síntesis.',
  });

  assert.equal(rejected.passed, false);
  assert.equal(
    rejected.blockingFindings.some((finding) => finding.code === 'reviewer.missing'),
    true,
  );
});
