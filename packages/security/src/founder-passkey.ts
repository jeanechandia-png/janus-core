/**
 * Confirmación del Founder con la llave de acceso del navegador (passkey / WebAuthn con verificación del usuario).
 *
 * Segunda vía de confirmación, MÁS ESTRECHA que el puente nativo de Face ID (ADR-007): la política solo la acepta para
 * las acciones listadas en `passkeyActions` (hoy: dar acceso a colaboradores). El dispositivo puede verificar con Face ID
 * o con el código del teléfono: por eso NO sustituye al puente nativo en secretos, finanzas, borrados ni llaves.
 *
 * Sin dependencias: CBOR mínimo + verificación ES256 con node:crypto. Solo se acepta ES256 (P-256) y atestación «none».
 */
import { createHash, createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import type { AuthorityBiometricAttestation } from '../../core/src/authority.js';

export interface FounderPasskeyRecord {
  credentialId: string;
  principalId: string;
  publicKeyPem: string;
  rpId: string;
  signCount: number;
  createdAt: string;
  active: boolean;
  revokedAt?: string;
}

export interface FounderPasskeyStore {
  get(credentialId: string): FounderPasskeyRecord | null;
  list(activeOnly?: boolean): FounderPasskeyRecord[];
  upsert(record: FounderPasskeyRecord): void;
}

export type FounderPasskeyErrorCode =
  | 'passkey_unavailable'
  | 'invalid_challenge'
  | 'challenge_expired'
  | 'invalid_origin'
  | 'invalid_response'
  | 'user_verification_required'
  | 'invalid_signature'
  | 'invalid_action';

export class FounderPasskeyError extends Error {
  readonly code: FounderPasskeyErrorCode;
  constructor(code: FounderPasskeyErrorCode, message: string) {
    super(message);
    this.name = 'FounderPasskeyError';
    this.code = code;
  }
}

export const PASSKEY_METHOD = 'webauthn-uv' as const;

/* ── CBOR mínimo (solo lo que emite WebAuthn: enteros, bytes, texto, listas, mapas) ── */
type Cbor = number | Buffer | string | Cbor[] | Map<number | string, Cbor> | boolean | null;
function cborDecode(buffer: Buffer, start = 0, depth = 0): { value: Cbor; end: number } {
  if (depth > 8) throw new FounderPasskeyError('invalid_response', 'CBOR demasiado anidado');
  if (start >= buffer.length) throw new FounderPasskeyError('invalid_response', 'CBOR truncado');
  const head = buffer[start]!;
  const major = head >> 5;
  const info = head & 31;
  let offset = start + 1;
  let length = info;
  if (info === 24) { length = buffer.readUInt8(offset); offset += 1; }
  else if (info === 25) { length = buffer.readUInt16BE(offset); offset += 2; }
  else if (info === 26) { length = buffer.readUInt32BE(offset); offset += 4; }
  else if (info > 26) {
    if (major === 7 && info === 27) throw new FounderPasskeyError('invalid_response', 'CBOR no admitido');
    throw new FounderPasskeyError('invalid_response', 'CBOR no admitido');
  }
  switch (major) {
    case 0: return { value: length, end: offset };
    case 1: return { value: -1 - length, end: offset };
    case 2:
    case 3: {
      const end = offset + length;
      if (end > buffer.length) throw new FounderPasskeyError('invalid_response', 'CBOR truncado');
      const slice = buffer.subarray(offset, end);
      return { value: major === 2 ? Buffer.from(slice) : slice.toString('utf8'), end };
    }
    case 4: {
      if (length > 64) throw new FounderPasskeyError('invalid_response', 'CBOR demasiado grande');
      const list: Cbor[] = [];
      for (let i = 0; i < length; i += 1) { const item = cborDecode(buffer, offset, depth + 1); list.push(item.value); offset = item.end; }
      return { value: list, end: offset };
    }
    case 5: {
      if (length > 64) throw new FounderPasskeyError('invalid_response', 'CBOR demasiado grande');
      const map = new Map<number | string, Cbor>();
      for (let i = 0; i < length; i += 1) {
        const key = cborDecode(buffer, offset, depth + 1);
        if (typeof key.value !== 'number' && typeof key.value !== 'string') throw new FounderPasskeyError('invalid_response', 'Clave CBOR no admitida');
        const item = cborDecode(buffer, key.end, depth + 1);
        map.set(key.value, item.value); offset = item.end;
      }
      return { value: map, end: offset };
    }
    case 7:
      if (info === 20) return { value: false, end: offset };
      if (info === 21) return { value: true, end: offset };
      if (info === 22) return { value: null, end: offset };
      throw new FounderPasskeyError('invalid_response', 'CBOR no admitido');
    default:
      throw new FounderPasskeyError('invalid_response', 'CBOR no admitido');
  }
}

const b64u = (value: unknown, label: string, max = 4096): Buffer => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,8192}$/.test(value)) throw new FounderPasskeyError('invalid_response', `${label} no válido`);
  const buffer = Buffer.from(value, 'base64url');
  if (buffer.length === 0 || buffer.length > max) throw new FounderPasskeyError('invalid_response', `${label} no válido`);
  return buffer;
};
const sha256 = (data: Buffer | string): Buffer => createHash('sha256').update(data).digest();

