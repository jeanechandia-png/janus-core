import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReusableWorkDashboard } from '../packages/core/src/work-dashboard-template.js';
import type { AuthorityPrincipal } from '../packages/core/src/authority.js';
import type { CoordinationBrief, CoordinationOperatorProfile } from '../packages/core/src/operator-coordination.js';

const principal: AuthorityPrincipal = { id: 'worker-1', role: 'operator', active: true };
const profile: CoordinationOperatorProfile = {
  principalId: 'worker-1', locale: 'nl', status: 'active',
  createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z',
};
const coordination: CoordinationBrief = {
  principalId: 'worker-1', scopes: [], operators: [profile],
  assignments: [{
    assignment: {
      id: 't1', title: 'API', goal: 'Write tests', assigneePrincipalId: 'worker-1',
      scopeIds: [], status: 'active', priority: 'normal', createdBy: 'founder',
      createdAt: profile.createdAt, updatedAt: profile.updatedAt, nextActions: [],
    },
  }, {
    assignment: {
      id: 't2', title: 'Another task', goal: 'Private work', assigneePrincipalId: 'worker-2',
      scopeIds: [], status: 'active', priority: 'normal', createdBy: 'founder',
      createdAt: profile.createdAt, updatedAt: profile.updatedAt, nextActions: [],
    },
  }],
};

test('work dashboard is a reusable text-only template with localised labels and no other worker tasks', () => {
  const dashboard = buildReusableWorkDashboard({
    principal, profile, coordination,
    projects: [{ id: 'p1', name: 'API', status: 'active', createdBy: 'founder',
      createdAt: profile.createdAt, updatedAt: profile.updatedAt }],
  });
  assert.equal(dashboard.locale, 'nl');
  assert.equal(dashboard.labels.title, 'Werkdashboard');
  assert.equal(dashboard.capabilities.voice, false);
  assert.equal(dashboard.capabilities.approvePayments, false);
  assert.deepEqual(dashboard.assignments.map(x => x.assignment.id), ['t1']);
  assert.deepEqual(dashboard.projects.map(x => x.id), ['p1']);
});

test('invalid profile and founder identity cannot impersonate a collaborator', () => {
  assert.throws(() => buildReusableWorkDashboard({
    principal: { ...principal, role: 'founder_director' }, profile, coordination, projects: [],
  }), /access denied/);
  assert.throws(() => buildReusableWorkDashboard({
    principal, profile: { ...profile, principalId: 'worker-2' }, coordination, projects: [],
  }), /profile mismatch/);
});
