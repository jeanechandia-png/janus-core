/** Perfil del niño/a: criatura elegida, nombres puestos por él/ella, nivel y estado. Vive en el almacén local del host. */
import { CREATURES, getCreature, type Creature } from './personas.js';
import type { EncourageState } from './encourage.js';

export interface CompanionProfile {
  childId: string;
  childName: string;
  creatureId: string;
  /** Nombre que el niño/a le puso a cada criatura. */
  names: Record<string, string>;
  mathLevel: 1 | 2 | 3;
  encourage: EncourageState;
  /** Biometría (voz/rostro): solo en el dispositivo y con consentimiento explícito del padre/tutor. */
  biometrics: { consentByGuardian: boolean; onDeviceOnly: true; voice: boolean; face: boolean };
}

export function newProfile(childId: string, childName: string, creatureId = CREATURES[0]!.id): CompanionProfile {
  getCreature(creatureId);
  return { childId, childName, creatureId, names: {}, mathLevel: 1, encourage: { said: [], recent: [] }, biometrics: { consentByGuardian: false, onDeviceOnly: true, voice: false, face: false } };
}

/** Puede cambiar de criatura cuando quiera; no se limita a una. */
export function chooseCreature(p: CompanionProfile, creatureId: string): Creature {
  const c = getCreature(creatureId); p.creatureId = c.id; return c;
}

export function renameCreature(p: CompanionProfile, creatureId: string, name: string): string {
  getCreature(creatureId);
  const clean = name.trim().replace(/[<>]/g, '').slice(0, 20);
  if (!clean) throw new Error('El nombre no puede estar vacío');
  p.names[creatureId] = clean; return clean;
}

export function displayName(p: CompanionProfile, creatureId = p.creatureId): string {
  return p.names[creatureId] || getCreature(creatureId).defaultName;
}

/** Activar biometría exige consentimiento del tutor y procesamiento local (RGPD art. 9; uso doméstico art. 2.2.c). */
export function enableBiometrics(p: CompanionProfile, kinds: { voice?: boolean; face?: boolean }, guardianConsent: boolean): void {
  if (!guardianConsent) throw new Error('Se necesita el consentimiento del padre/tutor');
  p.biometrics = { consentByGuardian: true, onDeviceOnly: true, voice: !!kinds.voice, face: !!kinds.face };
}

/** Tamaño del compañero en pantalla (decisión de Jean): teléfono mitad; tablet cuarto, ampliable a mitad. */
export function stageSize(device: 'phone' | 'tablet' | 'desktop', expanded = false): { fraction: number; position: 'bottom' | 'side' } {
  if (device === 'phone') return { fraction: 0.5, position: 'bottom' };
  return { fraction: expanded ? 0.5 : 0.25, position: 'side' };
}
