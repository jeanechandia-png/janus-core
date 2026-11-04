/** Personalización que PUEDE hacer la niña: nombre, icono, tema y criatura. Todo con listas cerradas o validación estricta. */

export const KID_ICONS = ['🦄', '🐙', '🦊', '🐱', '🐼', '🐸', '🐰', '🦋', '🌟', '🌈', '🎀', '🚀', '🎵', '🧸', '🍓', '🐬'] as const;
export const KID_THEMES = ['lila', 'menta', 'sol', 'oceano', 'rosa'] as const;
export type KidTheme = (typeof KID_THEMES)[number];

export interface KidProfile {
  displayName: string;
  icon: string;
  theme: KidTheme;
  /** Identificador de la criatura (módulo `companion`); el anfitrión comprueba que exista. */
  companionId: string;
}

export const DEFAULT_PROFILE: KidProfile = { displayName: 'Peque', icon: '🦄', theme: 'lila', companionId: 'lumi' };

export type ProfileValidation = { ok: true; profile: KidProfile } | { ok: false; message: string };

/** Nombre mostrado: letras (cualquier idioma), espacios, guion y apóstrofo; sin dígitos largos, enlaces ni arrobas. */
export function validateDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: 'Escribe un nombre.' };
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 20) return { ok: false, message: 'El nombre debe tener entre 1 y 20 letras.' };
  if (!/^[\p{L}][\p{L}\p{M}' -]*$/u.test(name)) return { ok: false, message: 'Usa solo letras, espacios y guiones.' };
  if (/https?|www\.|@/i.test(name)) return { ok: false, message: 'Ese nombre no es válido.' };
  return { ok: true, name };
}

export function applyProfileUpdate(current: KidProfile, input: unknown): ProfileValidation {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const patch = input as Record<string, unknown>;
  const next: KidProfile = { ...current };
  if (patch.displayName !== undefined) {
    const name = validateDisplayName(patch.displayName);
    if (!name.ok) return { ok: false, message: name.message };
    next.displayName = name.name;
  }
  if (patch.icon !== undefined) {
    if (typeof patch.icon !== 'string' || !(KID_ICONS as readonly string[]).includes(patch.icon)) return { ok: false, message: 'Ese icono no está en la lista.' };
    next.icon = patch.icon;
  }
  if (patch.theme !== undefined) {
    if (typeof patch.theme !== 'string' || !(KID_THEMES as readonly string[]).includes(patch.theme)) return { ok: false, message: 'Ese tema no está en la lista.' };
    next.theme = patch.theme as KidTheme;
  }
  if (patch.companionId !== undefined) {
    if (typeof patch.companionId !== 'string' || !/^[a-z][a-z0-9-]{1,23}$/.test(patch.companionId)) return { ok: false, message: 'Esa criatura no es válida.' };
    next.companionId = patch.companionId;
  }
  return { ok: true, profile: next };
}
