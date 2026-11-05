import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addToBasket, brandWatch, buildDigest, evaluateSubscription, matchOffers, nextWeeklyRun, parsePromo, parseSize,
  runWeeklyReview, staticSource, travelSearches, upcomingHolidays, activeSeasons, type DealRadarProfile, type Offer, type WatchItem,
} from '../packages/modules/deal-radar/src/index.js';

const NOW = new Date('2026-10-26T07:00:00Z'); // lunes

test('promociones neerlandesas: 1+1, 2e halve prijs, %, N voor X', () => {
  assert.deepEqual(parsePromo('1+1 gratis'), { discount: 0.5, units: 2, label: '1+1 gratis' });
  assert.equal(parsePromo('2+1 GRATIS')?.discount, 0.33);
  assert.equal(parsePromo('2e halve prijs')?.discount, 0.25);
  assert.equal(parsePromo('25% korting')?.discount, 0.25);
  assert.equal(parsePromo('2 voor 3,00', 2)?.discount, 0.25);
  assert.equal(parsePromo('nieuw'), undefined);
});

test('tamaños: g, kg, cl, packs', () => {
  assert.deepEqual(parseSize('Passata 400 g'), { amount: 400, unit: 'g' });
  assert.deepEqual(parseSize('1,5 l'), { amount: 1500, unit: 'ml' });
  assert.deepEqual(parseSize('6 x 33 cl'), { amount: 1980, unit: 'ml' });
});

test('cesta desde fotos: añade, fusiona duplicados y pide revisión si la confianza es baja', () => {
  const basket: WatchItem[] = [];
  const r1 = addToBasket(basket, [
    { name: 'Tomaten frito', brand: 'Mutti', sizeText: '400 g', confidence: 0.92, priceSeen: 1.89, store: 'Albert Heijn' },
    { name: 'Volle melk', brand: 'AH', sizeText: '1 l', confidence: 0.5 }
  ]);
  assert.equal(r1.added.length, 1); assert.equal(r1.needsReview.length, 1);
  const r2 = addToBasket(basket, [{ name: 'Tomaten frito', brand: 'Mutti', sizeText: '400g', confidence: 0.9, priceSeen: 1.99, store: 'Jumbo' }]);
  assert.equal(r2.merged.length, 1); assert.equal(basket.length, 1);
  assert.equal(basket[0]?.lastPrice, 1.99); assert.deepEqual(basket[0]?.stores, ['Albert Heijn', 'Jumbo']);
});

const offers: Offer[] = [
  { id: 'o1', source: 'test', store: 'Albert Heijn', title: 'Mutti tomaten frito 400 g', brand: 'Mutti', regularPrice: 1.99, promoText: '2e halve prijs', observedAt: '2026-10-26', validUntil: '2026-11-01', size: { amount: 400, unit: 'g' } },
  { id: 'o2', source: 'test', store: 'Albert Heijn', title: 'Mutti tomaten frito 400 g', brand: 'Mutti', regularPrice: 1.99, price: 0.99, observedAt: '2026-10-26', validUntil: '2026-11-01', size: { amount: 400, unit: 'g' } },
  { id: 'o3', source: 'test', store: 'Zalando', title: 'Calvin Klein boxershorts 3-pack', brand: 'Calvin Klein', regularPrice: 49.95, price: 29.95, observedAt: '2026-10-26', kind: 'fashion' },
  { id: 'o4', source: 'test', store: 'Zalando', title: 'Calvin Klein jeans', brand: 'Calvin Klein', regularPrice: 99.95, price: 89.95, observedAt: '2026-10-26', kind: 'fashion' },
  { id: 'o5', source: 'test', store: 'Albert Heijn', title: 'Mutti passata 700 g', brand: 'Mutti', regularPrice: 2.49, promoText: '1+1 gratis', observedAt: '2026-10-26', size: { amount: 700, unit: 'g' } }
];

test('cruce: elige la mejor oferta, respeta tamaño y umbral, marca por categoría', () => {
  const basket: WatchItem[] = [];
  addToBasket(basket, [{ name: 'Tomaten frito', brand: 'Mutti', sizeText: '400 g', confidence: 0.95, store: 'Albert Heijn' }]);
  const wl = basket.concat(brandWatch('Calvin Klein', ['boxershorts'], { minDiscount: 0.2 }));
  const m = matchOffers(wl, offers, 0.15, NOW);
  const tomato = m.find((x) => x.item.kind === 'grocery');
  assert.equal(tomato?.offer.id, 'o2', 'mitad de precio gana a 2.ª a mitad');
  assert.equal(tomato?.discount, 0.5);
  const ck = m.find((x) => x.item.kind === 'fashion');
  assert.equal(ck?.offer.id, 'o3', 'los vaqueros (10%) no llegan al 20%');
  assert.ok(!m.some((x) => x.offer.id === 'o5'), 'passata 700 g no es el mismo tamaño');
});

