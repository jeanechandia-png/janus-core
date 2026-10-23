import { randomUUID } from 'node:crypto';
import type { ConsentInput, ConsentRecord, ConsentPurpose } from './types.js';

export const CONSENT_POLICY_VERSION = '2026-10-18';
export const ALLOWED_PURPOSES: readonly ConsentPurpose[] = Object.freeze(['personalization', 'context_routing'] as const);

/**
 * Validates and builds a consent record.
 * - An adult consents for themselves.
 * - A minor's face template requires a parent or legal guardian who is a different person.
 * - Purposes are limited (purpose limitation): personalisation and context routing only. Never authentication.
 */
export function createConsent(input: ConsentInput, now: Date = new Date()): ConsentRecord {
  const { subject, grantedBy } = input;
  if (!subject.id.trim() || !/^[A-Za-z0-9_.-]{1,64}$/.test(subject.id)) throw new Error('Consent subject id is invalid');
  if (!subject.displayName.trim()) throw new Error('Consent subject displayName is required');
  if (!grantedBy.id.trim() || !grantedBy.displayName.trim()) throw new Error('Consent grantor is required');
  if (input.statement.trim().length < 20) throw new Error('Consent statement is required (at least 20 characters) as evidence');
  if (input.purposes.length === 0 || !input.purposes.every((purpose) => ALLOWED_PURPOSES.includes(purpose))) {
    throw new Error('Consent purposes must be limited to personalization and/or context_routing');
  }
  const isMinor = subject.role === 'household_minor';
  if (isMinor) {
    if (grantedBy.relation !== 'parent' && grantedBy.relation !== 'legal_guardian') {
      throw new Error('A minor face template requires consent from a parent or legal guardian');
    }
    if (grantedBy.id === subject.id) throw new Error('A minor cannot grant consent for their own face template');
  } else if (grantedBy.relation !== 'self' || grantedBy.id !== subject.id) {
    throw new Error('An adult must grant consent for their own face template');
  }
  const grantedAt = input.grantedAt ?? now.toISOString();
  if (Number.isNaN(Date.parse(grantedAt))) throw new Error('Consent grantedAt must be an ISO timestamp');
  return {
    id: `consent_${randomUUID()}`,
    subjectId: subject.id,
    subjectIsMinor: isMinor,
    grantedBy: { ...grantedBy },
    purposes: [...new Set(input.purposes)],
    statement: input.statement.trim(),
    grantedAt,
    policyVersion: CONSENT_POLICY_VERSION,
  };
}

export function activeConsent(consents: readonly ConsentRecord[]): ConsentRecord | undefined {
  return [...consents].reverse().find((consent) => !consent.revokedAt);
}
