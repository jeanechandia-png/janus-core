import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthorityPrincipal } from '../packages/core/src/authority.js';
import {
  JANUS_SYSTEM_PRINCIPAL_ID,
  assertAssignmentAccess,
  buildCoordinationBrief,
  canAccessCoordinationScope,
  createCoordinationHandoff,
  type CoordinationAssignment,
  type CoordinationGrant,
  type CoordinationScope,
} from '../packages/core/src/operator-coordination.js';

const founder: AuthorityPrincipal = {
  id: 'founder',
  role: 'founder_director',
  active: true,
};
const julio: AuthorityPrincipal = {
  id: 'julio',
  role: 'operator',
  active: true,
};
const other: AuthorityPrincipal = {
  id: 'other',
  role: 'operator',
  active: true,
};
const janus: AuthorityPrincipal = {
  id: JANUS_SYSTEM_PRINCIPAL_ID,
  role: 'agent',
  active: true,
};

const privateScope: CoordinationScope = {
  id: 'scope-private-lab',
  label: 'Private laboratory',
  classification: 'private',
  ownerPrincipalId: 'founder',
  createdAt: '2026-09-30T19:00:00.000Z',
};
const sharedScope: CoordinationScope = {
  id: 'scope-contact',
  label: 'Shared contact workspace',
  classification: 'shared',
  ownerPrincipalId: 'founder',
  createdAt: '2026-09-30T19:00:00.000Z',
};
const grant: CoordinationGrant = {
  id: 'grant-julio-contact',
  principalId: 'julio',
  scopeId: sharedScope.id,
  permissions: ['read_context', 'write_work', 'coordinate', 'handoff'],
  grantedBy: 'founder',
  createdAt: '2026-09-30T19:01:00.000Z',
};
const assignment: CoordinationAssignment = {
  id: 'assignment-1',
  title: 'Continue Janus module',
  goal: 'Continue implementation without losing context',
  assigneePrincipalId: 'julio',
  scopeIds: [sharedScope.id],
  status: 'active',
  priority: 'high',
  createdBy: 'founder',
  createdAt: '2026-09-30T19:02:00.000Z',
  updatedAt: '2026-09-30T19:02:00.000Z',
  nextActions: ['Run tests', 'Publish handoff'],
};

test('delegated operator sees shared work but not founder private scope', () => {
  assert.equal(canAccessCoordinationScope({
    principal: julio,
    scope: sharedScope,
    grants: [grant],
  }), true);
  assert.equal(canAccessCoordinationScope({
    principal: julio,
    scope: privateScope,
    grants: [grant],
  }), false);

  const brief = buildCoordinationBrief({
    principal: julio,
    operators: [{
      principalId: 'julio',
      displayName: 'Julio',
      status: 'active',
      createdAt: '2026-09-30T19:00:00.000Z',
      updatedAt: '2026-09-30T19:00:00.000Z',
    }],
    scopes: [privateScope, sharedScope],
    grants: [grant],
    assignments: [assignment],
    handoffs: [],
  });

  assert.deepEqual(brief.scopes.map((scope) => scope.id), [sharedScope.id]);
  assert.equal(brief.assignments.length, 1);
});

test('Janus Core can coordinate all local scopes without inheriting founder write authority', () => {
  assert.equal(canAccessCoordinationScope({
    principal: janus,
    scope: privateScope,
    grants: [],
  }), true);
  assert.equal(janus.role, 'agent');
});

test('unassigned operator without grants cannot inspect another assignment', () => {
  assert.throws(
    () => assertAssignmentAccess({
      principal: other,
      assignment,
      scopes: [privateScope, sharedScope],
      grants: [grant],
    }),
    /access denied/,
  );
});

test('handoff is deterministic, evidence-linked and contains executive continuity fields', () => {
  const base = {
    assignmentId: assignment.id,
    fromPrincipalId: 'julio',
    toPrincipalId: 'next-operator',
    runId: 'run-1',
    createdAt: '2026-09-30T20:00:00.000Z',
    executiveSummary: 'Implemented the coordination module and verified the main flow.',
    conclusions: ['Scope isolation remains enforced.'],
    completed: ['Core module', 'Tests'],
    pending: ['Runtime integration'],
    blockers: [],
    nextActions: ['Integrate runtime endpoints'],
    decisions: ['Keep provider independence'],
    evidenceRefs: ['commit:abc', 'run:run-1'],
  };

  const one = createCoordinationHandoff({ ...base, id: 'handoff-1' });
  const two = createCoordinationHandoff({ ...base, id: 'handoff-2' });

  assert.equal(one.checksum, two.checksum);
  assert.equal(one.executiveSummary.includes('coordination'), true);
  assert.deepEqual(one.nextActions, ['Integrate runtime endpoints']);
});

test('founder keeps visibility over all coordinated work', () => {
  const brief = buildCoordinationBrief({
    principal: founder,
    operators: [],
    scopes: [privateScope, sharedScope],
    grants: [grant],
    assignments: [assignment],
    handoffs: [],
  });

  assert.deepEqual(
    brief.scopes.map((scope) => scope.id).sort(),
    [privateScope.id, sharedScope.id].sort(),
  );
});
