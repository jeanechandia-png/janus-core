export * from './personas.js';
export * from './encourage.js';
export * from './tutor.js';
export * from './social.js';
export * from './safety.js';
export * from './profile.js';

import { checkMessage, type SafetyCheck } from './safety.js';
import { guardReply, pickEncouragement, type Moment } from './encourage.js';
import type { CompanionProfile } from './profile.js';

/**
 * Turno completo del compañero: seguridad primero, luego la respuesta del modelo (host) filtrada,
 * y como mucho una frase de ánimo si la política lo permite.
 */
export function companionTurn(p: CompanionProfile, childText: string, modelReply: string, moment: Moment | null, now: number, rnd?: () => number): { say: string[]; safety: SafetyCheck } {
  const safety = checkMessage(childText);
  if (safety.reply) {
    const extra = pickEncouragement('tristeza', p.childName, p.encourage, now, undefined, rnd);
    return { say: [safety.reply, ...(extra ? [extra] : [])], safety };
  }
  const say = [guardReply(modelReply).text];
  if (moment) { const e = pickEncouragement(moment, p.childName, p.encourage, now, undefined, rnd); if (e) say.push(e); }
  return { say, safety };
}
