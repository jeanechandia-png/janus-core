/**
 * Dashboard del Founder: composición pura (sin red, sin secretos) del panel de
 * "una sola vista". El servidor aporta las lecturas reales; este módulo las
 * normaliza y NUNCA inventa un dato: cada tarjeta lleva un estado honesto.
 *
 * Ámbitos: `work` (Infinity Seed Group) y `personal` van en bloques separados
 * dentro de la misma vista; no se mezclan en una misma lista.
 */

export type DataState =
  | 'live' // observado ahora por Janus
  | 'declared' // declarado por el Founder, no observado
  | 'unconfigured' // falta configuración/llave
  | 'pending' // aún no aplica (p. ej. empresa sin registrar)
  | 'error'; // se intentó leer y falló

export type AgendaScope = 'work' | 'personal' | 'kendra';

export interface AgendaEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  scope: AgendaScope;
  calendar: string;
}

export interface AgendaBlock {
  scope: AgendaScope;
  state: DataState;
  reason?: string;
  today: AgendaEvent[];
  tomorrow: AgendaEvent[];
}

export interface ProbeResult {
  label: string;
  state: DataState;
  detail?: string;
  observedAt?: string;
}

export interface DeclaredStatus {
  label: string;
  by: string;
  at: string;
}

export interface ProductCard {
  id: string;
  name: string;
  summary: string;
  declared: DeclaredStatus | null;
  probes: ProbeResult[];
  /** Resumen honesto: el peor estado observado, o `declared` si solo hay declaración. */
  state: DataState;
}

export interface SalesCard {
  state: DataState;
  currency: 'EUR';
  reason: string;
  today: number | null;
  month: number | null;
}

export interface IntegrationRow {
  id: string;
  name: string;
  state: 'key_present' | 'no_key';
  validatedLive: false;
}

export interface AttentionItem {
  level: 'high' | 'medium' | 'low';
  text: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  timeZone: string;
  date: string;
  agenda: Record<AgendaScope, AgendaBlock>;
  products: ProductCard[];
  sales: SalesCard;
  janus: {
    approvalsPending: number;
    confidence: { mode: string; value: number; samples: number } | null;
    capabilities: { available: number; total: number };
  };
  integrations: IntegrationRow[];
  social: SocialBlock;
  attention: AttentionItem[];
}

export interface ProductDefinition {
  id: string;
  name: string;
  summary: string;
  declared: DeclaredStatus | null;
}

const FOUNDER_2026_10_13 = { by: 'Founder', at: '2026-10-13' } as const;

/** Estados declarados por el Founder (HANDOFF de ChatBox, 2026-10-13). No son observaciones. */
export const PRODUCT_CATALOG: readonly ProductDefinition[] = [
  {
    id: 'infinityseed-group',
    name: 'Infinity Seed Group',
    summary: 'Web corporativa y asesor del grupo',
    declared: null,
  },
  {
    id: 'chatbox',
    name: 'Infinity ChatBox',
    summary: 'SaaS multi-tenant de asistentes de venta',
    declared: { label: 'Terminado', ...FOUNDER_2026_10_13 },
  },
  {
    id: 'janus',
    name: 'Janus',
    summary: 'Asistente personal y operativo',
    declared: { label: 'En desarrollo', ...FOUNDER_2026_10_13 },
  },
  {
    id: 'iba',
    name: 'Infinity Business Assistant',
    summary: 'Asistente de negocio (IBA)',
    declared: { label: 'Terminado', ...FOUNDER_2026_10_13 },
  },
  {
    id: 'api',
    name: 'API',
    summary: 'API de Infinity',
    declared: { label: 'En desarrollo', ...FOUNDER_2026_10_13 },
  },
  {
    id: 'tribuna',
    name: 'Tribuna',
    summary: 'Fútbol y dardos terminados; F1, MotoGP y vóley en desarrollo',
    declared: { label: 'Parcial', ...FOUNDER_2026_10_13 },
  },
];

const STATE_RANK: Record<DataState, number> = {
  error: 4,
  unconfigured: 3,
  pending: 2,
  declared: 1,
  live: 0,
};

export function summarizeProductState(
  declared: DeclaredStatus | null,
  probes: readonly ProbeResult[],
): DataState {
  const observed = probes.filter((probe) => probe.state !== 'declared');
  if (observed.length === 0) return declared ? 'declared' : 'unconfigured';
  const anyError = observed.some((probe) => probe.state === 'error');
  if (anyError) return 'error';
  if (observed.every((probe) => probe.state === 'live')) return 'live';
  return observed.reduce<DataState>(
    (worst, probe) => (STATE_RANK[probe.state] > STATE_RANK[worst] ? probe.state : worst),
    'live',
  );
}

