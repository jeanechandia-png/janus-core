import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify,
} from 'node:crypto';
import type {
  AuthorityBiometricAttestation,
  AuthorityBiometricMethod,
} from '../../core/src/authority.js';

export type BiometricKind = 'face' | 'fingerprint' | 'other';
export type BiometricKeyBinding = 'biometry-current-set' | 'user-verification';

export interface BiometricKeyRegistration {
  keyId: string;
  principalId: string;
  publicKeyPem: string;
  method: AuthorityBiometricMethod;
  biometry: BiometricKind;
  binding: BiometricKeyBinding;
  createdAt: string;
  active: boolean;
  revokedAt?: string;
}

export interface BiometricKeyStore {
  get(keyId: string): BiometricKeyRegistration | null;
  list(principalId?: string, activeOnly?: boolean): BiometricKeyRegistration[];
  upsert(registration: BiometricKeyRegistration): void;
  revoke(keyId: string, revokedAt: string): boolean;
}

export interface FounderBiometricChallenge {
  id: string;
  principalId: string;
  action: string;
  nonce: string;
  signingPayload: string;
  expiresAt: string;
}

export interface FounderBiometricProofTicket {
  proofId: string;
  principalId: string;
  action: string;
  method: AuthorityBiometricMethod;
  keyId: string;
  verifiedAt: string;
  expiresAt: string;
}

interface ProofRecord extends FounderBiometricProofTicket {
  proofHash: string;
}

export interface FounderBiometricServiceOptions {
  founderPrincipalId?: string;
  challengeTtlMs?: number;
  proofTtlMs?: number;
  requireFace?: boolean;
  now?: () => Date;
}

export type FounderBiometricErrorCode =
  | 'invalid_key'
  | 'key_unavailable'
  | 'face_required'
  | 'invalid_challenge'
  | 'challenge_expired'
  | 'invalid_signature'
  | 'invalid_action';

export class FounderBiometricError extends Error {
  readonly code: FounderBiometricErrorCode;

