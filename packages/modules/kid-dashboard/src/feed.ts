import { isValidYmd, normalizeText, addDays } from './time.js';
import { stripLinks } from './safety.js';

/**
 * Intereses y «novedades para ti» (ofertas, planes, pelis, productos). Regla de oro: NADA que venga de la web llega a la
 * niña sin aprobación del tutor. Janus (o el tutor) PROPONE; el tutor APRUEBA; solo lo aprobado y vigente se muestra.
 */

export interface Interest { id: string; label: string; keywords: string[] }

export const DEFAULT_INTERESTS: readonly Interest[] = Object.freeze([
  { id: 'roblox', label: 'Roblox', keywords: ['roblox'] },
  { id: 'stitch', label: 'Stitch', keywords: ['stitch', 'lilo'] },
  { id: 'baile', label: 'Baile', keywords: ['baile', 'bailar', 'coreografia', 'kpop', 'k-pop', 'dance'] },
  { id: 'coro-musica', label: 'Música y coros', keywords: ['coro', 'cantar', 'musica', 'canciones'] },
]);

export const FEED_KINDS = ['oferta', 'evento', 'peli', 'producto', 'plan'] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export interface FeedItem {
  id: string;
  kind: FeedKind;
  title: string;
  place?: string;
  /** Solo https y sin credenciales; se muestra como texto para el tutor, nunca como enlace pulsable para la niña. */
  url?: string;
  from?: string;
  until?: string;
  priceCents?: number;
  /** Quién lo propuso: «tutor», «janus-investigacion»… */
  source: string;
  interestId?: string;
  status: 'pending' | 'approved' | 'rejected';
  proposedAt: string;
  decidedAt?: string;
}

export type FeedValidation = { ok: true; item: Omit<FeedItem, 'id' | 'status' | 'proposedAt' | 'decidedAt'> } | { ok: false; message: string };

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString().slice(0, 300);
  } catch { return null; }
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? stripLinks(value).replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function normalizeFeedInput(input: unknown, source: string, interests: readonly Interest[]): FeedValidation {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const title = text(raw.title, 120);
  if (!title) return { ok: false, message: 'Falta el título.' };
  if (typeof raw.kind !== 'string' || !(FEED_KINDS as readonly string[]).includes(raw.kind)) return { ok: false, message: 'Tipo no válido.' };
  for (const key of ['from', 'until'] as const) if (raw[key] !== undefined && raw[key] !== '' && !isValidYmd(raw[key])) return { ok: false, message: `La fecha «${key}» no es válida.` };
  if (typeof raw.from === 'string' && typeof raw.until === 'string' && raw.from && raw.until && raw.until < raw.from) return { ok: false, message: 'La fecha final es anterior a la inicial.' };
  if (raw.url !== undefined && raw.url !== '' && !safeHttpsUrl(raw.url)) return { ok: false, message: 'El enlace debe ser https y sin usuario ni contraseña.' };
  const price = raw.priceCents === undefined ? undefined : Number(raw.priceCents);
  if (price !== undefined && (!Number.isInteger(price) || price < 0 || price > 1_000_000)) return { ok: false, message: 'El precio no es válido.' };
  const interestId = typeof raw.interestId === 'string' && interests.some((interest) => interest.id === raw.interestId) ? raw.interestId : undefined;
  const place = text(raw.place, 80);
  const url = safeHttpsUrl(raw.url);
  return {
    ok: true,
    item: {
      kind: raw.kind as FeedKind,
      title,
      ...(place ? { place } : {}),
      ...(url ? { url } : {}),
      ...(typeof raw.from === 'string' && raw.from ? { from: raw.from } : {}),
      ...(typeof raw.until === 'string' && raw.until ? { until: raw.until } : {}),
      ...(price !== undefined ? { priceCents: price } : {}),
      source: text(source, 40) || 'tutor',
      ...(interestId ? { interestId } : {}),
    },
  };
}

export function decideFeedItem(items: readonly FeedItem[], id: string, decision: 'approved' | 'rejected', nowIso: string): FeedItem[] {
  return items.map((item) => (item.id === id && item.status === 'pending' ? { ...item, status: decision, decidedAt: nowIso } : item));
}

/** Solo lo APROBADO y vigente hoy (o que empieza en los próximos 14 días). Lo vencido deja de verse solo. */
export function visibleFeed(items: readonly FeedItem[], today: string): FeedItem[] {
  const horizon = addDays(today, 14);
  return items
    .filter((item) => item.status === 'approved' && (!item.until || item.until >= today) && (!item.from || item.from <= horizon))
    .sort((a, b) => (a.from ?? '0000').localeCompare(b.from ?? '0000') || a.title.localeCompare(b.title));
}

export function matchInterests(input: string, interests: readonly Interest[]): string[] {
  const norm = normalizeText(input);
  return interests.filter((interest) => interest.keywords.some((keyword) => norm.includes(normalizeText(keyword)))).map((interest) => interest.id);
}

export function normalizeInterestInput(input: unknown): { ok: true; interest: Omit<Interest, 'id'> } | { ok: false; message: string } {
  if (!input || typeof input !== 'object') return { ok: false, message: 'Datos no válidos.' };
  const raw = input as Record<string, unknown>;
  const label = text(raw.label, 30);
  if (!label) return { ok: false, message: 'Ponle un nombre al interés.' };
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [label]).map((word) => text(word, 30).toLowerCase()).filter(Boolean).slice(0, 8);
  return { ok: true, interest: { label, keywords: keywords.length > 0 ? keywords : [label.toLowerCase()] } };
}