export function buildProductCards(
  probesByProduct: Readonly<Record<string, readonly ProbeResult[]>>,
  catalog: readonly ProductDefinition[] = PRODUCT_CATALOG,
): ProductCard[] {
  return catalog.map((product) => {
    const probes = [...(probesByProduct[product.id] ?? [])];
    return {
      id: product.id,
      name: product.name,
      summary: product.summary,
      declared: product.declared,
      probes,
      state: summarizeProductState(product.declared, probes),
    };
  });
}

/** Ventas: sin fuente conectada no hay cifras. Nunca se estima ni se rellena. */
export function pendingSales(reason?: string): SalesCard {
  return {
    state: 'pending',
    currency: 'EUR',
    reason:
      reason
      ?? 'Empresa aún sin registrar: no hay fuente de ventas conectada. Cuando exista, aquí aparecerán ingresos reales.',
    today: null,
    month: null,
  };
}

interface RawCalendarEvent {
  id?: unknown;
  status?: unknown;
  summary?: unknown;
  location?: unknown;
  start?: { dateTime?: unknown; date?: unknown } | null;
  end?: { dateTime?: unknown; date?: unknown } | null;
}

export function normalizeCalendarEvents(
  raw: readonly unknown[],
  scope: AgendaScope,
  calendar: string,
): AgendaEvent[] {
  const events: AgendaEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const event = item as RawCalendarEvent;
    if (event.status === 'cancelled') continue;
    const startDateTime = typeof event.start?.dateTime === 'string' ? event.start.dateTime : null;
    const startDate = typeof event.start?.date === 'string' ? event.start.date : null;
    const start = startDateTime ?? startDate;
    if (!start) continue;
    const endDateTime = typeof event.end?.dateTime === 'string' ? event.end.dateTime : null;
    const endDate = typeof event.end?.date === 'string' ? event.end.date : null;
    events.push({
      id: typeof event.id === 'string' ? event.id : `${scope}:${start}`,
      title: typeof event.summary === 'string' && event.summary.trim() ? event.summary.trim() : '(sin título)',
      start,
      end: endDateTime ?? endDate,
      allDay: !startDateTime,
      location: typeof event.location === 'string' && event.location.trim() ? event.location.trim() : null,
      scope,
      calendar,
    });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start));
}

