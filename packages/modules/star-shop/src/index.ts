/**
 * star-shop · Economía de estrellas, tienda e inventario (ropa, accesorios, casa, vehículos, decoración).
 * Módulo autocontenido: el catálogo de ropa y accesorios lo aporta el producto (p. ej. desde avatar-look) al crear la tienda;
 * aquí viven las estrellas, el inventario y el mundo (casa, vehículo, decoración).
 * Principios de diseño (RECOMENDACIÓN, pendiente de revisión por un profesional — ver README):
 *  - Las estrellas se ganan por ESFUERZO y por aprender, nunca por velocidad ni por perfección.
 *  - Tope diario: nada de "una más y otra más".
 *  - Sin castigos: fallar nunca resta estrellas ni quita objetos.
 *  - Sin temporizadores, sin escasez, sin dinero real: este módulo no sabe nada de euros ni de pagos.
 *  - Catálogo CERRADO: solo se compra lo que figura en la tienda.
 * Todas las funciones son puras (devuelven un mundo nuevo) y el día llega como parámetro para poder probarlo.
 */

/** Un objeto de la tienda. `kind` es abierto: el producto puede añadir sus propios tipos (se compran y se poseen igual). */
export interface ShopItem { key: string; kind: string; label: string; icon: string; price: number; slot?: string }

const HOMES: ShopItem[] = [
  { key: 'home:cabana', kind: 'home', label: 'Cabaña de madera', icon: '🛖', price: 0 },
  { key: 'home:hongo', kind: 'home', label: 'Casita-seta', icon: '🍄', price: 20 },
  { key: 'home:arbol', kind: 'home', label: 'Casa del árbol', icon: '🌳', price: 30 },
  { key: 'home:nube', kind: 'home', label: 'Casa en las nubes', icon: '☁️', price: 45 }
];
const VEHICLES: ShopItem[] = [
  { key: 'veh:patinete', kind: 'veh', label: 'Patinete', icon: '🛴', price: 10 },
  { key: 'veh:bici', kind: 'veh', label: 'Bici', icon: '🚲', price: 15 },
  { key: 'veh:moto', kind: 'veh', label: 'Moto', icon: '🏍️', price: 25 },
  { key: 'veh:coche', kind: 'veh', label: 'Cochecito', icon: '🚗', price: 30 },
  { key: 'veh:cohete', kind: 'veh', label: 'Cohete', icon: '🚀', price: 40 }
];
const DECOR: ShopItem[] = [
  { key: 'dec:planta', kind: 'dec', label: 'Planta', icon: '🪴', price: 5 },
  { key: 'dec:alfombra', kind: 'dec', label: 'Alfombra', icon: '🟣', price: 6 },
  { key: 'dec:lampara', kind: 'dec', label: 'Lámpara', icon: '💡', price: 8 },
  { key: 'dec:cama', kind: 'dec', label: 'Cama', icon: '🛏️', price: 10 },
  { key: 'dec:estanteria', kind: 'dec', label: 'Estantería', icon: '📚', price: 10 }
];

/** Casas, vehículos y decoración incluidos de serie. */
export const WORLD_ITEMS: readonly ShopItem[] = [...HOMES, ...VEHICLES, ...DECOR];
export const HOME_KEYS: readonly string[] = HOMES.map((h) => h.key);
export const VEHICLE_KEYS: readonly string[] = VEHICLES.map((v) => v.key);
export const DECOR_KEYS: readonly string[] = DECOR.map((d) => d.key);
export const DEFAULT_HOME = 'home:cabana';

export const DAILY_CAP = 12;
export const MAX_DECOR = 4;
export const MAX_SEEN = 60;

export interface World {
  stars: number;
  /** Total ganado en la vida (solo para mostrar; no se gasta). */
  lifetime: number;
  /** Día del último cómputo (AAAA-MM-DD) y estrellas ganadas ese día. */
  day: string;
  earnedToday: number;
  owned: string[];
  home: string;
  vehicle: string | null;
  decor: string[];
  /** Identificadores de eventos ya premiados (idempotencia: el mismo acierto no cuenta dos veces). */
  seen: string[];
}

const num = (v: unknown, lo: number, hi: number, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.floor(v))) : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const copy = (w: World): World => ({ ...w, owned: [...w.owned], decor: [...w.decor], seen: [...w.seen] });

/* ───────────── ganar estrellas (no depende del catálogo) ───────────── */
export type EarnReason = 'acierto' | 'esfuerzo' | 'leccion' | 'social' | 'racha';
/** Qué se premia: el intento y el aprendizaje, no la rapidez. */
export const EARN: Record<EarnReason, number> = { acierto: 1, esfuerzo: 1, leccion: 2, social: 2, racha: 3 };

export interface EarnResult { world: World; gained: number; capped: boolean; duplicate: boolean }

