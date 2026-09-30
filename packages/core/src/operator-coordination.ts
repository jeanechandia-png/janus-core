import { createHash, randomUUID } from 'node:crypto';
import type { AuthorityPrincipal } from './authority.js';

export const JANUS_SYSTEM_PRINCIPAL_ID = 'janus-core';

export type CoordinationPermission =
  | 'read_context'
  | 'write_work'
  | 'coordinate'
  | 'handoff';

export type CoordinationScopeClassification =
  | 'private'
  | 'shared'
  | 'project'
  | 'system';

export type CoordinationAssignmentStatus =
  | 'queued'
  | 'active'
  | 'blocked'
  | 'handoff_required'
  | 'completed'
  | 'cancelled';

export interface CoordinationOperatorProfile {
  principalId: string;
  displayName?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface CoordinationScope {
  id: string;
  label: string;
  classification: CoordinationScopeClassification;
  ownerPrincipalId: string;
  createdAt: string;
  description?: string;
}

export interface CoordinationGrant {
  id: string;
  principalId: string;
  scopeId: string;
  permissions: CoordinationPermission[];
  grantedBy: string;
  createdAt: string;
  revokedAt?: string;
}

export interface CoordinationAssignment {
  id: string;
  title: string;
  goal: string;
  assigneePrincipalId: string;
  scopeIds: string[];
  status: CoordinationAssignmentStatus;
  priority: 'low' | 'normal' | 'high' | 'critical';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  nextActions: string[];
  lastRunId?: string;
  metadata?: Record<string, unknown>;
}

export interface CoordinationHandoff {
  id: string;
  assignmentId: string;
  fromPrincipalId: string;
  createdAt: string;
  executiveSummary: string;
  conclusions: string[];
  completed: string[];
  pending: string[];
  blockers: string[];
  nextActions: string[];
  decisions: string[];
  evidenceRefs: string[];
  checksum: string;
  toPrincipalId?: string;
  runId?: string;
}

export interface CoordinationBrief {
  principalId: string;
  scopes: CoordinationScope[];
  assignments: Array<{
    assignment: CoordinationAssignment;
    latestHandoff?: CoordinationHandoff;
  }>;
  operators: CoordinationOperatorProfile[];
}

export function canAccessCoordinationScope(input: {
  principal: AuthorityPrincipal;
  scope: CoordinationScope;
  grants: readonly CoordinationGrant[];
  permission?: CoordinationPermission;
}): boolean {
  const permission = input.permission ?? 'read_context';
  const principal = input.principal;

  // Janus Core may coordinate local state globally, but this does not grant it
  // human authority to impersonate the founder for privileged external writes.
  if (principal.id === JANUS_SYSTEM_PRINCIPAL_ID) return true;
  if (principal.role === 'founder_director') return true;
  if (input.scope.ownerPrincipalId === principal.id) return true;

  return input.grants.some((grant) => (
    !grant.revokedAt
    && grant.principalId === principal.id
    && grant.scopeId === input.scope.id
    && grant.permissions.includes(permission)
  ));
}

export function buildCoordinationBrief(input: {
  principal: AuthorityPrincipal;
  operators: readonly CoordinationOperatorProfile[];
  scopes: readonly CoordinationScope[];
  grants: readonly CoordinationGrant[];
  assignments: readonly CoordinationAssignment[];
  handoffs: readonly CoordinationHandoff[];
}): CoordinationBrief {
  const visibleScopes = input.scopes.filter((scope) => canAccessCoordinationScope({
    principal: input.principal,
    scope,
    grants: input.grants,
  }));
  const visibleScopeIds = new Set(visibleScopes.map((scope) => scope.id));

  const assignments = input.assignments
    .filter((assignment) => {
      if (
        input.principal.id === JANUS_SYSTEM_PRINCIPAL_ID
        || input.principal.role === 'founder_director'
        || assignment.assigneePrincipalId === input.principal.id
      ) return true;
      return assignment.scopeIds.length > 0
        && assignment.scopeIds.every((scopeId) => visibleScopeIds.has(scopeId));
    })
    .map((assignment) => {
      const latestHandoff = [...input.handoffs]
        .filter((handoff) => handoff.assignmentId === assignment.id)
        .sort((a, b) => compareIso(a.createdAt, b.createdAt))
        .at(-1);
      return {
        assignment: structuredClone(assignment),
        ...(latestHandoff ? { latestHandoff: structuredClone(latestHandoff) } : {}),
      };
    });

  const operatorIds = new Set(assignments.map((item) => item.assignment.assigneePrincipalId));
  if (input.principal.role === 'founder_director' || input.principal.id === JANUS_SYSTEM_PRINCIPAL_ID) {
    for (const operator of input.operators) operatorIds.add(operator.principalId);
  } else {
    operatorIds.add(input.principal.id);
  }

  return {
    principalId: input.principal.id,
    scopes: visibleScopes.map((scope) => structuredClone(scope)),
    assignments,
    operators: input.operators
      .filter((operator) => operatorIds.has(operator.principalId))
      .map((operator) => structuredClone(operator)),
  };
}

export function assertAssignmentAccess(input: {
  principal: AuthorityPrincipal;
  assignment: CoordinationAssignment;
  scopes: readonly CoordinationScope[];
  grants: readonly CoordinationGrant[];
  permission?: CoordinationPermission;
}): void {
  if (
    input.principal.id === JANUS_SYSTEM_PRINCIPAL_ID
    || input.principal.role === 'founder_director'
    || input.assignment.assigneePrincipalId === input.principal.id
  ) return;

  const byId = new Map(input.scopes.map((scope) => [scope.id, scope] as const));
  const permission = input.permission ?? 'read_context';
  const allowed = input.assignment.scopeIds.length > 0
    && input.assignment.scopeIds.every((scopeId) => {
      const scope = byId.get(scopeId);
      return Boolean(scope && canAccessCoordinationScope({
        principal: input.principal,
        scope,
        grants: input.grants,
        permission,
      }));
    });
  if (!allowed) throw new Error('coordination assignment access denied');
}

export function createCoordinationHandoff(input: Omit<CoordinationHandoff, 'id' | 'checksum'> & {
  id?: string;
}): CoordinationHandoff {
  const normalized = {
    ...input,
    id: input.id?.trim() || `handoff_${randomUUID()}`,
    executiveSummary: required(input.executiveSummary, 'executiveSummary'),
    conclusions: cleanList(input.conclusions),
    completed: cleanList(input.completed),
    pending: cleanList(input.pending),
    blockers: cleanList(input.blockers),
    nextActions: cleanList(input.nextActions),
    decisions: cleanList(input.decisions),
    evidenceRefs: cleanList(input.evidenceRefs),
  };
  if (!normalized.assignmentId.trim()) throw new Error('assignmentId is required');
  if (!normalized.fromPrincipalId.trim()) throw new Error('fromPrincipalId is required');
  if (!Number.isFinite(Date.parse(normalized.createdAt))) throw new Error('createdAt is invalid');

  const checksum = createHash('sha256')
    .update(stableJson({
      assignmentId: normalized.assignmentId,
      fromPrincipalId: normalized.fromPrincipalId,
      toPrincipalId: normalized.toPrincipalId ?? null,
      runId: normalized.runId ?? null,
      createdAt: normalized.createdAt,
      executiveSummary: normalized.executiveSummary,
      conclusions: normalized.conclusions,
      completed: normalized.completed,
      pending: normalized.pending,
      blockers: normalized.blockers,
      nextActions: normalized.nextActions,
      decisions: normalized.decisions,
      evidenceRefs: normalized.evidenceRefs,
    }))
    .digest('hex');

  return { ...normalized, checksum };
}

export function validateCoordinationScope(scope: CoordinationScope): CoordinationScope {
  if (!scope.id.trim()) throw new Error('scope id is required');
  if (!scope.label.trim()) throw new Error('scope label is required');
  if (!scope.ownerPrincipalId.trim()) throw new Error('scope owner is required');
  if (!Number.isFinite(Date.parse(scope.createdAt))) throw new Error('scope createdAt is invalid');
  return {
    ...scope,
    id: scope.id.trim(),
    label: scope.label.trim(),
    ownerPrincipalId: scope.ownerPrincipalId.trim(),
  };
}

export function validateCoordinationGrant(grant: CoordinationGrant): CoordinationGrant {
  if (!grant.id.trim()) throw new Error('grant id is required');
  if (!grant.principalId.trim()) throw new Error('grant principalId is required');
  if (!grant.scopeId.trim()) throw new Error('grant scopeId is required');
  if (!grant.grantedBy.trim()) throw new Error('grant grantedBy is required');
  if (!Number.isFinite(Date.parse(grant.createdAt))) throw new Error('grant createdAt is invalid');
  if (grant.revokedAt && !Number.isFinite(Date.parse(grant.revokedAt))) {
    throw new Error('grant revokedAt is invalid');
  }
  const permissions = [...new Set(grant.permissions)];
  if (permissions.length === 0) throw new Error('grant permissions are required');
  return { ...grant, permissions };
}

export function validateCoordinationAssignment(
  assignment: CoordinationAssignment,
): CoordinationAssignment {
  if (!assignment.id.trim()) throw new Error('assignment id is required');
  if (!assignment.title.trim()) throw new Error('assignment title is required');
  if (!assignment.goal.trim()) throw new Error('assignment goal is required');
  if (!assignment.assigneePrincipalId.trim()) throw new Error('assignment assignee is required');
  if (!assignment.createdBy.trim()) throw new Error('assignment createdBy is required');
  if (!Number.isFinite(Date.parse(assignment.createdAt))) throw new Error('assignment createdAt is invalid');
  if (!Number.isFinite(Date.parse(assignment.updatedAt))) throw new Error('assignment updatedAt is invalid');
  return {
    ...assignment,
    scopeIds: [...new Set(cleanList(assignment.scopeIds))],
    nextActions: cleanList(assignment.nextActions),
  };
}

function cleanList(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function required(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}

function compareIso(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