  constructor(code: FounderBiometricErrorCode, message: string) {
    super(message);
    this.name = 'FounderBiometricError';
    this.code = code;
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DEFAULT_CHALLENGE_TTL_MS = 90_000;
const DEFAULT_PROOF_TTL_MS = 2 * 60_000;

export class InMemoryBiometricKeyStore implements BiometricKeyStore {
  private readonly records = new Map<string, BiometricKeyRegistration>();

  get(keyId: string): BiometricKeyRegistration | null {
    const value = this.records.get(keyId);
    return value ? structuredClone(value) : null;
  }

  list(principalId?: string, activeOnly = false): BiometricKeyRegistration[] {
    return [...this.records.values()]
      .filter((value) => !principalId || value.principalId === principalId)
      .filter((value) => !activeOnly || (value.active && !value.revokedAt))
      .map((value) => structuredClone(value));
  }

  upsert(registration: BiometricKeyRegistration): void {
    this.records.set(registration.keyId, structuredClone(registration));
  }

  revoke(keyId: string, revokedAt: string): boolean {
    const current = this.records.get(keyId);
    if (!current || !current.active || current.revokedAt) return false;
    this.records.set(keyId, {
      ...current,
      active: false,
      revokedAt,
    });
    return true;
  }
}

/**
 * Verifies a short-lived, action-scoped signature made by a key whose use is
 * gated by platform Face ID / Secure Enclave policy. Janus never receives or
 * stores a face image or biometric template.
 */
export class FounderBiometricService {
  private readonly store: BiometricKeyStore;
  private readonly founderPrincipalId: string;
  private readonly challengeTtlMs: number;
  private readonly proofTtlMs: number;
  private readonly requireFace: boolean;
  private readonly now: () => Date;
  private readonly challenges = new Map<string, FounderBiometricChallenge>();
  private readonly proofs = new Map<string, ProofRecord>();

  constructor(store: BiometricKeyStore, options: FounderBiometricServiceOptions = {}) {
    this.store = store;
    this.founderPrincipalId = options.founderPrincipalId?.trim() || 'founder';
    this.challengeTtlMs = positiveTtl(options.challengeTtlMs, DEFAULT_CHALLENGE_TTL_MS);
    this.proofTtlMs = positiveTtl(options.proofTtlMs, DEFAULT_PROOF_TTL_MS);
    this.requireFace = options.requireFace ?? true;
    this.now = options.now ?? (() => new Date());
  }

  registerFaceKey(input: {
    keyId: string;
    principalId?: string;
    publicKeyPem: string;
    createdAt?: string;
    binding?: BiometricKeyBinding;
    biometry?: BiometricKind;
  }): BiometricKeyRegistration {
    const keyId = safeId(input.keyId, 'keyId');
    const principalId = safeId(
      input.principalId?.trim() || this.founderPrincipalId,
      'principalId',
    );
    if (principalId !== this.founderPrincipalId) {
      throw new FounderBiometricError(
        'invalid_key',
        'Founder biometric keys may only bind to the configured Founder/Director.',
      );
    }

    const biometry = input.biometry ?? 'face';
    const binding = input.binding ?? 'biometry-current-set';
    if (this.requireFace && biometry !== 'face') {
      throw new FounderBiometricError('face_required', 'Face biometric binding is required.');
    }
    if (binding !== 'biometry-current-set') {
      throw new FounderBiometricError(
        'invalid_key',
        'Founder face key must invalidate when the enrolled biometric set changes.',
      );
    }

    const registration: BiometricKeyRegistration = {
      keyId,
      principalId,
      publicKeyPem: normalizeP256PublicKey(input.publicKeyPem),
      method: 'platform-face',
      biometry,
      binding,
      createdAt: validIso(input.createdAt ?? this.now().toISOString(), 'createdAt'),
      active: true,
    };
    this.store.upsert(registration);
    return registration;
  }

  issueChallenge(action: string): FounderBiometricChallenge {
    this.prune();
    const normalizedAction = safeAction(action);
    if (this.store.list(this.founderPrincipalId, true).length === 0) {
      throw new FounderBiometricError(
        'key_unavailable',
        'No active Founder face-bound key is configured.',
      );
    }

    const id = `bio_ch_${randomUUID()}`;
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + this.challengeTtlMs).toISOString();
    const signingPayload = [
      'janus-founder-biometric-v1',
      id,
      this.founderPrincipalId,
      normalizedAction,
      nonce,
      expiresAt,
    ].join('\n');

    const challenge: FounderBiometricChallenge = {
      id,
      principalId: this.founderPrincipalId,
      action: normalizedAction,
      nonce,
      signingPayload,
      expiresAt,
    };
    this.challenges.set(id, challenge);
    return { ...challenge };
  }

  verifyAssertion(input: {
    challengeId: string;
    keyId: string;
    signature: string;
  }): FounderBiometricProofTicket {
    this.prune();
    const challenge = this.challenges.get(input.challengeId);
    this.challenges.delete(input.challengeId);

    if (!challenge) {
      throw new FounderBiometricError(
        'invalid_challenge',
        'Biometric challenge is invalid or already used.',
      );
    }
    if (Date.parse(challenge.expiresAt) <= this.now().getTime()) {
      throw new FounderBiometricError('challenge_expired', 'Biometric challenge expired.');
    }

    const key = this.store.get(input.keyId);
    if (
      !key
      || !key.active
      || key.revokedAt
      || key.principalId !== challenge.principalId
      || key.method !== 'platform-face'
      || (this.requireFace && key.biometry !== 'face')
    ) {
      throw new FounderBiometricError('key_unavailable', 'Active Founder face key is unavailable.');
    }

    let signature: Buffer;
    try {
      signature = Buffer.from(input.signature, 'base64url');
    } catch {
      throw new FounderBiometricError('invalid_signature', 'Biometric signature is invalid.');
    }
    if (signature.length === 0 || signature.length > 512) {
      throw new FounderBiometricError('invalid_signature', 'Biometric signature is invalid.');
    }

    const valid = verify(
      'sha256',
      Buffer.from(challenge.signingPayload, 'utf8'),
      createPublicKey(key.publicKeyPem),
      signature,
    );
    if (!valid) {
      throw new FounderBiometricError(
        'invalid_signature',
        'Face-gated signature verification failed.',
      );
    }

    const verifiedAt = this.now().toISOString();
    const expiresAt = new Date(this.now().getTime() + this.proofTtlMs).toISOString();
    const proofId = `bio_proof_${randomBytes(32).toString('base64url')}`;
    const proofHash = createHash('sha256').update(stableJson({
      proofId,
      challengeId: challenge.id,
      principalId: challenge.principalId,
      action: challenge.action,
      keyId: key.keyId,
      verifiedAt,
      expiresAt,
      signature: input.signature,
    })).digest('hex');

    const proof: ProofRecord = {
      proofId,
      principalId: challenge.principalId,
      action: challenge.action,
      method: 'platform-face',
      keyId: key.keyId,
      verifiedAt,
      expiresAt,
      proofHash,
    };
    this.proofs.set(proofId, proof);
    return publicTicket(proof);
  }

  consumeProof(input: {
    proofId: string;
    principalId: string;
    action: string;
    requestedAt: string;
  }): AuthorityBiometricAttestation | undefined {
    this.prune();
    const proof = this.proofs.get(input.proofId);
    if (!proof) return undefined;

    if (
      proof.principalId !== input.principalId
      || proof.action !== input.action
    ) {
      return undefined;
    }

    const requestedAt = Date.parse(input.requestedAt);
    if (
      !Number.isFinite(requestedAt)
      || requestedAt > Date.parse(proof.expiresAt)
      || requestedAt < Date.parse(proof.verifiedAt) - 5_000
    ) {
      this.proofs.delete(input.proofId);
      return undefined;
    }

    this.proofs.delete(input.proofId);
    return {
      principalId: proof.principalId,
      action: proof.action,
      method: proof.method,
      verifiedAt: proof.verifiedAt,
      expiresAt: proof.expiresAt,
      keyId: proof.keyId,
      proofHash: proof.proofHash,
    };
  }

  revokeKey(keyId: string): boolean {
    const revoked = this.store.revoke(keyId, this.now().toISOString());
    if (revoked) {
      for (const [proofId, proof] of this.proofs) {
        if (proof.keyId === keyId) this.proofs.delete(proofId);
      }
    }
    return revoked;
  }

  status(): {
    configured: boolean;
    activeFaceKeys: number;
    outstandingChallenges: number;
    outstandingProofs: number;
  } {
    this.prune();
    const activeFaceKeys = this.store
      .list(this.founderPrincipalId, true)
      .filter((item) => item.method === 'platform-face' && item.biometry === 'face')
      .length;
    return {
      configured: activeFaceKeys > 0,
      activeFaceKeys,
      outstandingChallenges: this.challenges.size,
      outstandingProofs: this.proofs.size,
    };
  }

  private prune(): void {
    const now = this.now().getTime();
    for (const [id, challenge] of this.challenges) {
      if (Date.parse(challenge.expiresAt) <= now) this.challenges.delete(id);
    }
    for (const [id, proof] of this.proofs) {
      if (Date.parse(proof.expiresAt) <= now) this.proofs.delete(id);
    }
  }
}

function normalizeP256PublicKey(value: string): string {
  if (!value.trim() || value.length > 8192) {
    throw new FounderBiometricError('invalid_key', 'Biometric public key is invalid.');
  }
  try {
    const key = createPublicKey(value);
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (
      key.asymmetricKeyType !== 'ec'
      || (curve !== 'prime256v1' && curve !== 'secp256r1' && curve !== 'P-256')
    ) {
      throw new Error('not-p256');
    }
    return String(key.export({ type: 'spki', format: 'pem' })).trim() + '\n';
  } catch {
    throw new FounderBiometricError(
      'invalid_key',
      'Expected an ECDSA P-256 SPKI public key.',
    );
  }
}

function safeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!SAFE_ID.test(normalized)) {
    throw new FounderBiometricError('invalid_key', `${label} is invalid.`);
  }
  return normalized;
}

function safeAction(value: string): string {
  const normalized = value.trim();
  if (
    !normalized
    || normalized.length > 160
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(normalized)
  ) {
    throw new FounderBiometricError('invalid_action', 'Biometric action is invalid.');
  }
  return normalized;
}

function validIso(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new FounderBiometricError('invalid_key', `${label} is invalid.`);
  }
  return new Date(value).toISOString();
}

function positiveTtl(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function publicTicket(proof: ProofRecord): FounderBiometricProofTicket {
  return {
    proofId: proof.proofId,
    principalId: proof.principalId,
    action: proof.action,
    method: proof.method,
    keyId: proof.keyId,
    verifiedAt: proof.verifiedAt,
    expiresAt: proof.expiresAt,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
