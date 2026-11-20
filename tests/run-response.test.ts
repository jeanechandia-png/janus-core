import assert from 'node:assert/strict';
import test from 'node:test';
import type { JanusEvent, RunSnapshot } from '../packages/core/src/events.js';
import {
  safeSpokenRunSummary,
  sanitizeForSpeech,
} from '../packages/voice/src/run-response.js';

function snapshot(status: RunSnapshot['status']): RunSnapshot {
  return {
    runId: 'run_1',
    goal: 'Revisar información',
    status,
    lastEventSeq: 3,
    startedAt: '2026-09-13T18:00:00.000Z',
    updatedAt: '2026-09-13T18:01:00.000Z',
  };
}

function event(
  seq: number,
  type: JanusEvent['type'],
  payload: Record<string, unknown>,
): JanusEvent {
  return {
    id: `event_${seq}`,
    runId: 'run_1',
    seq,
    type,
    at: `2026-09-13T18:00:0${seq}.000Z`,
    source: 'tool',
    summary: 'Evento',
    payload,
  };
}

test('completed voice response uses only the latest artifact preview', () => {
  const events = [
    event(1, 'artifact.updated', {
      preview: 'Primer resultado seguro.',
      result: { output: { content: 'SECRETO-RAW-1' } },
    }),
    event(2, 'tool.completed', {
      result: { output: { content: 'SECRETO-RAW-2' } },
      snippet: 'SECRETO-SNIPPET',
    }),
    event(3, 'artifact.updated', {
      preview: 'Tres elementos encontrados.',
      result: { output: { content: 'SECRETO-RAW-3' } },
    }),
  ];

  const spoken = safeSpokenRunSummary(snapshot('completed'), events);
  assert.equal(spoken, 'Listo. Tres elementos encontrados.');
  assert.equal(spoken?.includes('SECRETO'), false);
});

test('blocked and failed responses stay compact and do not expose error payloads', () => {
  const rawFailure = event(1, 'run.failed', {
    error: 'token=super-secret-value',
    result: { body: 'private body' },
  });

  assert.equal(
    safeSpokenRunSummary(snapshot('blocked'), [rawFailure]),
    'La tarea necesita atención antes de continuar.',
  );
  assert.equal(
    safeSpokenRunSummary(snapshot('failed'), [rawFailure]),
    'La tarea terminó con un error y necesita revisión.',
  );
});

test('cancelled runs do not speak automatically', () => {
  assert.equal(
    safeSpokenRunSummary(snapshot('cancelled'), [event(1, 'artifact.updated', { preview: 'Algo' })]),
    undefined,
  );
});

test('speech sanitizer removes control whitespace and truncates long previews', () => {
  const long = `uno\n\tdos ${'x'.repeat(500)}`;
  const clean = sanitizeForSpeech(long);
  assert.ok(clean.startsWith('uno dos '));
  assert.equal(clean.includes('\n'), false);
  assert.ok(clean.length <= 420);
  assert.ok(clean.endsWith('…'));
});

test('Janus no pronuncia una respuesta factual rechazada o sin confirmar', () => {
  for (const verdict of ['RECHAZADO', 'DESCARTADO', 'POR CONFIRMAR']) {
    const speech = safeSpokenRunSummary(snapshot('completed'), [
      event(1, 'artifact.updated', {
        preview: 'El supuesto hecho sin evidencia queda oculto.',
        citationVerdict: verdict,
      }),
    ]);
    assert.match(speech ?? '', /No puedo confirmar esa información/);
    assert.doesNotMatch(speech ?? '', /supuesto hecho/);
    assert.doesNotMatch(speech ?? '', /^Listo/);
  }
});

test('Janus anuncia el nivel PROBABLE en voz sin atribuirle certeza', () => {
  const speech = safeSpokenRunSummary(snapshot('completed'), [
    event(1, 'artifact.updated', { preview: 'Una fuente parcial informa una variación.', researchVerdict: 'PROBABLE' }),
  ]);
  assert.match(speech ?? '', /^La información es probable, pero no está completamente confirmada\./);
  assert.doesNotMatch(speech ?? '', /^Listo/);
});

test('un veredicto anterior no bloquea un artefacto posterior y no expone resultados privados', () => {
  const speech = safeSpokenRunSummary(snapshot('completed'), [
    event(1, 'artifact.updated', { preview: 'Dato antiguo no comprobado.', citationVerdict: 'RECHAZADO' }),
    event(2, 'artifact.updated', { preview: 'Consulta nueva con revisión.', citationVerdict: 'VERIFICADO',
      result: { token: 'SECRETO' } }),
  ]);
  assert.equal(speech, 'Listo. Consulta nueva con revisión.');
  assert.doesNotMatch(speech ?? '', /SECRETO/);
});
