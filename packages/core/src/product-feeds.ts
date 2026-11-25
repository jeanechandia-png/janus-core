/**
 * Centralización en JANUS (orden del Founder, 23-nov-2026): las solicitudes de contacto y el número de clientes de
 * cada producto del ecosistema (IBA, Infinity ChatBox…) llegan al dashboard del Founder, sin entrar en cada producto.
 *
 * Mismo modelo que `product-incidents.ts`: JANUS (local-first) CONSULTA el feed de solo lectura de cada producto con
 * un token propio; el producto nunca llama al aparato del Founder.
 * Privacidad (START_HERE: JANUS no es almacén de datos de clientes de IBA): las solicitudes se guardan SOLO en memoria
 * del proceso para mostrarlas; a disco no va ningún nombre, contacto ni mensaje. Lo único que se recuerda entre
 * consultas es qué identificadores ya se avisaron, para no repetir el aviso al teléfono.
 */
export interface ProductFeedSource {
  productId: string;
  name: string;
  /** URL https del feed del producto, p. ej. https://infinitybusinessassistant.nl/api/v1/janus/feed */
  url?: string;
  /** Nombre de la variable de entorno con el token (el secreto nunca va en config ni en SQLite). */
  tokenEnv?: string;
  /** Enlace para abrir el producto desde el dashboard. */
  openUrl?: string;
}

export interface ProductFeedRequest {
  id: string; createdAt: string; status: string; name: string; contact: string; message: string;
}
export interface ProductFeed {
  productId: string; generatedAt: string;
  customers: { active: number; trial: number; total: number };
  requests: ProductFeedRequest[];
}
export type ProductFeedReader = (source: ProductFeedSource) => Promise<unknown>;

const idPattern = /^[a-z0-9][a-z0-9-]{1,63}$/;
const envPattern = /^[A-Z][A-Z0-9_]{2,63}$/;
const REQUEST_STATUSES = new Set(['new', 'read', 'handled', 'closed']);
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value : '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const count = (value: unknown) => (Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000 ? value as number : NaN);

/** Valida el feed de un producto. Lo que no cumpla el contrato se rechaza entero: nunca se muestra a medias. */
export function parseProductFeed(input: unknown, productId: string): ProductFeed {
  const body = (input ?? {}) as Record<string, unknown>;
  if (body.schemaVersion !== 1 || body.productId !== productId) throw new Error('feed_invalid');
  const customers = (body.customers ?? {}) as Record<string, unknown>;
  const active = count(customers.active), trial = count(customers.trial);
  if (Number.isNaN(active) || Number.isNaN(trial)) throw new Error('feed_invalid');
  if (!Array.isArray(body.requests) || body.requests.length > 200) throw new Error('feed_invalid');
  const requests = body.requests.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const id = clip(row.id, 64), createdAt = clip(row.createdAt, 40), status = clip(row.status, 16);
    if (!id || Number.isNaN(Date.parse(createdAt)) || !REQUEST_STATUSES.has(status)) throw new Error('feed_invalid');
    return { id, createdAt, status, name: clip(row.name, 120), contact: clip(row.contact, 240), message: clip(row.message, 1000) };
  });
  const generatedAt = clip(body.generatedAt, 40);
  return { productId, generatedAt: Number.isNaN(Date.parse(generatedAt)) ? '' : generatedAt, customers: { active, trial, total: active + trial }, requests };
}