interface AuthenticatorData { rpIdHash: Buffer; userPresent: boolean; userVerified: boolean; signCount: number; credentialId?: Buffer; coseKey?: Map<number | string, Cbor> }
function parseAuthenticatorData(data: Buffer): AuthenticatorData {
  if (data.length < 37) throw new FounderPasskeyError('invalid_response', 'Datos del autenticador truncados');
  const flags = data[32]!;
  const parsed: AuthenticatorData = {
    rpIdHash: data.subarray(0, 32),
    userPresent: (flags & 0x01) !== 0,
    userVerified: (flags & 0x04) !== 0,
    signCount: data.readUInt32BE(33),
  };
  if ((flags & 0x40) !== 0) {
    if (data.length < 55) throw new FounderPasskeyError('invalid_response', 'Credencial truncada');
    const idLength = data.readUInt16BE(53);
    const idEnd = 55 + idLength;
    if (idLength === 0 || idLength > 1023 || idEnd > data.length) throw new FounderPasskeyError('invalid_response', 'Credencial no válida');
    parsed.credentialId = Buffer.from(data.subarray(55, idEnd));
    const key = cborDecode(data, idEnd).value;
    if (!(key instanceof Map)) throw new FounderPasskeyError('invalid_response', 'Llave pública no válida');
    parsed.coseKey = key;
  }
  return parsed;
}

function coseEs256ToPem(key: Map<number | string, Cbor>): string {
  const x = key.get(-2), y = key.get(-3);
  if (key.get(1) !== 2 || key.get(3) !== -7 || key.get(-1) !== 1 || !Buffer.isBuffer(x) || !Buffer.isBuffer(y) || x.length !== 32 || y.length !== 32) {
    throw new FounderPasskeyError('invalid_response', 'Solo se admiten llaves ES256 (P-256).');
  }
  return createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: y.toString('base64url') }, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' }).toString();
}

function checkClientData(raw: Buffer, type: 'webauthn.create' | 'webauthn.get', expectedChallenge: string, origins: readonly string[]): string {
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw.toString('utf8')) as Record<string, unknown>; } catch { throw new FounderPasskeyError('invalid_response', 'clientDataJSON no válido'); }
  if (data.type !== type) throw new FounderPasskeyError('invalid_response', 'Tipo de operación incorrecto');
  if (data.challenge !== expectedChallenge) throw new FounderPasskeyError('invalid_challenge', 'El desafío no coincide');
  if (data.crossOrigin === true) throw new FounderPasskeyError('invalid_origin', 'Operación entre orígenes no permitida');
  if (typeof data.origin !== 'string' || !origins.includes(data.origin)) throw new FounderPasskeyError('invalid_origin', 'Origen no autorizado para la llave de acceso');
  return data.origin;
}

/** Normaliza la lista de orígenes permitidos. Fuera de localhost solo HTTPS. */
export function parsePasskeyOrigins(raw: string | undefined, localPort: number): string[] {
  const origins = new Set<string>([`http://localhost:${localPort}`]);
  for (const part of (raw ?? '').split(',')) {
    const text = part.trim();
    if (!text) continue;
    let url: URL;
    try { url = new URL(text); } catch { continue; }
    const local = url.hostname === 'localhost';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) continue;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || url.hostname.includes(':')) continue; // WebAuthn no admite IP como rpId
    origins.add(url.origin);
  }
  return [...origins];
}

interface PendingChallenge { challenge: string; kind: 'create' | 'get'; action?: string; expiresAt: number }
interface PasskeyProof extends AuthorityBiometricAttestation { proofId: string }

export interface FounderPasskeyOptions {
  founderPrincipalId?: string;
  origins: readonly string[];
  allowedActions: readonly string[];
  challengeTtlMs?: number;
  proofTtlMs?: number;
  now?: () => Date;
}

export class FounderPasskeyService {
  private readonly founderPrincipalId: string;
  private readonly origins: readonly string[];
  private readonly allowedActions: readonly string[];
  private readonly challengeTtlMs: number;
  private readonly proofTtlMs: number;
  private readonly now: () => Date;
  private readonly challenges = new Map<string, PendingChallenge>();
  private readonly proofs = new Map<string, PasskeyProof>();