/** Fecha local YYYY-MM-DD en una zona horaria IANA. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  return moved.toISOString().slice(0, 10);
}

function eventLocalDate(event: AgendaEvent, timeZone: string): string {
  if (event.allDay) return event.start.slice(0, 10);
  return localDate(new Date(event.start), timeZone);
}

export function splitAgendaByDay(
  events: readonly AgendaEvent[],
  today: string,
  timeZone: string,
): { today: AgendaEvent[]; tomorrow: AgendaEvent[] } {
  const tomorrow = addDays(today, 1);
  const result = { today: [] as AgendaEvent[], tomorrow: [] as AgendaEvent[] };
  for (const event of events) {
    const day = eventLocalDate(event, timeZone);
    if (day === today) result.today.push(event);
    else if (day === tomorrow) result.tomorrow.push(event);
  }
  return result;
}

export function agendaBlock(
  scope: AgendaScope,
  input:
    | { kind: 'unconfigured'; reason: string }
    | { kind: 'error'; reason: string }
    | { kind: 'events'; events: readonly AgendaEvent[]; today: string; timeZone: string },
): AgendaBlock {
  if (input.kind === 'unconfigured') {
    return { scope, state: 'unconfigured', reason: input.reason, today: [], tomorrow: [] };
  }
  if (input.kind === 'error') {
    return { scope, state: 'error', reason: input.reason, today: [], tomorrow: [] };
  }
  const split = splitAgendaByDay(input.events, input.today, input.timeZone);
  return { scope, state: 'live', today: split.today, tomorrow: split.tomorrow };
}

export function deriveAttention(input: {
  approvalsPending: number;
  products: readonly ProductCard[];
  agenda: Record<AgendaScope, AgendaBlock>;
  integrationsWithoutKey: number;
  integrationsTotal: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  if (input.approvalsPending > 0) {
    items.push({
      level: 'high',
      text: `${input.approvalsPending} ${input.approvalsPending === 1 ? 'acción espera' : 'acciones esperan'} tu visto bueno.`,
    });
  }
  for (const product of input.products) {
    if (product.state === 'error') {
      const failed = product.probes.find((probe) => probe.state === 'error');
      items.push({
        level: 'high',
        text: `${product.name}: no se pudo comprobar${failed?.detail ? ` (${failed.detail})` : ''}.`,
      });
    }
  }
  for (const scope of ['work', 'personal'] as const) {
    const block = input.agenda[scope];
    if (block.state === 'live' && block.today.length > 0) {
      const label = scope === 'work' ? 'de la empresa' : 'personales';
      items.push({
        level: 'medium',
        text: `Hoy tienes ${block.today.length} ${block.today.length === 1 ? 'cita' : 'citas'} ${label}.`,
      });
    }
  }
  const kendra = input.agenda.kendra;
  if (kendra && kendra.state === 'live' && kendra.today.length > 0) {
    items.push({
      level: 'medium',
      text: `Kendra tiene hoy ${kendra.today.length === 1 ? `«${kendra.today[0]!.title}»` : `${kendra.today.length} cosas en agenda`}.`,
    });
  }
  if (input.integrationsWithoutKey > 0) {
    items.push({
      level: 'low',
      text: `${input.integrationsWithoutKey} de ${input.integrationsTotal} integraciones sin llave configurada.`,
    });
  }
  const order = { high: 0, medium: 1, low: 2 } as const;
  return items.sort((a, b) => order[a.level] - order[b.level]);
}

export function buildDashboardSnapshot(input: {
  now: Date;
  timeZone: string;
  agenda: Record<AgendaScope, AgendaBlock>;
  products: ProductCard[];
  sales: SalesCard;
  janus: DashboardSnapshot['janus'];
  integrations: IntegrationRow[];
  social?: SocialBlock;
}): DashboardSnapshot {
  const withoutKey = input.integrations.filter((row) => row.state === 'no_key').length;
  return {
    generatedAt: input.now.toISOString(),
    timeZone: input.timeZone,
    date: localDate(input.now, input.timeZone),
    agenda: input.agenda,
    products: input.products,
    sales: input.sales,
    janus: input.janus,
    integrations: input.integrations,
    social: input.social ?? socialUnconfigured(),
    attention: deriveAttention({
      approvalsPending: input.janus.approvalsPending,
      products: input.products,
      agenda: input.agenda,
      integrationsWithoutKey: withoutKey,
      integrationsTotal: input.integrations.length,
    }),
  };
}


// ---------------------------------------------------------------------------
// Redes (Instagram vía Meta Graph API, solo lectura). Seguidores, meta de
// monetización definida por el Founder y rendimiento de reels por producto.
// ---------------------------------------------------------------------------

export interface SocialAccountConfig {
  id: string;
  igUserId: string;
  label: string;
  productId: string;
  /** Meta de seguidores definida por el Founder; NO es un umbral oficial de Meta. */
  followerGoal: number | null;
}

export interface FollowerPoint {
  date: string;
  followers: number;
}

export interface ReelRow {
  id: string;
  title: string;
  permalink: string | null;
  publishedAt: string | null;
  productId: string;
  attribution: 'cuenta' | 'hashtag';
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
}

export interface SocialAccountCard {
  id: string;
  label: string;
  username: string | null;
  productId: string;
  state: DataState;
  reason?: string;
  followers: number | null;
  goal: number | null;
  progress: number | null;
  delta7d: number | null;
  history: FollowerPoint[];
  reels: ReelRow[];
}

export interface SocialBlock {
  state: DataState;
  reason?: string;
  accounts: SocialAccountCard[];
}

export function socialUnconfigured(reason?: string): SocialBlock {
  return {
    state: 'unconfigured',
    reason: reason
      ?? 'Define JANUS_SOCIAL_ACCOUNTS (cuentas de Instagram profesional) y las llaves de Meta para seguir seguidores y reels.',
    accounts: [],
  };
}

export function parseSocialAccounts(raw: string | undefined): SocialAccountConfig[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JANUS_SOCIAL_ACCOUNTS must be a JSON array');
  }
  if (!Array.isArray(parsed)) throw new Error('JANUS_SOCIAL_ACCOUNTS must be a JSON array');
  const accounts: SocialAccountConfig[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const igUserId = typeof record.igUserId === 'string' ? record.igUserId.trim() : '';
    if (!/^[a-z0-9._-]{1,60}$/i.test(id) || !/^\d{5,30}$/.test(igUserId)) continue;
    const goal = typeof record.followerGoal === 'number' && Number.isInteger(record.followerGoal) && record.followerGoal > 0
      ? record.followerGoal
      : null;
    accounts.push({
      id,
      igUserId,
      label: typeof record.label === 'string' && record.label.trim() ? record.label.trim().slice(0, 60) : id,
      productId: typeof record.productId === 'string' && record.productId.trim() ? record.productId.trim() : 'infinityseed-group',
      followerGoal: goal,
    });
  }
  return accounts;
}

