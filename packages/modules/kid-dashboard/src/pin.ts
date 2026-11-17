import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Bloqueo parental: PIN de 4–8 dígitos guardado con scrypt (nunca en claro) y bloqueo progresivo por intentos fallidos.
 * Honestidad: un PIN corto es débil frente a un ataque offline sobre la base de datos; la defensa real es el bloqueo
 * por intentos y que el PIN solo abre el área de padres del dashboard de la niña (no la autoridad del Founder).
 */

export interface PinRecord {
  salt: string;
  hash: string;
  failedAttempts: number;
  lockedUntil?: string;
  updatedAt: string;
}

export type PinCheck =
  | { result: 'ok'; record: PinRecord }
  | { result: 'wrong'; record: PinRecord; attemptsLeft: number }
  | { result: 'locked'; record: PinRecord; retryAfterSeconds: number }
  | { result: 'no-pin'; record?: undefined };

const PARAMS = { N: 16_384, r: 8, p: 1 } as const;
export const MAX_FAILED_BEFORE_LOCK = 5;

export function validatePinFormat(pin: unknown): { ok: true } | { ok: false; message: string } {
  if (typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return { ok: false, message: 'El PIN debe tener entre 4 y 8 dígitos.' };
  if (/^(\d)\1+$/.test(pin)) return { ok: false, message: 'Elige un PIN que no repita el mismo dígito.' };
  const ascending = '01234567890123456789';
  const descending = '98765432109876543210';
  if (ascending.includes(pin) || descending.includes(pin)) return { ok: false, message: 'Elige un PIN que no sea una secuencia (1234, 4321…).' };
  return { ok: true };
}

function derive(pin: string, salt: Buffer): Buffer {
  return scryptSync(pin, salt, 32, PARAMS);
}

export function createPinRecord(pin: string, now: Date): PinRecord {
  const format = validatePinFormat(pin);
  if (!format.ok) throw new Error(format.message);
  const salt = randomBytes(16);
  return { salt: salt.toString('base64'), hash: derive(pin, salt).toString('base64'), failedAttempts: 0, updatedAt: now.toISOString() };
}

export function verifyPin(record: PinRecord | undefined, pin: unknown, now: Date): PinCheck {
  if (!record) return { result: 'no-pin' };
  if (record.lockedUntil) {
    const remaining = new Date(record.lockedUntil).getTime() - now.getTime();
    if (remaining > 0) return { result: 'locked', record, retryAfterSeconds: Math.ceil(remaining / 1000) };
  }
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const given = typeof pin === 'string' && /^\d{4,8}$/.test(pin) ? derive(pin, salt) : Buffer.alloc(expected.length);
  const matches = given.length === expected.length && timingSafeEqual(given, expected) && typeof pin === 'string' && /^\d{4,8}$/.test(pin);
  if (matches) {
    const { lockedUntil: _omit, ...rest } = record;
    return { result: 'ok', record: { ...rest, failedAttempts: 0 } };
  }
  const failed = record.failedAttempts + 1;
  if (failed >= MAX_FAILED_BEFORE_LOCK) {
    // Bloqueo progresivo: 5 min, 10, 20… con tope de 1 hora.
    const series = Math.floor(failed / MAX_FAILED_BEFORE_LOCK);
    const minutes = Math.min(60, 5 * 2 ** (series - 1));
    const lockedUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
    return { result: 'locked', record: { ...record, failedAttempts: failed, lockedUntil }, retryAfterSeconds: minutes * 60 };
  }
  return { result: 'wrong', record: { ...record, failedAttempts: failed }, attemptsLeft: MAX_FAILED_BEFORE_LOCK - (failed % MAX_FAILED_BEFORE_LOCK) };
}