  constructor(private readonly store: FounderPasskeyStore, options: FounderPasskeyOptions) {
    this.founderPrincipalId = options.founderPrincipalId ?? 'founder';
    this.origins = [...options.origins];
    this.allowedActions = [...options.allowedActions];
    this.challengeTtlMs = options.challengeTtlMs ?? 120_000;
    this.proofTtlMs = Math.min(options.proofTtlMs ?? 60_000, 120_000);
    this.now = options.now ?? (() => new Date());
  }

  status(): { activePasskeys: number; allowedActions: readonly string[]; origins: readonly string[] } {
    return { activePasskeys: this.store.list(true).length, allowedActions: this.allowedActions, origins: this.origins };
  }

  private rpIdFor(origin: string): string {
    if (!this.origins.includes(origin)) throw new FounderPasskeyError('invalid_origin', 'Origen no autorizado para la llave de acceso');
    return new URL(origin).hostname;
  }

  private issue(kind: 'create' | 'get', action?: string): { id: string; challenge: string; expiresAt: string } {
    this.prune();
    const id = `pk_ch_${randomUUID()}`;
    const challenge = randomBytes(32).toString('base64url');
    const expiresAt = this.now().getTime() + this.challengeTtlMs;
    this.challenges.set(id, { challenge, kind, expiresAt, ...(action ? { action } : {}) });
    return { id, challenge, expiresAt: new Date(expiresAt).toISOString() };
  }

  private take(id: unknown, kind: 'create' | 'get'): PendingChallenge {
    this.prune();
    const pending = typeof id === 'string' ? this.challenges.get(id) : undefined;
    if (typeof id === 'string') this.challenges.delete(id);
    if (!pending || pending.kind !== kind) throw new FounderPasskeyError('invalid_challenge', 'Desafío no válido o ya usado.');
    if (pending.expiresAt <= this.now().getTime()) throw new FounderPasskeyError('challenge_expired', 'El desafío caducó.');
    return pending;
  }

  /** Opciones para `navigator.credentials.create`. `origin` es el del navegador del Founder (validado contra la lista). */
  registrationOptions(origin: string, displayName = 'CEO'): Record<string, unknown> {
    const rpId = this.rpIdFor(origin);
    const issued = this.issue('create');
    return {
      challengeId: issued.id,
      expiresAt: issued.expiresAt,
      publicKey: {
        challenge: issued.challenge,
        rp: { id: rpId, name: 'JANUS' },
        user: { id: Buffer.from(`janus:${this.founderPrincipalId}`, 'utf8').toString('base64url'), name: this.founderPrincipalId, displayName },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
        attestation: 'none',
        timeout: this.challengeTtlMs,
        excludeCredentials: this.store.list(true).filter((item) => item.rpId === rpId).map((item) => ({ type: 'public-key', id: item.credentialId })),
      },
    };
  }

  verifyRegistration(input: { challengeId: unknown; clientDataJSON: unknown; attestationObject: unknown }): FounderPasskeyRecord {
    const pending = this.take(input.challengeId, 'create');
    const clientData = b64u(input.clientDataJSON, 'clientDataJSON');
    const origin = checkClientData(clientData, 'webauthn.create', pending.challenge, this.origins);
    const rpId = this.rpIdFor(origin);
    const attestation = cborDecode(b64u(input.attestationObject, 'attestationObject', 8192)).value;
    const authDataRaw = attestation instanceof Map ? attestation.get('authData') : undefined;
    if (!Buffer.isBuffer(authDataRaw)) throw new FounderPasskeyError('invalid_response', 'Atestación no válida');
    const authData = parseAuthenticatorData(authDataRaw);
    if (!authData.rpIdHash.equals(sha256(rpId))) throw new FounderPasskeyError('invalid_origin', 'La llave no pertenece a este JANUS');
    if (!authData.userPresent || !authData.userVerified) throw new FounderPasskeyError('user_verification_required', 'Hace falta verificar al usuario (Face ID).');
    if (!authData.credentialId || !authData.coseKey) throw new FounderPasskeyError('invalid_response', 'Falta la credencial');
    const credentialId = authData.credentialId.toString('base64url');
    if (this.store.get(credentialId)) throw new FounderPasskeyError('invalid_response', 'Esa llave ya estaba registrada.');
    const record: FounderPasskeyRecord = {
      credentialId,
      principalId: this.founderPrincipalId,
      publicKeyPem: coseEs256ToPem(authData.coseKey),
      rpId,
      signCount: authData.signCount,
      createdAt: this.now().toISOString(),
      active: true,
    };
    this.store.upsert(record);
    return record;
  }

