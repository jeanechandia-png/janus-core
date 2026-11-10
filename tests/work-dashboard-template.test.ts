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

// ── 10-nov-2026 (Claude): contrato ampliado de la plantilla laboral ─────────────────────────────
import { sanitizeWorkProfilePatch, WORK_RESERVED_TO_CEO } from '../packages/core/src/work-dashboard-template.js';
import type { CoordinationHandoff } from '../packages/core/src/operator-coordination.js';
import type { ProjectContextCheckpoint } from '../packages/core/src/project-context.js';
import type { WorkSessionSummary } from '../packages/core/src/work-session.js';

const handoff = (id: string, assignmentId: string, from: string, createdAt: string): CoordinationHandoff => ({
  id, assignmentId, fromPrincipalId: from, createdAt, executiveSummary: `resumen ${id}`,
  conclusions: [], completed: ['a'], pending: [], blockers: [], nextActions: [], decisions: [], evidenceRefs: [], checksum: id,
});
const session = (principalId: string, state: WorkSessionSummary['state'], startedAt: string, activeSeconds: number): WorkSessionSummary => ({
  sessionId: `ws-${principalId}-${startedAt}`, principalId, state, startedAt, activeSeconds, pausedSeconds: 0, pauses: 0,
  progress: [], blockers: [], deliveries: [], lastEventAt: startedAt,
});

test('la misma plantilla sirve a cualquier persona: identidad, funciones e instrucciones son datos del perfil', () => {
  const dashboard = buildReusableWorkDashboard({
    principal,
    profile: { ...profile, displayName: 'Persona Uno', roleTitle: 'Comercial', functions: ['Demos', ' ', 'Seguimiento'], instructions: ' Sin promesas de precio. ' },
    coordination, projects: [], skinSource: 'iba-command-center', now: '2026-11-10T12:00:00Z',
  });
  assert.equal(dashboard.templateId, 'janus-work-v1');
  assert.equal(dashboard.skinSource, 'iba-command-center');
  assert.deepEqual(dashboard.profile, { displayName: 'Persona Uno', roleTitle: 'Comercial', functions: ['Demos', 'Seguimiento'], instructions: 'Sin promesas de precio.' });
  // Sin nombre visible se muestra el identificador, nunca el de otra persona.
  const anonymous = buildReusableWorkDashboard({ principal, profile, coordination, projects: [] });
  assert.equal(anonymous.profile.displayName, 'worker-1');
  assert.equal(anonymous.skinSource, 'founder-dashboard');
});

test('la plantilla nunca concede voz ni acciones reservadas al CEO, pase lo que pase en la entrada', () => {
  const dashboard = buildReusableWorkDashboard({ principal, profile, coordination, projects: [], uploadAttachments: true });
  assert.deepEqual(dashboard.capabilities, {
    text: true, voice: false, approvePayments: false, changePermissions: false,
    productionDeploy: false, editProjectInstructions: false, uploadAttachments: true,
  });
  assert.deepEqual([...dashboard.reservedToCeo], [...WORK_RESERVED_TO_CEO]);
  assert.ok(dashboard.reservedToCeo.includes('payments') && dashboard.reservedToCeo.includes('permissions'));
  assert.equal(buildReusableWorkDashboard({ principal, profile, coordination, projects: [] }).capabilities.uploadAttachments, false);
});

