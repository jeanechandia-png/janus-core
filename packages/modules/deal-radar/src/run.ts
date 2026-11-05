/** Revisión semanal completa: fuentes → cruce con la cesta y marcas → promos de plataformas → viajes → resumen. */
import type { DealRadarProfile } from './types.js';
import { collectOffers, type SourceAdapter } from './sources.js';
import { matchOffers } from './match.js';
import { upcomingHolidays } from './holidays.js';
import { travelSearches } from './travel.js';
import { buildDigest, type WeeklyDigest } from './digest.js';
import { tokens } from './text.js';

export async function runWeeklyReview(profile: DealRadarProfile, adapters: SourceAdapter[], now: Date = new Date()): Promise<WeeklyDigest> {
  const terms = [...new Set(profile.watchlist.flatMap((w) => (w.brand ? [w.brand] : []).concat(w.keywords.length ? w.keywords : tokens(w.name))))];
  const kinds = [...new Set(profile.watchlist.map((w) => w.kind))];
  const { offers, failed } = await collectOffers(adapters, { kinds, terms, country: profile.country });
  const matches = matchOffers(profile.watchlist, offers.filter((o) => !o.intro), profile.defaultMinDiscount, now);
  const subs = offers.filter((o) => o.intro && (o.kind === 'subscription' || o.kind === 'tool'));
  const travel = travelSearches(profile, upcomingHolidays(profile.schoolRegion, now), now);
  return buildDigest(profile, matches, subs, travel, { now, sourcesFailed: failed.map((f) => f.id) });
}
