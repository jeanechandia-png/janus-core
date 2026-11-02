/**
 * Personalización de la criatura: color de pelo, detalles, ojos, prendas y accesorios.
 * Catálogo CERRADO: el niño solo elige entre opciones; no hay texto libre ni subida de imágenes.
 * Personalizar es SOLO estético: no cambia el carácter, la voz ni la forma de enseñar de la criatura (ver personas.ts).
 */
import { getCreature } from './personas.js';

export type SwatchId = 'nieve' | 'crema' | 'dorado' | 'melocoton' | 'coral' | 'rosa' | 'lila' | 'violeta' | 'cielo' | 'azul' | 'menta' | 'verde' | 'piedra' | 'chocolate' | 'carbon';
export const SWATCHES: Record<SwatchId, { label: string; hex: string }> = {
  nieve: { label: 'Nieve', hex: '#FFF6EA' }, crema: { label: 'Crema', hex: '#FBE7C6' }, dorado: { label: 'Dorado', hex: '#F6C453' },
  melocoton: { label: 'Melocotón', hex: '#FFB68A' }, coral: { label: 'Coral', hex: '#FF8E7A' }, rosa: { label: 'Rosa', hex: '#FF9CC8' },
  lila: { label: 'Lila', hex: '#C9B6E8' }, violeta: { label: 'Violeta', hex: '#9B7BE0' }, cielo: { label: 'Cielo', hex: '#8EC8FF' },
  azul: { label: 'Azul', hex: '#4F8DF0' }, menta: { label: 'Menta', hex: '#7FE3C4' }, verde: { label: 'Verde', hex: '#8FBF5A' },
  piedra: { label: 'Piedra', hex: '#BDAE92' }, chocolate: { label: 'Chocolate', hex: '#8A5A3B' }, carbon: { label: 'Carbón', hex: '#4B4350' }
};
export const SWATCH_IDS = Object.keys(SWATCHES) as SwatchId[];

export type EyeId = 'ambar' | 'azul' | 'verde' | 'violeta' | 'chocolate';
export const EYES: Record<EyeId, { label: string; hex: string }> = {
  ambar: { label: 'Ámbar', hex: '#F2A63B' }, azul: { label: 'Azul', hex: '#4FA3F7' }, verde: { label: 'Verde', hex: '#5DBB63' },
  violeta: { label: 'Violeta', hex: '#9B6BE8' }, chocolate: { label: 'Chocolate', hex: '#5A3A22' }
};
export const EYE_IDS = Object.keys(EYES) as EyeId[];

export type OutfitId = 'ninguna' | 'camiseta' | 'jersey' | 'vestido' | 'peto' | 'capa';
export interface CatalogItem { id: string; label: string; /** "mi gorro", "mis gafas": para frases sin género. */ poss: string; icon: string; price: number; tintable: boolean }
export const OUTFITS: Array<CatalogItem & { id: OutfitId }> = [
  { id: 'ninguna', label: 'Sin ropa extra', poss: 'mi pelo', icon: '🧸', price: 0, tintable: false },
  { id: 'camiseta', label: 'Camiseta', poss: 'mi camiseta', icon: '👕', price: 0, tintable: true },
  { id: 'jersey', label: 'Jersey', poss: 'mi jersey', icon: '🧶', price: 8, tintable: true },
  { id: 'vestido', label: 'Vestido', poss: 'mi vestido', icon: '👗', price: 10, tintable: true },
  { id: 'peto', label: 'Peto', poss: 'mi peto', icon: '👖', price: 10, tintable: true },
  { id: 'capa', label: 'Capa', poss: 'mi capa', icon: '🦸', price: 14, tintable: true }
];

