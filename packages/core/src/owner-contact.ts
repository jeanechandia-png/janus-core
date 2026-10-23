import { existsSync, readFileSync } from 'node:fs';

/**
 * Owner contact profile (Jean). PRIVATE data: it lives only in a local file that
 * git ignores (`config/owner-contact.local.json`) and is served to the dashboard
 * solely behind the Founder session. Never commit real values to this public repo.
 */

export interface OwnerEmail {
  address: string;
  label: string;
  /** What the address is for, e.g. "personal", "corporativo", "operativo", "claude". */
  role: string;
  /** True when the value was dictated and its spelling still needs the owner's confirmation. */
  needsConfirmation?: boolean;
}

export interface OwnerPhone {
  label: string;
  /** Canonical E.164 form, e.g. +31640613413. */
  e164: string;
  /** Human readable form, e.g. +31 6 40613413. */
  display: string;
  whatsapp: boolean;
}

export interface OwnerContactProfile {
  displayName: string;
  emails: OwnerEmail[];
  phones: OwnerPhone[];
}

export type OwnerContactSnapshot =
  | { configured: false; reason: string }
  | { configured: true; profile: OwnerContactProfile; whatsappLinks: Array<{ label: string; url: string }> };

/** Addresses the owner explicitly banned from all materials and communications. */
export const BLOCKED_OWNER_EMAILS: readonly string[] = ['zero30008@hotmail.com'];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class OwnerContactError extends Error {}

/** Normalizes a Dutch mobile number ("640-61-3413", "06 40613413", "+31 6 4061 3413") to E.164. */
export function normalizeDutchMobile(raw: string): { e164: string; display: string } {
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('31')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  if (!/^6\d{8}$/.test(digits)) {
    throw new OwnerContactError('El teléfono no es un móvil holandés válido (debe quedar +31 6 y 8 dígitos).');
  }
  return { e164: `+31${digits}`, display: `+31 ${digits[0]} ${digits.slice(1)}` };
}

export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, '')}`;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new OwnerContactError(`Falta ${field}.`);
  return value.trim();
}

export function parseOwnerContact(input: unknown): OwnerContactProfile {
  if (!input || typeof input !== 'object') throw new OwnerContactError('El perfil de contacto debe ser un objeto JSON.');
  const raw = input as Record<string, unknown>;
  const blocked = new Set(BLOCKED_OWNER_EMAILS);

  const emails: OwnerEmail[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(raw.emails) ? raw.emails : []) {
    const e = (item ?? {}) as Record<string, unknown>;
    const address = text(e.address, 'emails[].address').toLowerCase();
    if (!EMAIL_PATTERN.test(address)) throw new OwnerContactError(`Correo inválido: ${address}`);
    if (blocked.has(address)) throw new OwnerContactError(`El correo ${address} está prohibido en materiales y comunicaciones.`);
    if (seen.has(address)) continue;
    seen.add(address);
    emails.push({
      address,
      label: text(e.label, 'emails[].label'),
      role: text(e.role, 'emails[].role'),
      ...(e.needsConfirmation === true ? { needsConfirmation: true } : {}),
    });
  }

  const phones: OwnerPhone[] = [];
  for (const item of Array.isArray(raw.phones) ? raw.phones : []) {
    const p = (item ?? {}) as Record<string, unknown>;
    const { e164, display } = normalizeDutchMobile(text(p.number, 'phones[].number'));
    phones.push({ label: text(p.label, 'phones[].label'), e164, display, whatsapp: p.whatsapp === true });
  }

  if (emails.length === 0 && phones.length === 0) throw new OwnerContactError('El perfil no tiene correos ni teléfonos.');
  return { displayName: text(raw.displayName, 'displayName'), emails, phones };
}

export function ownerContactSnapshot(profile: OwnerContactProfile): OwnerContactSnapshot {
  return {
    configured: true,
    profile,
    whatsappLinks: profile.phones.filter((p) => p.whatsapp).map((p) => ({ label: p.label, url: whatsappUrl(p.e164) })),
  };
}

/** Loads the private profile; a missing file is a normal "not configured" state, a malformed one is an error. */
export function loadOwnerContact(path: string): OwnerContactSnapshot {
  if (!existsSync(path)) {
    return { configured: false, reason: 'No existe el archivo privado de contacto (config/owner-contact.local.json).' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new OwnerContactError('El archivo de contacto no es JSON válido.');
  }
  return ownerContactSnapshot(parseOwnerContact(parsed));
}
