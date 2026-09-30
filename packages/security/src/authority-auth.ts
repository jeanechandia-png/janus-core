import {
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  verify,
} from 'node:crypto';
import type {
  AuthorityPrincipal,
  AuthorityPublicCredential,
} from '../../core/src/authority.js';

export interface AuthorityCredentialStore {
  get(principalId: string): AuthorityPublicCredential | null;
  list(activeOnly?: boolean): AuthorityPublicCredential[];
  upsert(credential: AuthorityPublicCredential): void;
  revoke(principalId: string, revokedAt: string): boolean;
}

export interface AuthorityChallenge {
  id: string;
  principalId: string;
  nonce: string;
  signingPayload: string;
  expiresAt: string;
}

export interface AuthoritySession {
  token: string;
  expiresAt: string;
  principal: AuthorityPrincipal;
}

export interface DelegateAdministratorInput {
  principalId: string;
  publicKeyPem: string;
  displayName?: string;
}

export interface LocalAuthorityAuthOptions {
  challengeTtlMs?: number;
  sessionTtlMs?: number;
  founderPrincipalId?: string;
  now?: () => Date;
}

export type AuthorityAuthenticationErrorCode =
  | 'credential_unavailable'
  | 'invalid_challenge'
  | 'challenge_expired'
  | 'invalid_signature'
  | 'invalid_session'
  | 'founder_required'
  | 'invalid_principal'
  | 'invalid_public_key'
  | 'founder_credential_mismatch'
  | 'administrator_required';

export class AuthorityAuthenticationError extends Error {
  readonly code: AuthorityAuthenticationErrorCode;

  constructor(code: AuthorityAuthenticationErrorCode, message: string) {
    super(message);
    this.name = 'AuthorityAuthenticationError';
    this.code = code;
  }
}

interface ChallengeRecord extends AuthorityChallenge {}

interface SessionRecord {
  principalId: string;
  expiresAt: string;
}

const DEFAULT_CHALLENGE_TTL_MS = 2 * 60_000;
const DEFAULT_SESSION_TTL_MS = 15 * 60_000;
const PRINCIPAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

export class LocalAuthorityAuthService {
  private readonly store: AuthorityCredentialStore;
  private readonly challengeTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly founderPrincipalId: string;
  private readonly now: () => Date;
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(store: AuthorityCredentialStore, options: LocalAuthorityAuthOptions = {}) {
    this.store = store;
    this.challengeTtlMs = positiveTtl(options.challengeTtlMs, DEFAULT_CHALLENGE_TTL_MS);
    this.sessionTtlMs = positiveTtl(options.sessionTtlMs, DEFAULT_SESSION_TTL_MS);
    this.founderPrincipalId = options.founderPrincipalId?.trim() || 'founder';
    this.now = options.now ?? (() => new Date());
  }

  ensureFounderCredential(publicKeyPem: string, displayName?: string): AuthorityPublicCredential {
    const normalizedPublicKey = normalizeP256PublicKey(publicKeyPem);
    const existing = this.store.get(this.founderPrincipalId);

    if (existing) {
      if (
        existing.principal.role !== 'founder_director'
        || !existing.principal.active
        || existing.revokedAt
        || normalizeP256PublicKey(existing.publicKeyPem) !== normalizedPublicKey
      ) {
        throw new AuthorityAuthenticationError(
          'founder_credential_mismatch',
          'Configured founder credential does not match the enrolled founder credential',
        );
      }
      return existing;
    }

    const credential: AuthorityPublicCredential = {
      principal: {
        id: this.founderPrincipalId,
        role: 'founder_director',
        active: true,
        ...(displayName?.trim() ? { displayName: clipDisplayName(displayName) } : {}),
      },
      algorithm: 'ecdsa-p256-sha256',
      publicKeyPem: normalizedPublicKey,
      createdAt: this.now().toISOString(),
    };
    this.store.upsert(credential);
    return credential;
  }