export type Slot = 'cabeza' | 'cara' | 'cuello' | 'espalda';
export const SLOTS: Slot[] = ['cabeza', 'cara', 'cuello', 'espalda'];
export const SLOT_LABEL: Record<Slot, string> = { cabeza: 'Cabeza', cara: 'Cara', cuello: 'Cuello', espalda: 'Espalda' };
export const ACCESSORIES: Record<Slot, CatalogItem[]> = {
  cabeza: [
    { id: 'gorro', label: 'Gorro de lana', poss: 'mi gorro de lana', icon: '🧢', price: 0, tintable: true },
    { id: 'corona', label: 'Corona', poss: 'mi corona', icon: '👑', price: 12, tintable: true },
    { id: 'lazo', label: 'Lazo', poss: 'mi lazo', icon: '🎀', price: 5, tintable: true },
    { id: 'copa', label: 'Sombrero de copa', poss: 'mi sombrero de copa', icon: '🎩', price: 10, tintable: true },
    { id: 'flor', label: 'Flor', poss: 'mi flor', icon: '🌸', price: 5, tintable: true },
    { id: 'diadema', label: 'Diadema de estrella', poss: 'mi diadema de estrella', icon: '⭐', price: 8, tintable: true }
  ],
  cara: [
    { id: 'gafas-redondas', label: 'Gafas redondas', poss: 'mis gafas redondas', icon: '👓', price: 0, tintable: true },
    { id: 'gafas-estrella', label: 'Gafas de estrella', poss: 'mis gafas de estrella', icon: '🤩', price: 8, tintable: true },
    { id: 'gafas-sol', label: 'Gafas de sol', poss: 'mis gafas de sol', icon: '🕶️', price: 8, tintable: false },
    { id: 'antifaz', label: 'Antifaz', poss: 'mi antifaz', icon: '🦹', price: 6, tintable: true }
  ],
  cuello: [
    { id: 'bufanda', label: 'Bufanda', poss: 'mi bufanda', icon: '🧣', price: 0, tintable: true },
    { id: 'pajarita', label: 'Pajarita', poss: 'mi pajarita', icon: '🎀', price: 5, tintable: true },
    { id: 'perlas', label: 'Collar de perlas', poss: 'mi collar de perlas', icon: '📿', price: 8, tintable: false },
    { id: 'medalla', label: 'Medalla', poss: 'mi medalla', icon: '🏅', price: 10, tintable: true }
  ],
  espalda: [
    { id: 'mochila', label: 'Mochila', poss: 'mi mochila', icon: '🎒', price: 0, tintable: true },
    { id: 'alas-hada', label: 'Alas de hada', poss: 'mis alas de hada', icon: '🧚', price: 14, tintable: true },
    { id: 'estrellas', label: 'Estrellas flotantes', poss: 'mis estrellas flotantes', icon: '✨', price: 12, tintable: false }
  ]
};

export interface Look {
  fur: SwatchId; accent: SwatchId; eyes: EyeId;
  outfit: OutfitId; outfitColor: SwatchId; accessoryColor: SwatchId;
  accessories: Partial<Record<Slot, string>>;
}

/** Aspecto de fábrica: el del diseño original de cada criatura. */
const DEFAULTS: Record<string, Pick<Look, 'fur' | 'accent' | 'eyes'>> = {
  lumi: { fur: 'crema', accent: 'lila', eyes: 'ambar' },
  bombo: { fur: 'coral', accent: 'menta', eyes: 'chocolate' },
  musgo: { fur: 'verde', accent: 'piedra', eyes: 'ambar' },
  nimbo: { fur: 'crema', accent: 'dorado', eyes: 'azul' }
};
export function defaultLook(creatureId: string): Look {
  getCreature(creatureId);
  const d = DEFAULTS[creatureId] ?? DEFAULTS.lumi!;
  return { fur: d.fur, accent: d.accent, eyes: d.eyes, outfit: 'ninguna', outfitColor: 'cielo', accessoryColor: 'dorado', accessories: {} };
}

const isSwatch = (v: unknown): v is SwatchId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SWATCHES, v);
const isEye = (v: unknown): v is EyeId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(EYES, v);
const isOutfit = (v: unknown): v is OutfitId => typeof v === 'string' && OUTFITS.some((o) => o.id === v);
export const isAccessory = (slot: unknown, id: unknown): boolean => typeof slot === 'string' && (SLOTS as string[]).includes(slot) && typeof id === 'string' && ACCESSORIES[slot as Slot].some((a) => a.id === id);

/** Repara un aspecto guardado o recibido de fuera: cada campo desconocido vuelve a su valor de fábrica. */
export function sanitizeLook(raw: unknown, creatureId: string): Look {
  const base = defaultLook(creatureId), r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const acc: Partial<Record<Slot, string>> = {};
  const ra = (r.accessories && typeof r.accessories === 'object' ? r.accessories : {}) as Record<string, unknown>;
  for (const s of SLOTS) if (isAccessory(s, ra[s])) acc[s] = ra[s] as string;
  return {
    fur: isSwatch(r.fur) ? r.fur : base.fur, accent: isSwatch(r.accent) ? r.accent : base.accent, eyes: isEye(r.eyes) ? r.eyes : base.eyes,
    outfit: isOutfit(r.outfit) ? r.outfit : base.outfit, outfitColor: isSwatch(r.outfitColor) ? r.outfitColor : base.outfitColor,
    accessoryColor: isSwatch(r.accessoryColor) ? r.accessoryColor : base.accessoryColor, accessories: acc
  };
}

