import { createHash } from 'node:crypto';

export type AuthorityRole = 'founder_director' | 'administrator' | 'operator' | 'agent' | 'external_data';
export type AuthoritySource = 'authenticated_human' | 'local_system' | 'tool' | 'model' | 'document' | 'web' | 'message';

export interface AuthorityPrincipal {
  id: string;
  role: AuthorityRole;
  displayName?: string;
  active: boolean;
}

export interface AuthorityInstruction {
  id: string;
  principalId: string;
  source: AuthoritySource;
  authenticated: boolean;
  instruction: string;
  requestedAt: string;
}

export interface AuthorityDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason: string;
  auditHash: string;
}

export interface AuthorityPolicy {
  founderPrincipalId: string;
  requireAuthentication: boolean;
  confirmationActions: string[];
}

export const DEFAULT_AUTHORITY_POLICY: AuthorityPolicy = {
  founderPrincipalId: 'founder',
  requireAuthentication: true,
  confirmationActions: ['delete_all', 'rotate_root_keys', 'disable_audit', 'transfer_authority'],
};

export function evaluateAuthority(
  principal: AuthorityPrincipal | undefined,
  request: AuthorityInstruction,
  action: string,
  policy: AuthorityPolicy = DEFAULT_AUTHORITY_POLICY,
): AuthorityDecision {
  let allowed = true;
  let requiresConfirmation = false;
  let reason = 'authorized';

  if (!principal || !principal.active || principal.id !== request.principalId) {
    allowed = false;
    reason = 'unknown_or_inactive_principal';
  } else if (policy.requireAuthentication && !request.authenticated) {
    allowed = false;
    reason = 'authentication_required';
  } else if (request.source !== 'authenticated_human' && request.source !== 'local_system') {
    allowed = false;
    reason = 'untrusted_source_cannot_issue_privileged_instruction';
  } else if (principal.role === 'external_data' || principal.role === 'agent') {
    allowed = false;
    reason = 'role_cannot_issue_privileged_instruction';
  } else if (
    principal.id === policy.founderPrincipalId &&
    principal.role === 'founder_director' &&
    policy.confirmationActions.includes(action)
  ) {
    requiresConfirmation = true;
    reason = 'founder_authorized_but_explicit_confirmation_required';
  }

  return {
    allowed,
    requiresConfirmation,
    reason,
    auditHash: hashDecision({ principal, request, action, allowed, requiresConfirmation, reason }),
  };
}

export function isPrivilegedHumanAuthority(principal: AuthorityPrincipal | undefined): boolean {
  return Boolean(
    principal?.active &&
      (principal.role === 'founder_director' || principal.role === 'administrator'),
  );
}

function hashDecision(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