export function validateProductFeedSources(sources: ProductFeedSource[]) {
  const seen = new Set<string>();
  for (const source of sources) {
    if (!idPattern.test(source.productId) || seen.has(source.productId) || !source.name?.trim()) throw new Error('feed_source_registry_invalid');
    seen.add(source.productId);
    if (source.url !== undefined) {
      let url: URL;
      try { url = new URL(source.url); } catch { throw new Error('feed_source_registry_invalid'); }
      if (url.protocol !== 'https:' || url.username || url.password || !source.tokenEnv || !envPattern.test(source.tokenEnv)) throw new Error('feed_source_registry_invalid');
    }
    if (source.openUrl !== undefined && !/^https:\/\//.test(source.openUrl)) throw new Error('feed_source_registry_invalid');
  }
}

type FeedState = { feed?: ProductFeed; lastSuccess?: string; lastAttempt?: string; error?: string };
export interface ProductFeedNotice { productId: string; productName: string; request: ProductFeedRequest }

export class ProductFeedSync {
  private readonly states = new Map<string, FeedState>();
  private readonly notified = new Set<string>();
  private readonly baselined = new Set<string>();
  private inFlight: Promise<void> | undefined;
  private lastAttemptMs: number | undefined;
  private readonly startedAtMs: number;
  constructor(private readonly options: {
    sources: ProductFeedSource[]; read: ProductFeedReader; now?: () => Date; intervalMs?: number;
    /** Ventana para avisar de solicitudes ya existentes al arrancar JANUS (por defecto 15 min). */
    startupGraceMs?: number;
    onNew?: (notices: ProductFeedNotice[]) => void;
  }) {
    validateProductFeedSources(options.sources);
    if (options.intervalMs !== undefined && (!Number.isSafeInteger(options.intervalMs) || options.intervalMs < 30_000)) throw new Error('feed_sync_window_invalid');
    this.startedAtMs = this.now().getTime();
  }
  private now() { return this.options.now?.() ?? new Date(); }
  configured() { return this.options.sources.filter((s) => s.url); }

  async refreshIfDue(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const nowMs = this.now().getTime();
    if (!force && this.lastAttemptMs !== undefined && nowMs - this.lastAttemptMs < (this.options.intervalMs ?? 120_000)) return;
    this.lastAttemptMs = nowMs;
    this.inFlight = (async () => {
      const notices: ProductFeedNotice[] = [];
      for (const source of this.configured()) {
        const at = this.now().toISOString();
        const previous = this.states.get(source.productId) ?? {};
        try {
          const feed = parseProductFeed(await this.options.read(source), source.productId);
          this.states.set(source.productId, { feed, lastSuccess: at, lastAttempt: at });
          const firstLook = !this.baselined.has(source.productId);
          for (const request of feed.requests) {
            const key = source.productId + ':' + request.id;
            if (this.notified.has(key)) continue;
            this.notified.add(key);
            // Al arrancar no se repiten avisos antiguos: solo las solicitudes nuevas y recientes.
            const recent = Date.parse(request.createdAt) >= this.startedAtMs - (this.options.startupGraceMs ?? 15 * 60_000);
            if (request.status === 'new' && (!firstLook || recent)) notices.push({ productId: source.productId, productName: source.name, request });
          }
          this.baselined.add(source.productId);
        } catch (error) {
          const code = error instanceof Error && /^[a-z_]{3,40}$/.test(error.message) ? error.message : 'source_unavailable';
          this.states.set(source.productId, { ...previous, lastAttempt: at, error: code });
        }
      }
      if (notices.length) { try { this.options.onNew?.(notices); } catch { /* el aviso es ayuda, nunca rompe la consulta */ } }
    })().finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  snapshot() {
    const products = this.options.sources.map((source) => {
      const state = this.states.get(source.productId) ?? {};
      const feed = state.feed;
      return {
        productId: source.productId, name: source.name, openUrl: source.openUrl ?? null,
        state: !source.url ? 'not_connected' : feed ? (state.error ? 'stale' : 'live') : (state.error ?? 'pending'),
        lastSuccess: state.lastSuccess ?? null, lastAttempt: state.lastAttempt ?? null,
        generatedAt: feed?.generatedAt || null,
        customers: feed?.customers ?? null,
        requests: feed?.requests ?? [],
        newRequests: feed ? feed.requests.filter((r) => r.status === 'new').length : 0,
      };
    });
    return { products, newRequests: products.reduce((sum, p) => sum + p.newRequests, 0), customers: products.reduce((sum, p) => sum + (p.customers?.total ?? 0), 0) };
  }
}