  issueChallenge(principalId: string): AuthorityChallenge {
    this.prune();
    assertPrincipalId(principalId);
    const credential = this.activeCredential(principalId);
    if (!credential) {
      throw new AuthorityAuthenticationError(
        'credential_unavailable',
        'Active authority credential is unavailable',
      );
    }

    const id = `auth_ch_${randomUUID()}`;
    const nonce = randomBytes(32).toString('base64url');
    const expiresAt = new Date(this.now().getTime() + this.challengeTtlMs).toISOString();
    const signingPayload = [
      'janus-authority-auth-v1',
      id,
      principalId,
      nonce,
      expiresAt,
    ].join('\n');

    const challenge: AuthorityChallenge = {
      id,
      principalId,
      nonce,
      signingPayload,
      expiresAt,
    };
    this.challenges.set(id, challenge);
    return challenge;
  }

  verifyChallenge(input: {
    challengeId: string;
    principalId: string;
    signature: string;
  }): AuthoritySession {
    this.prune();
    const challenge = this.challenges.get(input.challengeId);
    this.challenges.delete(input.challengeId);

    if (!challenge || challenge.principalId !== input.principalId) {
      throw new AuthorityAuthenticationError('invalid_challenge', 'Challenge is invalid or already used');
    }
    if (Date.parse(challenge.expiresAt) <= this.now().getTime()) {
      throw new AuthorityAuthenticationError('challenge_expired', 'Challenge expired');
    }

    const credential = this.activeCredential(input.principalId);
    if (!credential) {
      throw new AuthorityAuthenticationError(
        'credential_unavailable',
        'Active authority credential is unavailable',
      );
    }

    let signature: Buffer;
    try {
      signature = Buffer.from(input.signature, 'base64url');
    } catch {
      throw new AuthorityAuthenticationError('invalid_signature', 'Signature is invalid');
    }
    if (signature.length === 0 || signature.length > 512) {
      throw new AuthorityAuthenticationError('invalid_signature', 'Signature is invalid');
    }

    const valid = verify(
      'sha256',
      Buffer.from(challenge.signingPayload, 'utf8'),
      createPublicKey(credential.publicKeyPem),
      signature,
    );
    if (!valid) {
      throw new AuthorityAuthenticationError('invalid_signature', 'Signature verification failed');
    }

    const token = `janus_auth_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(this.now().getTime() + this.sessionTtlMs).toISOString();
    this.sessions.set(hashToken(token), {
      principalId: credential.principal.id,
      expiresAt,
    });
    return {
      token,
      expiresAt,
      principal: { ...credential.principal },
    };
  }

  authenticateSession(token: string): AuthorityPrincipal | undefined {
    this.prune();
    if (!token.trim()) return undefined;
    const session = this.sessions.get(hashToken(token));
    if (!session) return undefined;

    const credential = this.activeCredential(session.principalId);
    if (!credential) {
      this.sessions.delete(hashToken(token));
      return undefined;
    }
    return { ...credential.principal };
  }

  revokeSession(token: string): void {
    if (!token.trim()) return;
    this.sessions.delete(hashToken(token));
  }

  delegateAdministrator(
    founderSessionToken: string,
    input: DelegateAdministratorInput,
  ): AuthorityPublicCredential {
    const founder = this.requireFounder(founderSessionToken);
    assertPrincipalId(input.principalId);
    if (input.principalId === this.founderPrincipalId) {
      throw new AuthorityAuthenticationError(
        'invalid_principal',
        'Founder credential cannot be replaced through administrator delegation',
      );
    }

    const publicKeyPem = normalizeP256PublicKey(input.publicKeyPem);
    const credential: AuthorityPublicCredential = {
      principal: {
        id: input.principalId,
        role: 'administrator',
        active: true,
        ...(input.displayName?.trim() ? { displayName: clipDisplayName(input.displayName) } : {}),
      },
      algorithm: 'ecdsa-p256-sha256',
      publicKeyPem,
      createdAt: this.now().toISOString(),
      delegatedBy: founder.id,
    };
    this.store.upsert(credential);
    return credential;
  }

  revokeAdministrator(founderSessionToken: string, principalId: string): AuthorityPublicCredential {
    this.requireFounder(founderSessionToken);
    if (principalId === this.founderPrincipalId) {
      throw new AuthorityAuthenticationError(
        'invalid_principal',
        'Founder credential cannot be revoked through administrator delegation',
      );
    }

    const credential = this.store.get(principalId);
    if (!credential || credential.principal.role !== 'administrator') {
      throw new AuthorityAuthenticationError(
        'administrator_required',
        'Active administrator credential is required',
      );
    }

    const revokedAt = this.now().toISOString();
    if (!this.store.revoke(principalId, revokedAt)) {
      throw new AuthorityAuthenticationError(
        'administrator_required',
        'Active administrator credential is required',
      );
    }
    this.revokePrincipalSessions(principalId);

    const revoked = this.store.get(principalId);
    if (!revoked) throw new Error('Revoked administrator record disappeared');
    return revoked;
  }

  status(): {
    founderConfigured: boolean;
    activeAdministrators: number;
    activeSessions: number;
  } {
    this.prune();
    const founder = this.activeCredential(this.founderPrincipalId);
    return {
      founderConfigured: Boolean(founder && founder.principal.role === 'founder_director'),
      activeAdministrators: this.store
        .list(true)
        .filter((credential) => credential.principal.role === 'administrator')
        .length,
      activeSessions: this.sessions.size,
    };
  }

  private requireFounder(token: string): AuthorityPrincipal {
    const principal = this.authenticateSession(token);
    if (
      !principal
      || principal.id !== this.founderPrincipalId
      || principal.role !== 'founder_director'
      || !principal.active
    ) {
      throw new AuthorityAuthenticationError(
        'founder_required',
        'Authenticated Founder/Director session is required',
      );
    }
    return principal;
  }

  private activeCredential(principalId: string): AuthorityPublicCredential | null {
    const credential = this.store.get(principalId);
    if (
      !credential
      || !credential.principal.active
      || credential.revokedAt
      || credential.algorithm !== 'ecdsa-p256-sha256'
    ) return null;
    return credential;
  }

  private revokePrincipalSessions(principalId: string): void {
    for (const [tokenHash, session] of this.sessions) {
      if (session.principalId === principalId) this.sessions.delete(tokenHash);
    }
  }

  private prune(): void {
    const now = this.now().getTime();
    for (const [id, challenge] of this.challenges) {
      if (Date.parse(challenge.expiresAt) <= now) this.challenges.delete(id);
    }
    for (const [tokenHash, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= now) this.sessions.delete(tokenHash);
    }
  }
}

function normalizeP256PublicKey(publicKeyPem: string): string {
  if (!publicKeyPem.trim() || publicKeyPem.length > 8192) {
    throw new AuthorityAuthenticationError('invalid_public_key', 'Public key is invalid');
  }
  try {
    const key = createPublicKey(publicKeyPem);
    const curve = key.asymmetricKeyDetails?.namedCurve;
    if (
      key.asymmetricKeyType !== 'ec'
      || (curve !== 'prime256v1' && curve !== 'secp256r1' && curve !== 'P-256')
    ) {
      throw new Error('not-p256');
    }
    return String(key.export({ type: 'spki', format: 'pem' })).trim() + '\n';
  } catch {
    throw new AuthorityAuthenticationError(
      'invalid_public_key',
      'Expected an ECDSA P-256 SPKI public key',
    );
  }
}

function assertPrincipalId(principalId: string): void {
  if (!PRINCIPAL_ID.test(principalId)) {
    throw new AuthorityAuthenticationError(
      'invalid_principal',
      'Principal id must be 1-80 safe identifier characters',
    );
  }
}

function clipDisplayName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) {
    throw new AuthorityAuthenticationError('invalid_principal', 'Display name is invalid');
  }
  return trimmed;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function positiveTtl(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}
