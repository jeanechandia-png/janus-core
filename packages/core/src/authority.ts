import { createHash } from 'node:crypto';

export type AuthorityRole = 'founder_director' | 'administrator' | 'operator' | 'agent' | 'external_data';
export type AuthoritySource = 'authenticated_human' | 'local_system' | 'tool' | 'model' | 'document' | 'web' | 'message';

export interface AuthorityPrincipal {
  id: string;
  role: AuthorityRole;
  displayName?: string;
  active: boolean;
}

export type AuthorityCredentialAlgorithm = 'ecdsa-p256-sha256';

export interface AuthorityPublicCredential {
  principal: AuthorityPrincipal;
  algorithm: AuthorityCredentialAlgorithm;
  publicKeyPem: string;
  createdAt: string;
  delegatedBy?: string;
  revokedAt?: string;
}

export type AuthorityBiometricMethod = 'platform-face';

export interface AuthorityBiometricAttestation {
  principalId: string;
  action: string;
  method: AuthorityBiometricMethod;
  verifiedAt: string;
  expiresAt: string;
  keyId: string;
  proofHash: string;
}

export interface AuthorityInstruction {
  id: string;
  principalId: string;
  source: AuthoritySource;
  authenticated: boolean;
  instruction: string;
  requestedAt: string;
  biometricAttestation?: AuthorityBiometricAttestation;
}

export interface AuthorityDecision {
  allowed: boolean;
  requiresConfirmation: boolean;
  requiresBiometric: boolean;
  reason: string;
  auditHash: string;
}

export interface AuthorityPolicy {
  founderPrincipalId: string;
  requireAuthentication: boolean;
  confirmationActions: string[];
  founderOnlyActions?: string[];
  biometricActions?: string[];
  biometricFreshnessMs?: number;
}

export const DEFAULT_AUTHORITY_POLICY: AuthorityPolicy = {
  founderPrincipalId: 'founder',
  requireAuthentication: true,
  confirmationActions: ['delete_all', 'rotate_root_keys', 'disable_audit', 'transfer_authority'],
  founderOnlyActions: [
    'founder.private.*',
    'security.biometric.*',
    'security.authority.*',
    'security.secrets.*',
    'finance.credentials.*',
    'finance.sync.*',
    'finance.export_unredacted',
    'delete_all',
    'rotate_root_keys',
    'disable_audit',
    'transfer_authority',
  ],
  biometricActions: [
    'founder.private.*',
    'security.biometric.*',
    'security.authority.*',
    'security.secrets.*',
    'finance.credentials.*',
    'finance.sync.*',
    'finance.export_unredacted',
    'delete_all',
    'rotate_root_keys',
    'disable_audit',
    'transfer_authority',
  ],
  biometricFreshnessMs: 2 * 60_000,
};

export function actionRequiresFounderBiometric(
  action: string,
  policy: AuthorityPolicy = DEFAULT_AUTHORITY_POLICY,
): boolean {
  return matchesActionPattern(action, policy.biometricActions ?? []);
}

export function evaluateAuthority(
  principal: AuthorityPrincipal | undefined,
  request: AuthorityInstruction,
  action: string,
  policy: AuthorityPolicy = DEFAULT_AUTHORITY_POLICY,
): AuthorityDecision {
  let allowed = true;
  let requiresConfirmation = false;
  const requiresBiometric = actionRequiresFounderBiometric(action, policy);
  let reason = 'authorized';

  const founderOnly = requiresBiometric
    || matchesActionPattern(action, policy.founderOnlyActions ?? []);

  if (!principal || !principal.active || principal.id !== request.principalId) {
    allowed = false;
    reason = 'unknown_or_inactive_principal';
  } else if (policy.requireAuthentication && !request.authenticated) {
    allowed = false;
    reason = 'authentication_required';
  } else if (request.source !== 'authenticated_human' && request.source !== 'local_system') {
    allowed = false;
    reason = 'untrusted_source_cannot_issue_privileged_instruction';
  } else if (principal.role !== 'founder_director' && principal.role !== 'administrator') {
    allowed = false;
    reason = 'role_cannot_issue_privileged_instruction';
  } else if (
    founderOnly
    && (
      principal.id !== policy.founderPrincipalId
      || principal.role !== 'founder_director'
    )
  ) {
    allowed = false;
    reason = 'founder_required_for_action';
  } else if (requiresBiometric) {
    const biometric = validateBiometricAttestation(request, action, policy);
    if (!biometric.ok) {
      allowed = false;
      reason = biometric.reason;
    }
  }

  if (allowed && policy.confirmationActions.includes(action)) {
    if (
      principal?.id !== policy.founderPrincipalId
      || principal.role !== 'founder_director'
    ) {
      allowed = false;
      reason = 'founder_required_for_root_action';
    } else {
      requiresConfirmation = true;
      reason = 'founder_authorized_but_explicit_confirmation_required';
    }
  }

  return {
    allowed,
    requiresConfirmation,
    requiresBiometric,
    reason,
    auditHash: hashDecision({
      principal,
      request,
      action,
      allowed,
      requiresConfirmation,
      requiresBiometric,
      reason,
    }),
  };
}

export function isPrivilegedHumanAuthority(principal: AuthorityPrincipal | undefined): boolean {
  return Boolean(
    principal?.active &&
      (principal.role === 'founder_director' || principal.role === 'administrator'),
  );
}

function validateBiometricAttestation(
  request: AuthorityInstruction,
  action: string,
  policy: AuthorityPolicy,
): { ok: true } | { ok: false; reason: string } {
  const attestation = request.biometricAttestation;
  if (!attestation) return { ok: false, reason: 'founder_biometric_required' };
  if (
    attestation.principalId !== request.principalId
    || attestation.action !== action
    || attestation.method !== 'platform-face'
  ) {
    return { ok: false, reason: 'founder_biometric_scope_mismatch' };
  }
  if (!/^[a-f0-9]{64}$/i.test(attestation.proofHash)) {
    return { ok: false, reason: 'founder_biometric_attestation_invalid' };
  }
  if (!attestation.keyId.trim() || attestation.keyId.length > 160) {
    return { ok: false, reason: 'founder_biometric_attestation_invalid' };
  }

  const requestedAt = Date.parse(request.requestedAt);
  const verifiedAt = Date.parse(attestation.verifiedAt);
  const expiresAt = Date.parse(attestation.expiresAt);
  if (![requestedAt, verifiedAt, expiresAt].every(Number.isFinite)) {
    return { ok: false, reason: 'founder_biometric_attestation_invalid' };
  }

  const freshnessMs = positiveFreshness(policy.biometricFreshnessMs);
  if (
    verifiedAt > requestedAt + 5_000
    || requestedAt > expiresAt
    || expiresAt <= verifiedAt
    || expiresAt - verifiedAt > freshnessMs
  ) {
    return { ok: false, reason: 'founder_biometric_expired' };
  }
  return { ok: true };
}

function matchesActionPattern(action: string, patterns: readonly string[]): boolean {
  const normalized = action.trim();
  if (!normalized) return false;
  return patterns.some((rawPattern) => {
    const pattern = rawPattern.trim();
    if (!pattern) return false;
    if (!pattern.endsWith('*')) return normalized === pattern;
    return normalized.startsWith(pattern.slice(0, -1));
  });
}

function positiveFreshness(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 2 * 60_000;
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