  /** Opciones para `navigator.credentials.get`, ligadas a UNA acción permitida. */
  assertionOptions(origin: string, action: string): Record<string, unknown> {
    const normalized = action.trim();
    if (!this.allowedActions.includes(normalized)) {
      throw new FounderPasskeyError('invalid_action', 'Esta acción exige el puente nativo de Face ID; la llave de acceso no la cubre.');
    }
    const rpId = this.rpIdFor(origin);
    const keys = this.store.list(true).filter((item) => item.rpId === rpId);
    if (keys.length === 0) throw new FounderPasskeyError('passkey_unavailable', 'Todavía no hay una llave de acceso del CEO registrada en esta dirección.');
    const issued = this.issue('get', normalized);
    return {
      challengeId: issued.id,
      expiresAt: issued.expiresAt,
      action: normalized,
      publicKey: {
        challenge: issued.challenge,
        rpId,
        userVerification: 'required',
        timeout: this.challengeTtlMs,
        allowCredentials: keys.map((item) => ({ type: 'public-key', id: item.credentialId })),
      },
    };
  }

  verifyAssertion(input: { challengeId: unknown; credentialId: unknown; clientDataJSON: unknown; authenticatorData: unknown; signature: unknown }): { proofId: string; action: string; expiresAt: string } {
    const pending = this.take(input.challengeId, 'get');
    const key = typeof input.credentialId === 'string' ? this.store.get(input.credentialId) : null;
    if (!key || !key.active || key.revokedAt || key.principalId !== this.founderPrincipalId) {
      throw new FounderPasskeyError('passkey_unavailable', 'Llave de acceso no reconocida.');
    }
    const clientData = b64u(input.clientDataJSON, 'clientDataJSON');
    const origin = checkClientData(clientData, 'webauthn.get', pending.challenge, this.origins);
    if (this.rpIdFor(origin) !== key.rpId) throw new FounderPasskeyError('invalid_origin', 'La llave no pertenece a esta dirección');
    const authDataRaw = b64u(input.authenticatorData, 'authenticatorData');
    const authData = parseAuthenticatorData(authDataRaw);
    if (!authData.rpIdHash.equals(sha256(key.rpId))) throw new FounderPasskeyError('invalid_origin', 'La llave no pertenece a este JANUS');
    if (!authData.userPresent || !authData.userVerified) throw new FounderPasskeyError('user_verification_required', 'Hace falta verificar al usuario (Face ID).');
    const signature = b64u(input.signature, 'signature', 256);
    let valid = false;
    try { valid = verify('sha256', Buffer.concat([authDataRaw, sha256(clientData)]), createPublicKey(key.publicKeyPem), signature); } catch { valid = false; }
    if (!valid) throw new FounderPasskeyError('invalid_signature', 'La firma de la llave de acceso no es válida.');
    // Contador: si el autenticador lo usa (≠0), debe avanzar; un retroceso indica una copia de la llave.
    if ((authData.signCount !== 0 || key.signCount !== 0) && authData.signCount <= key.signCount) {
      throw new FounderPasskeyError('invalid_signature', 'El contador de la llave retrocedió: posible copia. No se acepta.');
    }
    if (authData.signCount !== key.signCount) this.store.upsert({ ...key, signCount: authData.signCount });

    const issuedAt = this.now();
    const verifiedAt = issuedAt.toISOString();
    const expiresAt = new Date(issuedAt.getTime() + this.proofTtlMs).toISOString();
    const proofId = `bio_proof_${randomBytes(32).toString('base64url')}`;
    const action = pending.action!;
    this.proofs.set(proofId, {
      proofId,
      principalId: this.founderPrincipalId,
      action,
      method: PASSKEY_METHOD,
      verifiedAt,
      expiresAt,
      keyId: `passkey:${sha256(key.credentialId).toString('hex').slice(0, 32)}`,
      proofHash: sha256(JSON.stringify([proofId, action, key.credentialId, verifiedAt, expiresAt, signature.toString('base64url')])).toString('hex'),
    });
    return { proofId, action, expiresAt };
  }

  /** Un solo uso, ligado a la acción y al Founder. */
  consumeProof(input: { proofId: string; principalId: string; action: string; requestedAt: string }): AuthorityBiometricAttestation | undefined {
    this.prune();
    const proof = this.proofs.get(input.proofId);
    if (!proof) return undefined;
    this.proofs.delete(input.proofId);
    const requestedAt = Date.parse(input.requestedAt);
    if (proof.principalId !== input.principalId || proof.action !== input.action) return undefined;
    if (!Number.isFinite(requestedAt) || requestedAt > Date.parse(proof.expiresAt) || requestedAt < Date.parse(proof.verifiedAt) - 5_000) return undefined;
    const { proofId: _proofId, ...attestation } = proof;
    return attestation;
  }

  private prune(): void {
    const now = this.now().getTime();
    for (const [id, pending] of this.challenges) if (pending.expiresAt <= now) this.challenges.delete(id);
    for (const [id, proof] of this.proofs) if (Date.parse(proof.expiresAt) <= now) this.proofs.delete(id);
    if (this.challenges.size > 200) this.challenges.clear();
  }
}
