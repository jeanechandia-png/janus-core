import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyExplicitContinuity } from '../packages/core/src/continuity-classifier.js';
import { reconstructContinuity } from '../packages/core/src/continuity.js';

test('explicit durable instructions are promoted into continuity automatically', () => {
  const records = classifyExplicitContinuity({
    id: 'm1',
    sessionId: 'chat-1',
    at: '2026-09-22T00:50:00.000Z',
    role: 'user',
    content: 'Janus siempre debe reconstruir el contexto cronológicamente antes de continuar.',
    source: 'janus',
  });

  const instruction = records.find((record) => record.kind === 'instruction');
  assert.ok(instruction);
  assert.equal(instruction.status, 'stable');
  assert.match(instruction.subject, /^directive:/);
});

test('explicit error reports are retained unresolved until a structured lesson verifies them', () => {
  const records = classifyExplicitContinuity({
    id: 'm2',
    sessionId: 'chat-2',
    at: '2026-09-22T00:51:00.000Z',
    role: 'user',
    content: 'Este error no se debe repetir y no se puede olvidar; hay que revisar la causa y corregirlo.',
    source: 'janus',
  });

  const snapshot = reconstructContinuity(records);
  assert.equal(snapshot.unresolvedErrors.length, 1);
  assert.equal(snapshot.unresolvedErrors[0]?.metadata?.diagnosisRequired, true);
});