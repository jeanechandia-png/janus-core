/**
 * Adaptador «kit del compañero»: compone módulos LEGO independientes en un producto concreto.
 *   companion   → criaturas con carácter fijo, ánimo, tutor, seguridad
 *   avatar-look → pelo, ojos, ropa y accesorios (estético)
 *   star-shop   → estrellas por esfuerzo, tienda, casa, vehículos, decoración
 *   scene-stage → escena manipulable y lecciones con representaciones concretas
 * Cada módulo sigue siendo reutilizable por separado; aquí solo viven los pegamentos (reglas que cruzan módulos):
 *   · vestirse exige que la prenda sea suya;
 *   · el filtro «nunca hablar de cuerpos» de companion se aplica a todo texto de la escena;
 *   · la lección usa la voz de la criatura.
 * El dashboard empaqueta este archivo como global `Companion` (ver prototypes/dashboard/vendor/README.txt).
 */
import {
  CREATURES, getCreature, isBodySafe, newProfile,
  type CompanionProfile, type Creature
} from '../../modules/companion/src/index.js';
import {
  accessoryKey, applyLookChange, defaultLook, lookItems, outfitKey, randomLook, reactionTo, sanitizeLook,
  type Look, type LookChange
} from '../../modules/avatar-look/src/index.js';
import { createShop, type World } from '../../modules/star-shop/src/index.js';
import {
  buildLesson as buildSceneLesson, validateCommands as validateSceneCommands,
  type Lesson, type LessonInput
} from '../../modules/scene-stage/src/index.js';

// Todo lo de los módulos, tal cual (para quien quiera usarlos desde el kit).
export * from '../../modules/companion/src/index.js';
export * from '../../modules/avatar-look/src/index.js';
export * from '../../modules/star-shop/src/index.js';
export {
  STAGE, MAX_PROPS, MAX_COMMANDS, MAX_SAID, PROP_KINDS, POSES, VIEWS, PLACE_LABEL, PLACE_NAME, MAX_PLACE, LESSON_BASIS,
  newScene, applyCommand, applyCommands, userMove, userAdjust, userExchange, builtValue, cookieCount, checkBuild, cleanText, stepsFor,
  type Prop, type PropKind, type Pose, type View, type SceneState, type SceneCommand, type SceneEvent, type BuildGoal, type CreatureState,
  type Rejected, type Lesson, type LessonStep, type LessonInput, type LessonVoice, type LessonTopic, type TextGuard
} from '../../modules/scene-stage/src/index.js';

/** Perfil del niño con lo que añade el kit: aspecto por criatura y mundo. Los perfiles antiguos no lo traen; los accesores lo toleran. */
export interface KitProfile extends CompanionProfile { looks?: Record<string, Look>; world?: World }

/** La tienda del kit: ropa y accesorios de avatar-look + casas, vehículos y decoración de star-shop. */
export const kitShop = createShop(lookItems());

export function newKitProfile(childId: string, childName: string, creatureId = CREATURES[0]!.id): KitProfile {
  return { ...newProfile(childId, childName, creatureId), looks: {}, world: kitShop.newWorld() };
}

/** Aspecto de fábrica de una criatura (el de su diseño original). */
export function defaultLookFor(creatureId: string): Look {
  const c = getCreature(creatureId);
  return sanitizeLook({ ...defaultLook(), fur: c.look.fur, accent: c.look.accent, eyes: c.look.eyes }, defaultLook());
}

/** Aspecto actual (siempre válido, aunque el perfil sea antiguo o esté dañado). */
export function lookOf(p: KitProfile, creatureId = p.creatureId): Look {
  return sanitizeLook(p.looks?.[creatureId], defaultLookFor(creatureId));
}

export function worldOf(p: KitProfile): World {
  p.world = kitShop.sanitize(p.world); return p.world;
}

/** ¿Puede ponerse este cambio? Los colores son gratis; prendas y accesorios, solo si son suyos; quitar siempre se puede. */
export function canWear(w: World, change: LookChange): boolean {
  if (change.part === 'outfit') return w.owned.includes(outfitKey(change.value));
  if (change.part === 'accessory') return change.value === null || w.owned.includes(accessoryKey(change.slot, change.value));
  return true;
}

export interface WearResult { ok: boolean; look: Look; say: string; why?: 'no-es-tuyo' }

/** Aplica un cambio de aspecto a la criatura. Vestirla es de la niña (estético); el carácter de la criatura no cambia. */
export function wear(p: KitProfile, change: LookChange, creatureId = p.creatureId): WearResult {
  const cur = lookOf(p, creatureId), w = worldOf(p);
  if (!canWear(w, change)) return { ok: false, look: cur, say: 'Eso todavía no es mío. ¡Con tus estrellas lo podemos conseguir en la tienda!', why: 'no-es-tuyo' };
  const next = applyLookChange(cur, change);
  p.looks = { ...(p.looks ?? {}), [creatureId]: next };
  return { ok: true, look: next, say: reactionTo(change, next) };
}

/** Vuelve al aspecto original de la criatura (no quita nada de lo comprado). */
export function resetLook(p: KitProfile, creatureId = p.creatureId): Look {
  const d = defaultLookFor(creatureId); p.looks = { ...(p.looks ?? {}), [creatureId]: d }; return d;
}

/** «Sorpréndeme»: un aspecto al azar con lo que ya es suyo. */
export function surpriseLook(p: KitProfile, rnd: () => number = Math.random, creatureId = p.creatureId): Look {
  const w = worldOf(p), next = randomLook(defaultLookFor(creatureId), rnd, (k) => w.owned.includes(k));
  p.looks = { ...(p.looks ?? {}), [creatureId]: next }; return next;
}

/** Lección con la voz de la criatura y el filtro de companion («nunca hablar de cuerpos») aplicado a todo texto. */
export function buildCreatureLesson(ex: LessonInput, creatureId: string): Lesson {
  const c: Creature = getCreature(creatureId);
  return buildSceneLesson(ex, { id: c.id, openers: c.style.openers, closers: c.style.closers }, { textGuard: isBodySafe });
}

/** Comandos de escena de origen no confiable, con el filtro de texto de companion. */
export function validateCreatureScene(raw: unknown): ReturnType<typeof validateSceneCommands> {
  return validateSceneCommands(raw, { textGuard: isBodySafe });
}
