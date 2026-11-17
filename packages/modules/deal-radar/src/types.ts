/** Tipos del Radar de ofertas (pieza LEGO, sin red ni secretos). */

export type WatchKind = 'grocery' | 'fashion' | 'electronics' | 'kids' | 'subscription' | 'tool' | 'travel';
export type Scope = 'personal' | 'family' | 'business';

/** Algo que el usuario quiere vigilar: un producto de la cesta, una marca, una categoría o una plataforma. */
export interface WatchItem {
  id: string;
  kind: WatchKind;
  scope: Scope;
  /** Nombre canónico legible ("Tomate triturado Mutti 400 g"). */
  name: string;
  brand?: string;
  /** Tokens normalizados para buscar coincidencias. */
  keywords: string[];
  /** Código de barras si se conoce (coincidencia exacta). */
  ean?: string;
  /** Tamaño normalizado (gramos, mililitros o unidades). */
  size?: { amount: number; unit: 'g' | 'ml' | 'pcs' };
  /** Último precio pagado/visto, en euros. */
  lastPrice?: number;
  /** Descuento mínimo para avisar (0..1). */
  minDiscount?: number;
  /** Tallas o variantes de interés (ropa/calzado). */
  variants?: string[];
  /** Tiendas preferidas; vacío = todas. */
  stores?: string[];
  addedFrom?: 'photo' | 'manual' | 'receipt' | 'import';
}

/** Oferta observada en una fuente. Siempre con fuente y fecha: nunca se inventa. */
export interface Offer {
  id: string;
  source: string;
  store: string;
  title: string;
  brand?: string;
  ean?: string;
  url?: string;
  /** Precio normal y precio de oferta (si la fuente lo da). */
  regularPrice?: number;
  price?: number;
  /** Texto de la promoción tal cual ("1+1 gratis", "2e halve prijs", "25% korting", "2 voor 3,00"). */
  promoText?: string;
  validFrom?: string;
  validUntil?: string;
  observedAt: string;
  kind?: WatchKind;
  size?: { amount: number; unit: 'g' | 'ml' | 'pcs' };
  /** Para suscripciones/plataformas. */
  intro?: SubscriptionOffer;
}

export interface SubscriptionOffer {
  introPrice: number;
  introMonths: number;
  regularPrice: number;
  /** Meses de permanencia mínima; 0 = sin permanencia. */
  minCommitmentMonths: number;
  /** Día del mes en que se cobra (para recordar cancelar a tiempo). */
  billingDay?: number;
}

export interface PromoEffect {
  /** Descuento efectivo por unidad (0..1) suponiendo que se compra la cantidad necesaria. */
  discount: number;
  /** Unidades que hay que comprar para obtenerlo. */
  units: number;
  label: string;
}

export interface OfferMatch {
  item: WatchItem;
  offer: Offer;
  /** 0..1: confianza de que la oferta es ese producto. */
  confidence: number;
  reason: 'ean' | 'brand+name' | 'brand' | 'keywords';
  discount: number;
  /** Ahorro estimado en euros para una compra normal. */
  savings: number;
  promo?: PromoEffect;
}

export type AlertPriority = 'high' | 'medium' | 'low';
export interface DealAlert {
  id: string;
  category: WatchKind;
  scope: Scope;
  priority: AlertPriority;
  title: string;
  detail: string;
  savings: number;
  source: string;
  url?: string;
  validUntil?: string;
  observedAt: string;
}

export interface HolidayWindow {
  id: string;
  name: string;
  region: 'noord' | 'midden' | 'zuid';
  start: string;
  end: string;
  source: string;
}

export interface TravelSearch {
  windowId: string;
  windowName: string;
  mode: 'flight' | 'train' | 'bus' | 'car' | 'hotel' | 'park';
  destination: string;
  country: string;
  depart: string;
  return: string;
  nights: number;
  travellers: { adults: number; children: number; childAges: number[] };
  priority: number;
}

export interface DealRadarProfile {
  owner: string;
  locale: string;
  currency: 'EUR';
  country: 'NL';
  schoolRegion: 'noord' | 'midden' | 'zuid';
  /** Día de la revisión semanal (1 = lunes) y hora local. */
  weeklyRun: { weekday: number; hour: number; timeZone: string };
  watchlist: WatchItem[];
  travel: { origin: string; adults: number; childAges: number[]; destinations: Array<{ name: string; country: string; modes: TravelSearch['mode'][]; priority: number }> };
  /** Umbral de descuento por defecto para avisar. */
  defaultMinDiscount: number;
}