/** Hashtag → producto. Un reel de la cuenta del grupo con #chatbox cuenta para ChatBox. */
export const HASHTAG_PRODUCTS: Readonly<Record<string, string>> = {
  chatbox: 'chatbox',
  infinitychatbox: 'chatbox',
  iba: 'iba',
  infinitybusinessassistant: 'iba',
  janus: 'janus',
  tribuna: 'tribuna',
  latribunavirtual: 'tribuna',
  infinityseed: 'infinityseed-group',
  infinityseedgroup: 'infinityseed-group',
};

export function attributeReel(caption: string, accountProduct: string): { productId: string; attribution: 'cuenta' | 'hashtag' } {
  const tags = caption.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/#[a-z0-9_]+/g) ?? [];
  for (const tag of tags) {
    const product = HASHTAG_PRODUCTS[tag.slice(1).replace(/_/g, '')];
    if (product && product !== accountProduct) return { productId: product, attribution: 'hashtag' };
  }
  return { productId: accountProduct, attribution: 'cuenta' };
}

function reelTitle(caption: string): string {
  const firstLine = caption.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  const clean = firstLine.replace(/#[\p{L}0-9_]+/gu, '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Reel sin texto';
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
}

function metricValue(metrics: Record<string, unknown>, name: string): number | null {
  const value = metrics[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeReels(raw: readonly unknown[], accountProduct: string): ReelRow[] {
  const rows: ReelRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const reel = item as Record<string, unknown>;
    if (typeof reel.id !== 'string') continue;
    const caption = typeof reel.caption === 'string' ? reel.caption : '';
    const metrics = reel.metrics && typeof reel.metrics === 'object' ? reel.metrics as Record<string, unknown> : {};
    const { productId, attribution } = attributeReel(caption, accountProduct);
    rows.push({
      id: reel.id,
      title: reelTitle(caption),
      permalink: typeof reel.permalink === 'string' && reel.permalink.startsWith('https://') ? reel.permalink : null,
      publishedAt: typeof reel.publishedAt === 'string' ? reel.publishedAt : null,
      productId,
      attribution,
      views: metricValue(metrics, 'views'),
      reach: metricValue(metrics, 'reach'),
      likes: metricValue(metrics, 'likes'),
      comments: metricValue(metrics, 'comments'),
      shares: metricValue(metrics, 'shares'),
      saved: metricValue(metrics, 'saved'),
    });
  }
  return rows.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}

/** Una foto por día (la última del día gana), ordenada y acotada a `days`. */
export function followerHistory(points: readonly FollowerPoint[], days = 90): FollowerPoint[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.followers)) byDate.set(point.date, point.followers);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-days)
    .map(([date, followers]) => ({ date, followers }));
}

export function followerDelta(history: readonly FollowerPoint[], days: number): number | null {
  if (history.length < 2) return null;
  const last = history[history.length - 1]!;
  const cutoff = addDays(last.date, -days);
  const base = [...history].reverse().find((point) => point.date <= cutoff) ?? history[0]!;
  if (base.date === last.date) return null;
  return last.followers - base.followers;
}

export function buildSocialAccountCard(input: {
  config: SocialAccountConfig;
  state: DataState;
  reason?: string;
  username?: string | null;
  followers?: number | null;
  history?: readonly FollowerPoint[];
  reels?: readonly ReelRow[];
}): SocialAccountCard {
  const history = followerHistory(input.history ?? []);
  const followers = input.followers ?? history.at(-1)?.followers ?? null;
  const goal = input.config.followerGoal;
  return {
    id: input.config.id,
    label: input.config.label,
    username: input.username ?? null,
    productId: input.config.productId,
    state: input.state,
    ...(input.reason ? { reason: input.reason } : {}),
    followers,
    goal,
    progress: goal && followers != null ? Math.min(1, followers / goal) : null,
    delta7d: followerDelta(history, 7),
    history,
    reels: [...(input.reels ?? [])],
  };
}

export function socialBlock(accounts: SocialAccountCard[], reason?: string): SocialBlock {
  if (accounts.length === 0) return socialUnconfigured(reason);
  return {
    state: summarizeProductState(null, accounts.map((account) => ({ label: account.id, state: account.state }))),
    accounts,
  };
}
