import { createHash } from 'node:crypto';

export type BiometricModality = 'face' | 'voice';
export type PresenceFactor = 'trusted_device' | 'face_match' | 'liveness' | 'pin' | 'recovery_key' | 'voice_match';
export type AssuranceLevel = 'none' | 'basic' | 'strong' | 'root';

export interface BiometricTemplateRef {
  principalId: string;
  modality: BiometricModality;
  secureStoreRef: string;
  modelId: string;
  modelVersion: string;
  enrolledAt: string;
  revokedAt?: string;
}

export interface PresenceEvidence {
  factor: PresenceFactor;
  verified: boolean;
  score?: number;
  observedAt: string;
  deviceId?: string;
  evidenceRef?: string;
}

export interface PresenceChallenge {
  id: string;
  principalId: string;
  action: string;
  issuedAt: string;
  expiresAt: string;
  nonceHash: string;
}

export interface PresencePolicy {
  sessionTtlMs: number;
  minimumFaceScore: number;
  minimumLivenessScore: number;
  strongFactors: PresenceFactor[];
  rootAdditionalFactors: PresenceFactor[];
}

export interface PresenceSession {
  id: string;
  principalId: string;
  assurance: AssuranceLevel;
  factors: PresenceFactor[];
  issuedAt: string;
  expiresAt: string;
  deviceId?: string;
  auditHash: string;
}

export const DEFAULT_PRESENCE_POLICY: PresencePolicy = {
  sessionTtlMs: 15 * 60 * 1000,
  minimumFaceScore: 0.8,
  minimumLivenessScore: 0.8,
  strongFactors: ['trusted_device', 'face_match', 'liveness'],
  rootAdditionalFactors: ['pin'],
};

export function validateBiometricTemplateRef(ref: BiometricTemplateRef): void {
  if (!ref.principalId.trim()) throw new Error('principalId is required');
  if (!ref.secureStoreRef.trim()) throw new Error('secureStoreRef is required');
  if (!/^(keychain|secure-store|tpm|secure-enclave):/i.test(ref.secureStoreRef)) {
    throw new Error('Biometric templates must be referenced from secure storage');
  }
  if (!ref.modelId.trim() || !ref.modelVersion.trim()) throw new Error('Biometric model identity is required');
}

export function createPresenceChallenge(input: {
  id: string;
  principalId: string;
  action: string;
  nonce: string;
  issuedAt?: string;
  ttlMs?: number;
}): PresenceChallenge {
  if (!input.nonce.trim()) throw new Error('Presence challenge nonce is required');
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const expiresAt = new Date(Date.parse(issuedAt) + (input.ttlMs ?? 60_000)).toISOString();
  return {
    id: input.id,
    principalId: input.principalId,
    action: input.action,
    issuedAt,
    expiresAt,
    nonceHash: createHash('sha256').update(input.nonce).digest('hex'),
  };
}

export function verifyPresence(input: {
  sessionId: string;
  principalId: string;
  evidence: PresenceEvidence[];
  now?: string;
  requireRoot?: boolean;
  policy?: PresencePolicy;
}): PresenceSession {
  const policy = input.policy ?? DEFAULT_PRESENCE_POLICY;
  const now = input.now ?? new Date().toISOString();
  const verified = input.evidence.filter((item) => item.verified && item.observedAt <= now);
  const factors = [...new Set(verified.map((item) => item.factor))];

  const face = verified.find((item) => item.factor === 'face_match');
  const liveness = verified.find((item) => item.factor === 'liveness');
  if (face && (face.score ?? 0) < policy.minimumFaceScore) removeFactor(factors, 'face_match');
  if (liveness && (liveness.score ?? 0) < policy.minimumLivenessScore) removeFactor(factors, 'liveness');

  const hasStrong = policy.strongFactors.every((factor) => factors.includes(factor));
  const hasRoot = hasStrong && policy.rootAdditionalFactors.every((factor) => factors.includes(factor));
  const assurance: AssuranceLevel = hasRoot ? 'root' : hasStrong ? 'strong' : factors.length > 0 ? 'basic' : 'none';

  if (input.requireRoot && assurance !== 'root') throw new Error('Root assurance requires biometric presence plus an additional factor');

  const issuedAt = now;
  const expiresAt = new Date(Date.parse(issuedAt) + policy.sessionTtlMs).toISOString();
  const deviceId = verified.find((item) => item.factor === 'trusted_device')?.deviceId;

  const base = {
    id: input.sessionId,
    principalId: input.principalId,
    assurance,
    factors,
    issuedAt,
    expiresAt,
    deviceId,
  };
  return { ...base, auditHash: createHash('sha256').update(stableJson(base)).digest('hex') };
}

export function isPresenceSessionValid(session: PresenceSession, now = new Date().toISOString()): boolean {
  return session.assurance !== 'none' && Date.parse(now) < Date.parse(session.expiresAt);
}

function removeFactor(factors: PresenceFactor[], factor: PresenceFactor): void {
  const index = factors.indexOf(factor);
  if (index >= 0) factors.splice(index, 1);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
