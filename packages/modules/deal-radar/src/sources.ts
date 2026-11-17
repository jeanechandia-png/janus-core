/**
 * Fuentes de ofertas. El módulo NO accede a la red: el anfitrión implementa SourceAdapter
 * (API oficial, folleto, feed de afiliados o búsqueda web con citas) y pasa las ofertas a matchOffers().
 * Ninguna fuente se activa sin revisar sus condiciones de uso (estado inicial: 'por-confirmar').
 */
import type { Offer, WatchKind } from './types.js';

export interface SourceQuery { kinds: WatchKind[]; terms: string[]; country: 'NL' | 'DE'; since?: string }
export interface SourceAdapter { id: string; name: string; kinds: WatchKind[]; fetchOffers(q: SourceQuery): Promise<Offer[]> }

export interface SourceDescriptor { id: string; name: string; kinds: WatchKind[]; country: 'NL' | 'DE' | 'EU'; url: string; access: 'por-confirmar' }
const S = (id: string, name: string, kinds: WatchKind[], country: SourceDescriptor['country'], url: string): SourceDescriptor => ({ id, name, kinds, country, url, access: 'por-confirmar' });

/** Catálogo inicial de candidatas. Ninguna está conectada: requieren revisar ToS y elegir el método (API/feed/búsqueda). */
export const SOURCE_CATALOG: SourceDescriptor[] = [
  S('ah', 'Albert Heijn (bonus)', ['grocery'], 'NL', 'https://www.ah.nl/bonus'),
  S('jumbo', 'Jumbo (aanbiedingen)', ['grocery'], 'NL', 'https://www.jumbo.com/aanbiedingen'),
  S('lidl-nl', 'Lidl NL', ['grocery'], 'NL', 'https://www.lidl.nl'),
  S('aldi-nl', 'Aldi NL', ['grocery'], 'NL', 'https://www.aldi.nl'),
  S('dirk', 'Dirk', ['grocery'], 'NL', 'https://www.dirk.nl'),
  S('plus', 'PLUS', ['grocery'], 'NL', 'https://www.plus.nl'),
  S('kruidvat', 'Kruidvat', ['grocery', 'kids'], 'NL', 'https://www.kruidvat.nl'),
  S('zalando', 'Zalando NL', ['fashion', 'kids'], 'NL', 'https://www.zalando.nl'),
  S('nike', 'Nike NL', ['fashion', 'kids'], 'NL', 'https://www.nike.com/nl'),
  S('calvinklein', 'Calvin Klein NL', ['fashion'], 'NL', 'https://www.calvinklein.nl'),
  S('tommy', 'Tommy Hilfiger NL', ['fashion', 'kids'], 'NL', 'https://nl.tommy.com'),
  S('timberland', 'Timberland NL', ['fashion'], 'NL', 'https://www.timberland.nl'),
  S('apple-refurb', 'Apple Store NL (refurbished)', ['electronics'], 'NL', 'https://www.apple.com/nl/shop/refurbished'),
  S('coolblue', 'Coolblue', ['electronics'], 'NL', 'https://www.coolblue.nl'),
  S('ns', 'NS (trenes NL)', ['travel'], 'NL', 'https://www.ns.nl'),
  S('db', 'Deutsche Bahn (Sparpreis)', ['travel'], 'DE', 'https://www.bahn.de'),
  S('flixbus', 'FlixBus', ['travel'], 'EU', 'https://www.flixbus.nl'),
  S('transavia', 'Transavia', ['travel'], 'NL', 'https://www.transavia.com'),
  S('klm', 'KLM', ['travel'], 'NL', 'https://www.klm.nl'),
  S('booking', 'Booking.com', ['travel'], 'EU', 'https://www.booking.com'),
  S('efteling', 'Efteling', ['travel'], 'NL', 'https://www.efteling.com'),
  S('phantasialand', 'Phantasialand', ['travel'], 'DE', 'https://www.phantasialand.de'),
  S('movie-park', 'Movie Park Germany', ['travel'], 'DE', 'https://www.movieparkgermany.de')
];

/** Fuente estática (pruebas, importación manual o resultados ya verificados de una búsqueda web). */
export function staticSource(id: string, offers: Offer[]): SourceAdapter {
  return { id, name: id, kinds: [...new Set(offers.map((o) => o.kind ?? 'grocery'))], fetchOffers: async () => offers.slice() };
}

/** Ejecuta varias fuentes en paralelo; una fuente que falla no tumba la revisión (se informa). */
export async function collectOffers(adapters: SourceAdapter[], q: SourceQuery): Promise<{ offers: Offer[]; failed: Array<{ id: string; error: string }> }> {
  const res = await Promise.allSettled(adapters.map((a) => a.fetchOffers(q)));
  const offers: Offer[] = [], failed: Array<{ id: string; error: string }> = [];
  res.forEach((r, i) => { const id = adapters[i]?.id ?? '?'; if (r.status === 'fulfilled') offers.push(...r.value); else failed.push({ id, error: String(r.reason) }); });
  return { offers, failed };
}
