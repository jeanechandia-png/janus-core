import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { createCoordinationHandoff } from '../packages/core/src/operator-coordination.js';

test('SQLite persists coordination profiles, scoped grants, assignments and handoffs', () => {
  const store = new SqliteStore(':memory:');
  store.upsertCoordinationOperator({
    principalId: 'julio',
    displayName: 'Julio',
    status: 'active',
    createdAt: '2026-09-30T19:00:00.000Z',
    updatedAt: '2026-09-30T19:00:00.000Z',
  });
  store.upsertCoordinationScope({
    id: 'scope-shared',
    label: 'Shared workspace',
    classification: 'shared',
    ownerPrincipalId: 'founder',
    createdAt: '2026-09-30T19:00:00.000Z',
  });
  store.upsertCoordinationGrant({
    id: 'grant-1',
    principalId: 'julio',
    scopeId: 'scope-shared',
    permissions: ['read_context', 'write_work', 'handoff'],
    grantedBy: 'founder',
    createdAt: '2026-09-30T19:01:00.000Z',
  });
  store.upsertCoordinationAssignment({
    id: 'assignment-1',
    title: 'Continue implementation',
    goal: 'Continue from current verified state',
    assigneePrincipalId: 'julio',
    scopeIds: ['scope-shared'],
    status: 'active',
    priority: 'high',
    createdBy: 'founder',
    createdAt: '2026-09-30T19:02:00.000Z',
    updatedAt: '2026-09-30T19:02:00.000Z',
    nextActions: ['Run CI'],
    lastRunId: 'run-1',
  });
  const handoff = createCoordinationHandoff({
    assignmentId: 'assignment-1',
    fromPrincipalId: 'julio',
    runId: 'run-1',
    createdAt: '2026-09-30T20:00:00.000Z',
    executiveSummary: 'Implementation continued successfully.',
    conclusions: ['Scope isolation remains active.'],
    completed: ['Implementation'],
    pending: ['Run CI'],
    blockers: [],
    nextActions: ['Run CI'],
    decisions: ['Keep least privilege'],
    evidenceRefs: ['run:run-1'],
  });
  store.appendCoordinationHandoff(handoff);
  store.appendCoordinationHandoff(handoff);

  assert.equal(store.getCoordinationOperator('julio')?.displayName, 'Julio');
  assert.equal(store.listCoordinationScopes().length, 1);
  assert.equal(store.listCoordinationGrants().length, 1);
  assert.equal(store.getCoordinationAssignment('assignment-1')?.lastRunId, 'run-1');
  assert.equal(store.listCoordinationHandoffs('assignment-1').length, 1);
  assert.equal(store.listCoordinationHandoffs('assignment-1')[0]?.checksum, handoff.checksum);

  store.close();
});
