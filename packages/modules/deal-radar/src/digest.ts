/** Resumen semanal: lo que se enseña en el dashboard y se avisa. Cada aviso conserva fuente y fecha. */
import type { DealAlert, DealRadarProfile, Offer, OfferMatch, TravelSearch } from './types.js';
import { evaluateSubscription, type SubscriptionVerdict } from './subscriptions.js';
import { euro, round2 } from './text.js';

export interface WeeklyDigest {
  generatedAt: string;
  headline: string;
  basketOnSale: number;
  totalSavings: number;
  alerts: DealAlert[];
  subscriptions: Array<{ offer: Offer; verdict: SubscriptionVerdict }>;
  travel: TravelSearch[];
  sourcesFailed: string[];
}

const prio = (savings: number, discount: number): DealAlert['priority'] => (savings >= 10 || discount >= 0.45 ? 'high' : savings >= 3 || discount >= 0.25 ? 'medium' : 'low');

export function matchToAlert(m: OfferMatch): DealAlert {
  const pct = Math.round(m.discount * 100);
  const how = m.promo ? m.promo.label : pct + '% menos';
  return {
    id: 'a-' + m.item.id + '-' + m.offer.id, category: m.item.kind, scope: m.item.scope, priority: prio(m.savings, m.discount),
    title: m.item.name + ' — ' + how + ' en ' + m.offer.store,
    detail: (m.offer.price != null ? euro(m.offer.price) + (m.offer.regularPrice ? ' (antes ' + euro(m.offer.regularPrice) + ')' : '') + ' · ' : '') + 'ahorro aprox. ' + euro(m.savings) + (m.offer.validUntil ? ' · hasta ' + m.offer.validUntil : ''),
    savings: m.savings, source: m.offer.source, url: m.offer.url, validUntil: m.offer.validUntil, observedAt: m.offer.observedAt
  };
}

export function buildDigest(profile: DealRadarProfile, matches: OfferMatch[], subscriptionOffers: Offer[], travel: TravelSearch[], opts: { now?: Date; sourcesFailed?: string[]; horizonMonths?: number } = {}): WeeklyDigest {
  const now = opts.now ?? new Date();
  const alerts = matches.map(matchToAlert);
  const subs = subscriptionOffers.filter((o) => o.intro).map((o) => ({ offer: o, verdict: evaluateSubscription(o.intro!, opts.horizonMonths ?? 3, 0, now) })).filter((s) => s.verdict.verdict !== 'no-compensa');
  subs.forEach((s) => alerts.push({
    id: 's-' + s.offer.id, category: s.offer.kind ?? 'subscription', scope: s.offer.kind === 'tool' ? 'business' : 'personal', priority: s.verdict.verdict === 'aprovechar' ? 'medium' : 'low',
    title: s.offer.title + ' — ' + euro(s.offer.intro!.introPrice) + ' los primeros ' + s.offer.intro!.introMonths + ' mes(es)',
    detail: s.verdict.note + ' Ahorro estimado ' + euro(s.verdict.savings) + '.', savings: s.verdict.savings, source: s.offer.source, url: s.offer.url, validUntil: s.offer.validUntil, observedAt: s.offer.observedAt
  }));
  const order = { high: 0, medium: 1, low: 2 } as const;
  alerts.sort((a, b) => order[a.priority] - order[b.priority] || b.savings - a.savings);
  const basketOnSale = matches.filter((m) => m.item.kind === 'grocery').length;
  const totalSavings = round2(alerts.reduce((a, x) => a + Math.max(0, x.savings), 0));
  const parts: string[] = [];
  if (basketOnSale) parts.push(basketOnSale + (basketOnSale === 1 ? ' producto' : ' productos') + ' de tu cesta en oferta');
  const others = alerts.length - basketOnSale - subs.length;
  if (others > 0) parts.push(others + ' de tus marcas');
  if (subs.length) parts.push(subs.length + (subs.length === 1 ? ' promoción' : ' promociones') + ' de plataformas');
  const headline = parts.length ? parts.join(' · ') + ' · ahorro aprox. ' + euro(totalSavings) : 'Sin ofertas que superen tus umbrales esta semana';
  return { generatedAt: now.toISOString(), headline, basketOnSale, totalSavings, alerts, subscriptions: subs, travel: travel.slice(0, 12), sourcesFailed: opts.sourcesFailed ?? [] };
}
