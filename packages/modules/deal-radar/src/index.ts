/** Radar de ofertas — pieza LEGO reutilizable (sin red, sin secretos, sin dependencias de Janus). */
export type {
  AlertPriority, DealAlert, DealRadarProfile, HolidayWindow, Offer, OfferMatch, PromoEffect, Scope, SubscriptionOffer, TravelSearch, WatchItem, WatchKind,
} from './types.js';
export { normalize, parseSize, tokens, jaccard, euro } from './text.js';
export { parsePromo, offerDiscount } from './promo.js';
export { addToBasket, brandWatch } from './basket.js';
export type { BasketResult, ProductRecognition } from './basket.js';
export { matchOne, matchOffers } from './match.js';
export { evaluateSubscription } from './subscriptions.js';
export type { SubscriptionVerdict } from './subscriptions.js';
export { upcomingHolidays, addHolidayWindows, daysBetween } from './holidays.js';
export { travelSearches, LEAD_DAYS } from './travel.js';
export { nextWeeklyRun, activeSeasons, SALES_SEASONS, zonedTime } from './schedule.js';
export { SOURCE_CATALOG, staticSource, collectOffers } from './sources.js';
export type { SourceAdapter, SourceDescriptor, SourceQuery } from './sources.js';
export { buildDigest, matchToAlert } from './digest.js';
export type { WeeklyDigest } from './digest.js';
export { runWeeklyReview } from './run.js';