test('el proyecto expone instrucciones, punto de continuación y solo metadatos de archivos', () => {
  const checkpoint: ProjectContextCheckpoint = {
    id: 'cp1', projectId: 'p1', threadId: 't1', createdAt: '2026-11-10T08:00:00Z', summary: 's',
    activeInstructions: [], decisions: [{ subject: 'Auth', content: 'firma', at: '2026-11-09T08:00:00Z' }],
    unresolvedErrors: [{ subject: 'Prueba', content: 'intermitente', at: '2026-11-09T09:00:00Z' }],
    nextActions: ['paginar'], resumeFrom: { subject: 'Listado', content: 'falta el cursor', at: '2026-11-10T08:00:00Z' },
    evidenceRefs: [], checksum: 'cp1',
  } as unknown as ProjectContextCheckpoint;
  const dashboard = buildReusableWorkDashboard({
    principal, profile, coordination,
    projects: [{
      project: { id: 'p1', name: 'API', status: 'active', createdBy: 'founder', createdAt: profile.createdAt, updatedAt: profile.updatedAt, instructions: 'TypeScript estricto' },
      canWrite: true,
      threads: [{ id: 't1', projectId: 'p1', title: 'Hilo', status: 'active', createdAt: profile.createdAt, updatedAt: profile.updatedAt, createdBy: 'worker-1' }],
      resources: [{ id: 'r1', projectId: 'p1', name: 'spec.pdf', source: 'upload', sourceRef: 'att_secreto', createdAt: profile.createdAt, addedBy: 'founder', mimeType: 'application/pdf', checksum: 'abc' }],
      latestCheckpoint: checkpoint,
    }],
  });
  const [project] = dashboard.projects;
  assert.ok(project);
  assert.equal(project.instructions, 'TypeScript estricto');
  assert.equal(project.canWrite, true);
  assert.deepEqual(project.nextActions, ['paginar']);
  assert.equal(project.resumeFrom?.subject, 'Listado');
  assert.equal(project.decisions.length, 1);
  assert.equal(project.unresolvedErrors.length, 1);
  assert.equal(project.threads[0]?.id, 't1');
  // La referencia interna del binario y su huella no viajan a la interfaz.
  assert.deepEqual(Object.keys(project.resources[0]!).sort(), ['addedBy', 'createdAt', 'id', 'mimeType', 'name', 'source']);
  assert.doesNotMatch(JSON.stringify(dashboard), /att_secreto/);
});

test('entregas y sesiones: solo las propias, aunque el llamador pase las de todos', () => {
  const dashboard = buildReusableWorkDashboard({
    principal, profile, coordination, projects: [],
    handoffs: [
      handoff('h1', 't1', 'worker-1', '2026-11-09T10:00:00Z'),
      handoff('h2', 't1', 'worker-1', '2026-11-10T10:00:00Z'),
      handoff('h3', 't2', 'worker-2', '2026-11-10T11:00:00Z'),
      handoff('h4', 't2', 'worker-1', '2026-11-10T11:30:00Z'), // tarea ajena: no se muestra
    ],
    sessions: [
      session('worker-1', 'ended', '2026-11-10T07:00:00Z', 3600),
      session('worker-1', 'running', '2026-11-10T09:00:00Z', 1800),
      session('worker-1', 'ended', '2026-11-09T07:00:00Z', 7200),
      session('worker-2', 'running', '2026-11-10T09:00:00Z', 999),
    ],
    now: '2026-11-10T12:00:00Z',
  });
  assert.deepEqual(dashboard.deliveries.map((item) => item.id), ['h2', 'h1']);
  assert.equal(dashboard.sessions.open?.principalId, 'worker-1');
  assert.equal(dashboard.sessions.recent.length, 3);
  assert.equal(dashboard.sessions.todayActiveSeconds, 5400);
  assert.equal(dashboard.sessions.selfReported, true);
  assert.doesNotMatch(JSON.stringify(dashboard), /worker-2/);
});

test('perfil laboral: solo campos previstos, con límites; el parche no puede colar permisos', () => {
  assert.deepEqual(
    sanitizeWorkProfilePatch({ displayName: ' Ana ', roleTitle: 'Diseño', functions: ['a', ''], instructions: 'x', locale: 'nl', role: 'founder_director', status: 'active', principalId: 'otro' }),
    { displayName: 'Ana', roleTitle: 'Diseño', functions: ['a'], instructions: 'x', locale: 'nl' },
  );
  assert.throws(() => sanitizeWorkProfilePatch({ locale: 'tr' }), /locale/);
  assert.throws(() => sanitizeWorkProfilePatch({ displayName: '' }), /displayName/);
  assert.throws(() => sanitizeWorkProfilePatch({ instructions: 'x'.repeat(12001) }), /instructions/);
  assert.throws(() => sanitizeWorkProfilePatch({ functions: Array.from({ length: 13 }, () => 'f') }), /functions/);
});