export type LookChange =
  | { part: 'fur' | 'accent' | 'outfitColor' | 'accessoryColor'; value: SwatchId }
  | { part: 'eyes'; value: EyeId }
  | { part: 'outfit'; value: OutfitId }
  | { part: 'accessory'; slot: Slot; value: string | null };

/** Aplica un cambio validado y devuelve un aspecto nuevo (no muta el original). Lanza si el valor no está en el catálogo. */
export function applyLookChange(look: Look, change: LookChange): Look {
  const next: Look = { ...look, accessories: { ...look.accessories } };
  switch (change.part) {
    case 'fur': case 'accent': case 'outfitColor': case 'accessoryColor':
      if (!isSwatch(change.value)) throw new Error('Color desconocido'); next[change.part] = change.value; break;
    case 'eyes': if (!isEye(change.value)) throw new Error('Color de ojos desconocido'); next.eyes = change.value; break;
    case 'outfit': if (!isOutfit(change.value)) throw new Error('Prenda desconocida'); next.outfit = change.value; break;
    case 'accessory':
      if (change.value === null) { delete next.accessories[change.slot]; break; }
      if (!isAccessory(change.slot, change.value)) throw new Error('Accesorio desconocido'); next.accessories[change.slot] = change.value; break;
    default: throw new Error('Cambio desconocido');
  }
  return next;
}

export function findItem(change: Extract<LookChange, { part: 'accessory' | 'outfit' }>): CatalogItem | undefined {
  if (change.part === 'outfit') return OUTFITS.find((o) => o.id === change.value);
  return change.value === null ? undefined : ACCESSORIES[change.slot].find((a) => a.id === change.value);
}

/** Frase corta y dulce de la criatura al cambiarse. Sin género y sin comentar cuerpos. */
export function reactionTo(change: LookChange, look: Look): string {
  switch (change.part) {
    case 'fur': return '¡Pelo nuevo! Me siento como un arcoíris con patas.';
    case 'accent': return '¡Mira mis detalles de color! Brillan mucho.';
    case 'eyes': return '¡Ojos nuevos! Ahora lo veo todo todavía más bonito.';
    case 'outfitColor': case 'accessoryColor': return '¡Qué color tan divertido! Me encanta.';
    case 'outfit': { const o = OUTFITS.find((x) => x.id === look.outfit); return look.outfit === 'ninguna' ? '¡Listo! Así estoy cómodo para jugar.' : '¡Mira ' + (o?.poss ?? 'mi ropa') + '! Con eso me siento genial.'; }
    case 'accessory': {
      if (change.value === null) return '¡Listo! Me lo quito y sigo igual de contento.';
      const it = ACCESSORIES[change.slot].find((a) => a.id === change.value);
      return '¡Mira ' + (it?.poss ?? 'mi accesorio') + '! Con eso me siento genial.';
    }
  }
}

/** "Sorpréndeme": un aspecto al azar dentro del catálogo (solo con lo gratuito o lo que ya se tiene, lo decide world.ts). */
export function randomLook(creatureId: string, rnd: () => number = Math.random, allow: (id: string) => boolean = () => true): Look {
  const pick = <T>(xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))]!;
  let look = defaultLook(creatureId);
  look = applyLookChange(look, { part: 'fur', value: pick(SWATCH_IDS) });
  look = applyLookChange(look, { part: 'accent', value: pick(SWATCH_IDS) });
  look = applyLookChange(look, { part: 'eyes', value: pick(EYE_IDS) });
  look = applyLookChange(look, { part: 'accessoryColor', value: pick(SWATCH_IDS) });
  look = applyLookChange(look, { part: 'outfitColor', value: pick(SWATCH_IDS) });
  const outs = OUTFITS.filter((o) => allow('out:' + o.id)); if (outs.length) look = applyLookChange(look, { part: 'outfit', value: pick(outs).id });
  for (const s of SLOTS) { const opts = ACCESSORIES[s].filter((a) => allow('acc:' + s + ':' + a.id)); if (opts.length && rnd() < 0.55) look = applyLookChange(look, { part: 'accessory', slot: s, value: pick(opts).id }); }
  return look;
}
