/**
 * Dirección visual aprobada el 2026-11-05.
 *
 * Este manifiesto gobierna la NUEVA selección de personajes para Kendra.
 * No es un renderer ni un sustituto de los modelos 3D: los assets deben
 * vincularse y verificarse antes de mostrarlos como listos.
 *
 * Las personas históricas de personas.ts se conservan para perfiles previos.
 * No se deben presentar automáticamente como diseños aprobados.
 */
export type CharacterOrigin = 'chatgpt-approved-design' | 'janus-original-robot';
export type CharacterRole = 'main-companion' | 'evolution-archive';

export interface CharacterSelectionSlot {
  id: string;
  position: 1 | 2 | 3;
  kind: 'creature' | 'robot';
  origin: CharacterOrigin;
  role: CharacterRole;
  approved: true;
  /** Referencias verificadas a activos, NO URLs inventadas ni sustitutos visuales. */
  assets: {
    previewImage: string | null;
    model3d: string | null;
  };
}

export const APPROVED_CHARACTER_SELECTION: readonly CharacterSelectionSlot[] = Object.freeze([
  {
    id: 'approved-creature-01',
    position: 1,
    kind: 'creature',
    origin: 'chatgpt-approved-design',
    role: 'main-companion',
    approved: true,
    assets: { previewImage: null, model3d: null },
  },
  {
    id: 'approved-creature-02',
    position: 2,
    kind: 'creature',
    origin: 'chatgpt-approved-design',
    role: 'main-companion',
    approved: true,
    assets: { previewImage: null, model3d: null },
  },
  {
    id: 'janus-original-robot',
    position: 3,
    kind: 'robot',
    origin: 'janus-original-robot',
    role: 'evolution-archive',
    approved: true,
    assets: { previewImage: null, model3d: null },
  },
]);

/** Los diseños de Claude están rechazados y no pertenecen al catálogo aprobado. */
export function isApprovedCharacterOrigin(origin: string): origin is CharacterOrigin {
  return origin === 'chatgpt-approved-design' || origin === 'janus-original-robot';
}

/**
 * Una posición aprobada NO implica un modelo instalado.
 * La interfaz debe exigir activos reales antes de habilitar su representación 3D.
 */
export function isCharacterReady(slot: CharacterSelectionSlot): boolean {
  return slot.approved && isApprovedCharacterOrigin(slot.origin)
    && Boolean(slot.assets.previewImage && slot.assets.model3d);
}

export function getApprovedCharacterSlot(id: string): CharacterSelectionSlot {
  const slot = APPROVED_CHARACTER_SELECTION.find((character) => character.id === id);
  if (!slot) throw new Error('Personaje no aprobado para la nueva selección: ' + id);
  return slot;
}
