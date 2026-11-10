/**
 * Invitaciones de acceso para colaboradores (JANUS Work).
 *
 * El CEO crea la invitación con su autoridad (misma acción biométrica que la delegación directa). El colaborador
 * abre el enlace en SU teléfono: ahí se genera la llave del dispositivo y se canjea el código UNA sola vez.
 * El código nunca se guarda: solo su huella SHA-256. Caduca y se puede anular.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export type OperatorInviteStatus = 'pending' | 'redeemed' | 'revoked';
export type OperatorInviteLocale = 'es' | 'nl' | 'en';

export interface OperatorInvite {
  id: string;
  codeHash: string;
  principalId: string;
  displayName: string;
  locale: OperatorInviteLocale;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  status: OperatorInviteStatus;
  redeemedAt?: string;
  revokedAt?: string;
}

export const OPERATOR_INVITE_DEFAULT_TTL_MS = 72 * 60 * 60 * 1000;
export const OPERATOR_INVITE_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRINCIPAL = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const CODE = /^[A-Za-z0-9_-]{43}$/;

export class OperatorInviteError extends Error {
  constructor(readonly code: 'invalid_input' | 'invalid_code' | 'expired' | 'already_used' | 'revoked', message: string) {
    super(message);
  }
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export function isInviteCodeShape(code: unknown): code is string {
  return typeof code === 'string' && CODE.test(code);
}

export function createOperatorInvite(input: {
  principalId: string;
  displayName: string;
  locale?: string;
  createdBy: string;
  now: Date;
  ttlMs?: number;
  reservedPrincipalIds?: readonly string[];
}): { invite: OperatorInvite; code: string } {
  const principalId = input.principalId.trim().toLowerCase();
  if (!PRINCIPAL.test(principalId)) {
    throw new OperatorInviteError('invalid_input', 'El identificador debe tener de 2 a 64 caracteres: letras minúsculas, números, punto, guion.');
  }
  if ((input.reservedPrincipalIds ?? []).includes(principalId)) {
    throw new OperatorInviteError('invalid_input', 'Ese identificador está reservado.');
  }
  const displayName = input.displayName.trim().replace(/\s+/g, ' ');
  if (!displayName || displayName.length > 80) throw new OperatorInviteError('invalid_input', 'El nombre es obligatorio (máximo 80 caracteres).');
  const locale: OperatorInviteLocale = input.locale === 'nl' || input.locale === 'en' ? input.locale : 'es';
  const ttlMs = Math.min(OPERATOR_INVITE_MAX_TTL_MS, Math.max(5 * 60 * 1000, Math.floor(input.ttlMs ?? OPERATOR_INVITE_DEFAULT_TTL_MS)));
  const code = randomBytes(32).toString('base64url');
  return {
    code,
    invite: {
      id: `invite_${randomUUID()}`,
      codeHash: hashInviteCode(code),
      principalId,
      displayName,
      locale,
      createdBy: input.createdBy,
      createdAt: input.now.toISOString(),
      expiresAt: new Date(input.now.getTime() + ttlMs).toISOString(),
      status: 'pending',
    },
  };
}

/** Lanza si la invitación no se puede canjear en este instante. */
export function assertInviteUsable(invite: OperatorInvite | null, now: Date): asserts invite is OperatorInvite {
  if (!invite) throw new OperatorInviteError('invalid_code', 'Invitación no válida.');
  if (invite.status === 'redeemed') throw new OperatorInviteError('already_used', 'Esta invitación ya se usó. Pide una nueva.');
  if (invite.status === 'revoked') throw new OperatorInviteError('revoked', 'Esta invitación fue anulada.');
  if (Date.parse(invite.expiresAt) <= now.getTime()) throw new OperatorInviteError('expired', 'Esta invitación caducó. Pide una nueva.');
}

/** Vista sin la huella del código, para el CEO. */
export function publicOperatorInvite(invite: OperatorInvite, now: Date): Omit<OperatorInvite, 'codeHash'> & { expired: boolean } {
  const { codeHash: _codeHash, ...rest } = invite;
  return { ...rest, expired: invite.status === 'pending' && Date.parse(invite.expiresAt) <= now.getTime() };
}
