/** Cesta habitual: productos identificados a partir de fotos (o tickets) del supermercado. */
import type { Scope, WatchItem, WatchKind } from './types.js';
import { normalize, parseSize, tokens } from './text.js';

/** Resultado de visión que entrega el anfitrión (Janus usa su Model Gateway; aquí no hay red). */
export interface ProductRecognition {
  name: string;
  brand?: string;
  sizeText?: string;
  ean?: string;
  store?: string;
  priceSeen?: number;
  /** 0..1 confianza del modelo de visión. */
  confidence: number;
  kind?: WatchKind;
}

export interface BasketResult {
  added: WatchItem[];
  merged: WatchItem[];
  /** Fotos dudosas que conviene confirmar (no se añaden solas). */
  needsReview: ProductRecognition[];
}

const keyOf = (r: { ean?: string; brand?: string; name: string; size?: WatchItem['size'] }): string =>
  r.ean ? 'ean:' + r.ean : 'n:' + normalize((r.brand || '') + ' ' + r.name) + (r.size ? '|' + r.size.amount + r.size.unit : '');

/** Añade a la cesta lo reconocido en las fotos, sin duplicar y pidiendo confirmación si la confianza es baja. */
export function addToBasket(current: WatchItem[], recognized: ProductRecognition[], opts: { scope?: Scope; minConfidence?: number; minDiscount?: number } = {}): BasketResult {
  const min = opts.minConfidence ?? 0.7;
  const list = current.slice(), byKey = new Map(list.map((w) => [keyOf(w), w] as const));
  const added: WatchItem[] = [], merged: WatchItem[] = [], needsReview: ProductRecognition[] = [];
  for (const r of recognized) {
    if (!r.name || r.confidence < min) { needsReview.push(r); continue; }
    const size = r.sizeText ? parseSize(r.sizeText) : parseSize(r.name);
    const cand: WatchItem = {
      id: 'w-' + (r.ean || normalize((r.brand || '') + '-' + r.name).replace(/ /g, '-')).slice(0, 60),
      kind: r.kind ?? 'grocery', scope: opts.scope ?? 'family', name: r.name.trim(), brand: r.brand?.trim(),
      keywords: tokens((r.brand || '') + ' ' + r.name), ean: r.ean, size, lastPrice: r.priceSeen,
      minDiscount: opts.minDiscount, stores: r.store ? [r.store] : undefined, addedFrom: 'photo'
    };
    const k = keyOf(cand), prev = byKey.get(k);
    if (prev) {
      if (r.priceSeen && (!prev.lastPrice || r.priceSeen !== prev.lastPrice)) prev.lastPrice = r.priceSeen;
      if (r.store && !(prev.stores || []).includes(r.store)) prev.stores = (prev.stores || []).concat(r.store);
      merged.push(prev);
    } else { list.push(cand); byKey.set(k, cand); added.push(cand); }
  }
  current.splice(0, current.length, ...list);
  return { added, merged, needsReview };
}

/** Vigilancia por marca y categoría (ropa, calzado, electrónica, niños). */
export function brandWatch(brand: string, categories: string[], opts: { kind?: WatchKind; scope?: Scope; variants?: string[]; minDiscount?: number } = {}): WatchItem {
  return {
    id: 'b-' + normalize(brand + '-' + categories.join('-')).replace(/ /g, '-').slice(0, 60),
    kind: opts.kind ?? 'fashion', scope: opts.scope ?? 'personal', name: brand + ' · ' + categories.join(', '), brand,
    keywords: tokens(categories.join(' ')), variants: opts.variants, minDiscount: opts.minDiscount ?? 0.2, addedFrom: 'manual'
  };
}
