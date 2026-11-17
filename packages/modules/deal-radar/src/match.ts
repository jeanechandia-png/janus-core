/** Cruce de la lista de vigilancia con las ofertas observadas. */
import type { Offer, OfferMatch, WatchItem } from './types.js';
import { offerDiscount } from './promo.js';
import { jaccard, normalize, round2, tokens } from './text.js';

function sizeCompatible(a?: WatchItem['size'], b?: Offer['size']): boolean {
  if (!a || !b) return true;
  if (a.unit !== b.unit) return false;
  const r = b.amount / a.amount;
  return r >= 0.75 && r <= 1.34;
}

export function matchOne(item: WatchItem, offer: Offer): OfferMatch | undefined {
  if (item.stores && item.stores.length && !item.stores.map(normalize).includes(normalize(offer.store))) return undefined;
  let confidence = 0, reason: OfferMatch['reason'] = 'keywords';
  if (item.ean && offer.ean && item.ean === offer.ean) { confidence = 1; reason = 'ean'; }
  else {
    const sameBrand = !!item.brand && (normalize(offer.brand || '') === normalize(item.brand) || normalize(offer.title).includes(normalize(item.brand)));
    const sim = jaccard(item.keywords, tokens(offer.title));
    if (item.kind === 'grocery') {
      if (!sizeCompatible(item.size, offer.size)) return undefined;
      if (sameBrand && sim >= 0.34) { confidence = 0.6 + 0.4 * sim; reason = 'brand+name'; }
      else if (!item.brand && sim >= 0.6) { confidence = sim * 0.8; reason = 'keywords'; }
    } else if (sameBrand) {
      // Marca vigilada: basta la marca y que la categoría aparezca (o no haya categoría).
      const catHit = !item.keywords.length || item.keywords.some((k) => tokens(offer.title).includes(k));
      if (catHit) { confidence = 0.7 + 0.3 * Math.min(1, sim * 2); reason = item.keywords.length ? 'brand+name' : 'brand'; }
    }
  }
  if (confidence < 0.55) return undefined;
  const { discount, promo } = offerDiscount(offer.regularPrice, offer.price, offer.promoText, item.lastPrice);
  const unit = offer.regularPrice ?? item.lastPrice ?? offer.price ?? 0;
  const savings = round2(unit * discount * (promo ? promo.units : 1));
  return { item, offer, confidence: round2(confidence), reason, discount, savings, promo };
}

/** Todas las coincidencias que superan el umbral de descuento, la mejor oferta por producto primero. */
export function matchOffers(watchlist: WatchItem[], offers: Offer[], defaultMinDiscount = 0.15, now = new Date()): OfferMatch[] {
  const live = offers.filter((o) => !o.validUntil || new Date(o.validUntil + 'T23:59:59') >= now);
  const best = new Map<string, OfferMatch>();
  for (const item of watchlist) {
    if (item.kind === 'subscription' || item.kind === 'travel') continue;
    for (const o of live) {
      const m = matchOne(item, o);
      if (!m || m.discount < (item.minDiscount ?? defaultMinDiscount)) continue;
      const prev = best.get(item.id);
      if (!prev || m.savings > prev.savings || (m.savings === prev.savings && m.discount > prev.discount)) best.set(item.id, m);
    }
  }
  return [...best.values()].sort((a, b) => b.savings - a.savings || b.discount - a.discount);
}