/** Suma estrellas respetando el tope diario y sin premiar dos veces el mismo evento. `today` = 'AAAA-MM-DD'. */
export function earn(w: World, reason: EarnReason, today: string, eventId?: string): EarnResult {
  if (!DAY_RE.test(today)) throw new Error('Fecha inválida (se espera AAAA-MM-DD)');
  const base = copy(w);
  if (base.day !== today) { base.day = today; base.earnedToday = 0; }
  if (eventId && base.seen.includes(eventId)) return { world: base, gained: 0, capped: false, duplicate: true };
  const room = Math.max(0, DAILY_CAP - base.earnedToday);
  const gained = Math.min(EARN[reason], room);
  if (eventId) base.seen = [...base.seen, eventId].slice(-MAX_SEEN);
  base.stars += gained; base.lifetime += gained; base.earnedToday += gained;
  return { world: base, gained, capped: gained < EARN[reason], duplicate: false };
}

export const owns = (w: World, key: string): boolean => w.owned.includes(key);

export type BuyWhy = 'no-existe' | 'ya-lo-tienes' | 'faltan-estrellas';
export interface BuyResult { world: World; ok: boolean; why?: BuyWhy; missing?: number }

/* ───────────── la tienda (depende del catálogo que aporte el producto) ───────────── */
export interface Shop {
  readonly catalog: readonly ShopItem[];
  item(key: string): ShopItem | undefined;
  newWorld(): World;
  /** Repara un mundo guardado: lo desconocido se descarta, lo gratuito siempre es suyo, lo equipado debe ser suyo. */
  sanitize(raw: unknown): World;
  /** Compra idempotente: si ya es suyo no cobra; si faltan estrellas no cambia nada (y dice cuántas). */
  buy(w: World, key: string): BuyResult;
  setHome(w: World, key: string): World;
  setVehicle(w: World, key: string | null): World;
  /** Pone o quita un objeto de decoración (máximo MAX_DECOR a la vez). */
  toggleDecor(w: World, key: string): World;
}

/** Crea una tienda con los objetos de serie (casas, vehículos, decoración) más los que aporte el producto. */
export function createShop(extra: readonly ShopItem[] = []): Shop {
  const catalog: ShopItem[] = [];
  const index = new Map<string, ShopItem>();
  for (const it of [...extra, ...WORLD_ITEMS]) {
    if (!it || typeof it.key !== 'string' || !it.key) throw new Error('Objeto de tienda sin clave');
    if (index.has(it.key)) throw new Error('Clave repetida en la tienda: ' + it.key);
    if (!Number.isInteger(it.price) || it.price < 0) throw new Error('Precio inválido (estrellas enteras ≥ 0): ' + it.key);
    index.set(it.key, it); catalog.push(it);
  }
  const free = (): string[] => catalog.filter((i) => i.price === 0).map((i) => i.key);
  const shop: Shop = {
    catalog, item: (key) => index.get(key),
    newWorld: () => ({ stars: 0, lifetime: 0, day: '', earnedToday: 0, owned: free(), home: DEFAULT_HOME, vehicle: null, decor: [], seen: [] }),
    sanitize(raw) {
      const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const owned = Array.from(new Set([...free(), ...strs(r.owned).filter((k) => index.has(k))]));
      const has = (k: string) => owned.includes(k);
      const home = typeof r.home === 'string' && HOME_KEYS.includes(r.home) && has(r.home) ? r.home : DEFAULT_HOME;
      const vehicle = typeof r.vehicle === 'string' && VEHICLE_KEYS.includes(r.vehicle) && has(r.vehicle) ? r.vehicle : null;
      const decor = Array.from(new Set(strs(r.decor).filter((k) => DECOR_KEYS.includes(k) && has(k)))).slice(0, MAX_DECOR);
      return {
        stars: num(r.stars, 0, 100000, 0), lifetime: num(r.lifetime, 0, 10000000, 0),
        day: typeof r.day === 'string' && DAY_RE.test(r.day) ? r.day : '',
        earnedToday: num(r.earnedToday, 0, DAILY_CAP, 0), owned, home, vehicle, decor, seen: strs(r.seen).slice(-MAX_SEEN)
      };
    },
    buy(w, key) {
      const it = index.get(key);
      if (!it) return { world: w, ok: false, why: 'no-existe' };
      if (owns(w, key)) return { world: w, ok: false, why: 'ya-lo-tienes' };
      if (w.stars < it.price) return { world: w, ok: false, why: 'faltan-estrellas', missing: it.price - w.stars };
      return { world: { ...copy(w), stars: w.stars - it.price, owned: [...w.owned, key] }, ok: true };
    },
    setHome(w, key) {
      if (!HOME_KEYS.includes(key) || !owns(w, key)) throw new Error('Esa casa todavía no es tuya');
      return { ...copy(w), home: key };
    },
    setVehicle(w, key) {
      if (key !== null && (!VEHICLE_KEYS.includes(key) || !owns(w, key))) throw new Error('Ese vehículo todavía no es tuyo');
      return { ...copy(w), vehicle: key };
    },
    toggleDecor(w, key) {
      if (!DECOR_KEYS.includes(key) || !owns(w, key)) throw new Error('Ese objeto todavía no es tuyo');
      const on = w.decor.includes(key);
      if (!on && w.decor.length >= MAX_DECOR) throw new Error('Ya tienes ' + MAX_DECOR + ' objetos puestos; quita uno primero');
      return { ...copy(w), decor: on ? w.decor.filter((k) => k !== key) : [...w.decor, key] };
    }
  };
  return shop;
}