test('suscripciones: sin permanencia se aprovecha y avisa cuándo cancelar', () => {
  const v = evaluateSubscription({ introPrice: 5, introMonths: 1, regularPrice: 12.99, minCommitmentMonths: 0 }, 1, 0, new Date('2026-10-22T00:00:00Z'));
  assert.equal(v.verdict, 'aprovechar'); assert.equal(v.savings, 7.99); assert.equal(v.cancelBefore, '2026-11-20');
  const w = evaluateSubscription({ introPrice: 5, introMonths: 1, regularPrice: 12.99, minCommitmentMonths: 12 }, 1);
  assert.equal(w.noCommitment, false); assert.notEqual(w.verdict, 'aprovechar');
});

test('vacaciones escolares región zuid (Arnhem/Lingewaard) según rijksoverheid 2026-2027', () => {
  const h = upcomingHolidays('zuid', new Date('2026-10-22T10:00:00Z'));
  assert.equal(h[0]?.id, 'herfst-2026-zuid'); assert.equal(h[0]?.start, '2026-10-17'); assert.equal(h[0]?.end, '2026-10-25');
  assert.equal(h.find((x) => x.id === 'voorjaar-2027-zuid')?.start, '2027-02-13');
  assert.equal(h.find((x) => x.id === 'zomer-2027-zuid')?.end, '2027-09-05');
});

const profile: DealRadarProfile = {
  owner: 'demo', locale: 'es', currency: 'EUR', country: 'NL', schoolRegion: 'zuid', weeklyRun: { weekday: 1, hour: 8, timeZone: 'Europe/Amsterdam' },
  watchlist: [], defaultMinDiscount: 0.15,
  travel: { origin: 'Arnhem', adults: 1, childAges: [10], destinations: [{ name: 'Phantasialand', country: 'DE', modes: ['park', 'hotel'], priority: 1 }, { name: 'Efteling', country: 'NL', modes: ['park'], priority: 0.9 }] }
};

test('viajes: búsquedas por ventana de vacaciones con niña de 10 años', () => {
  const t = travelSearches(profile, upcomingHolidays('zuid', NOW), NOW);
  assert.ok(t.length > 0);
  assert.ok(t.every((x) => x.travellers.childAges[0] === 10));
  assert.equal(t.filter((x) => x.windowId === 'kerst-2026-zuid' && x.destination === 'Phantasialand').length, 2);
});

test('revisión semanal: lunes 08:00 Amsterdam y temporadas de rebajas', () => {
  const next = nextWeeklyRun(new Date('2026-10-22T10:00:00Z'));
  assert.equal(next.toISOString(), '2026-10-26T07:00:00.000Z');
  assert.ok(activeSeasons(new Date('2026-11-10T00:00:00Z')).some((s) => s.id === 'black-friday'));
});

test('runWeeklyReview + resumen: cabecera honesta, ahorro y fuentes caídas', async () => {
  const p: DealRadarProfile = { ...profile, watchlist: [] };
  addToBasket(p.watchlist, [{ name: 'Tomaten frito', brand: 'Mutti', sizeText: '400 g', confidence: 0.95 }]);
  p.watchlist.push(brandWatch('Calvin Klein', ['boxershorts']));
  const subs: Offer[] = [{ id: 's1', source: 'test', store: 'Plataforma X', title: 'Plataforma X Pro', kind: 'tool', observedAt: '2026-10-26', intro: { introPrice: 5, introMonths: 1, regularPrice: 19, minCommitmentMonths: 0 } }];
  const broken = { id: 'caida', name: 'caida', kinds: ['grocery' as const], fetchOffers: async () => { throw new Error('503'); } };
  const d = await runWeeklyReview(p, [staticSource('test', offers.concat(subs)), broken], NOW);
  assert.equal(d.basketOnSale, 1);
  assert.match(d.headline, /1 producto de tu cesta en oferta/);
  assert.ok(d.alerts.every((a) => a.source && a.observedAt), 'cada aviso lleva fuente y fecha');
  assert.deepEqual(d.sourcesFailed, ['caida']);
  assert.ok(d.subscriptions.length === 1 && d.alerts.some((a) => a.scope === 'business'));
  const empty = buildDigest(p, [], [], [], { now: NOW });
  assert.match(empty.headline, /Sin ofertas/);
});
