import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCitationLedger, citationCoverage } from '../packages/core/src/citation-ledger.js';
import { assessDocumentCoverage, requireWholeDocumentCoverage } from '../packages/core/src/document-coverage.js';
import { buildImprovementIndex, improvementUpdates } from '../packages/core/src/improvement-index.js';
import { canFinalizeJob, jobProgress, nextRunnablePartitions } from '../packages/core/src/job-engine.js';
import { routeModel } from '../packages/orchestrator/src/model-router.js';
import { readyWorkNodes, validateWorkGraph } from '../packages/orchestrator/src/work-graph.js';

test('model router filters hard requirements before preferences', () => {
  const decision = routeModel([
    {
      id: 'local-fast', provider: 'local', capabilities: ['fast', 'local', 'structured_output'],
      contextWindow: 32_000, local: true, enabled: true, latencyClass: 'low',
    },
    {
      id: 'deep-remote', provider: 'replaceable', capabilities: ['reasoning', 'long_context', 'structured_output'],
      contextWindow: 200_000, local: false, enabled: true, latencyClass: 'high',
    },
  ], {
    requiredCapabilities: ['reasoning', 'long_context'],
    minimumContextWindow: 100_000,
    preferLocal: true,
  });

  assert.equal(decision.selected.id, 'deep-remote');
});

test('work graph exposes only dependency-ready analytical steps', () => {
  const graph = {
    goal: 'compare options with evidence',
    nodes: [
      { id: 'a', label: 'research', kind: 'research' as const, dependsOn: [], objective: 'collect evidence', expectedOutput: 'sources' },
      { id: 'b', label: 'analyze', kind: 'analysis' as const, dependsOn: ['a'], objective: 'compare', expectedOutput: 'matrix' },
      { id: 'c', label: 'synthesize', kind: 'synthesis' as const, dependsOn: ['b'], objective: 'answer', expectedOutput: 'cited response' },
    ],
  };
  assert.equal(validateWorkGraph(graph).ok, true);
  assert.deepEqual(readyWorkNodes(graph, new Set()).map((node) => node.id), ['a']);
  assert.deepEqual(readyWorkNodes(graph, new Set(['a'])).map((node) => node.id), ['b']);
});

test('whole-document gate refuses synthesis when any unit is missing', () => {
  const units = [
    { id: 'p1', ordinal: 1, text: 'one' },
    { id: 'p2', ordinal: 2, text: 'two' },
    { id: 'p3', ordinal: 3, text: 'three' },
  ];
  const coverage = assessDocumentCoverage(units, new Set(['p1', 'p3']));
  assert.equal(coverage.complete, false);
  assert.deepEqual(coverage.missingUnitIds, ['p2']);
  assert.throws(() => requireWholeDocumentCoverage(units, new Set(['p1', 'p3'])), /incomplete/);
  assert.doesNotThrow(() => requireWholeDocumentCoverage(units, new Set(['p1', 'p2', 'p3'])));
});

test('citation ledger detects unsupported or unknown provenance', () => {
  const valid = {
    sources: [{ id: 's1', sourceType: 'file' as const, title: 'Document' }],
    claims: [{ claim: 'Fact A', citations: [{ sourceId: 's1', locator: 'p.2' }] }],
  };
  assert.equal(validateCitationLedger(valid).ok, true);
  assert.equal(citationCoverage(valid), 1);

  const invalid = {
    sources: [{ id: 's1', sourceType: 'file' as const }],
    claims: [{ claim: 'Fact B', citations: [{ sourceId: 'missing' }] }],
  };
  assert.equal(validateCitationLedger(invalid).ok, false);
});

test('durable job partitions work beyond one context window', () => {
  const job = {
    id: 'j1', kind: 'document-analysis', status: 'running' as const,
    createdAt: '2026-09-16T00:00:00Z', updatedAt: '2026-09-16T00:00:00Z', maxConcurrency: 2,
    partitions: [
      { id: '1', order: 1, inputRef: 'doc:1', status: 'completed' as const, attempts: 1 },
      { id: '2', order: 2, inputRef: 'doc:2', status: 'queued' as const, attempts: 0 },
      { id: '3', order: 3, inputRef: 'doc:3', status: 'queued' as const, attempts: 0 },
    ],
  };
  assert.deepEqual(nextRunnablePartitions(job).map((partition) => partition.id), ['2', '3']);
  assert.equal(jobProgress(job).completed, 1);
  assert.equal(canFinalizeJob(job), false);
});

test('improvement index emits proactive updates only after meaningful evidence delta', () => {
  const previous = buildImprovementIndex([
    { id: 's1', dimension: 'execution', observedAt: '2026-09-15T10:00:00Z', source: 'verification', metric: 'task-success', value: 60 },
  ], '2026-09-15T10:00:00Z');
  const current = buildImprovementIndex([
    { id: 's1', dimension: 'execution', observedAt: '2026-09-15T10:00:00Z', source: 'verification', metric: 'task-success', value: 60 },
    { id: 's2', dimension: 'execution', observedAt: '2026-09-16T10:00:00Z', source: 'verification', metric: 'task-success', value: 90 },
  ], '2026-09-16T10:00:00Z');

  const updates = improvementUpdates(previous, current, 5);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.dimension, 'execution');
  assert.ok((updates[0]?.delta ?? 0) > 0);
});
