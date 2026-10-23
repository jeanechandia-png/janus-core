import type { ToolGateway } from '../../gateways/src/contracts.js';
import type { FounderSocialPlatform, FounderSocialScope, FounderSocialSource } from './founder-social-sources.js';

/**
 * Social watch — "seguimiento continuo" de las cuentas del Founder, SOLO LECTURA.
 *
 * Tres piezas puras o con dependencias inyectadas:
 *  1. `planSocialWatch`: dice, cuenta por cuenta y sin llamar a nadie, qué puede leerse YA y qué falta
 *     (credencial, vínculo con la entidad de Graph, destino canónico de un enlace compartido, cuenta profesional…).
 *  2. `flattenInsights` + `diffMetrics`: convierten la respuesta de Meta/Threads en números comparables y detectan caídas
 *     o subidas anómalas frente a la foto anterior.
 *  3. `runSocialWatch`: ejecuta las lecturas permitidas a través del Tool Gateway, compara y entrega un informe.
 *
 * Nada aquí publica, responde, borra ni gasta. Esas acciones serían una capacidad distinta, con aprobación del Founder.
 */

export type WatchReadiness =
  | 'ready'
  | 'needs_canonical_target'
  | 'needs_graph_binding'
  | 'needs_auth'
  | 'needs_metrics'
  | 'adapter_missing'
  | 'manual_only';

export interface WatchBinding {
  graphEntityId?: string;
  canonicalTargetUrl?: string;
}

export type WatchSourceInput = Pick<FounderSocialSource, 'referenceId' | 'platform' | 'label' | 'scope' | 'publicHandle' | 'cleanUrl'> & {
  currentBinding?: WatchBinding | null;
};

export interface WatchEnvironment {
  /** Tool Gateway adapters actually registered (by name). */
  adapters: ReadonlySet<string>;
  /** Credential presence per service (not verified against the provider). */
  credentials: { meta: boolean; threads: boolean };
  /** Metrics to request per platform. Facebook/Instagram metric names change often, so they are never guessed. */
  metrics?: Partial<Record<FounderSocialPlatform, readonly string[]>>;
}

export interface WatchPlanItem {
  referenceId: string;
  label: string;
  platform: FounderSocialPlatform;
  scope: FounderSocialScope;
  handle?: string;
  readiness: WatchReadiness;
  /** Siguiente paso concreto, en español. */
  nextStep: string;
  tool?: string;
  action?: string;
  input?: Record<string, unknown>;
}

/** Threads metrics verified against the official docs (2026-10-23). */
export const DEFAULT_THREADS_METRICS = ['views', 'likes', 'replies', 'reposts', 'quotes', 'followers_count'] as const;

const ADAPTER: Record<FounderSocialPlatform, { adapter: string; action: string; credential: 'meta' | 'threads' }> = {
  facebook: { adapter: 'meta-insights', action: 'facebook.page.insights', credential: 'meta' },
  instagram: { adapter: 'meta-insights', action: 'instagram.account.insights', credential: 'meta' },
  threads: { adapter: 'threads-insights', action: 'threads.account.insights', credential: 'threads' },
};

export function planSocialWatch(sources: readonly WatchSourceInput[], env: WatchEnvironment): WatchPlanItem[] {
  return sources.map((source) => {
    const base = {
      referenceId: source.referenceId,
      label: source.label,
      platform: source.platform,
      scope: source.scope,
      ...(source.publicHandle ? { handle: source.publicHandle } : {}),
    };
    const spec = ADAPTER[source.platform];
    const binding = source.currentBinding ?? undefined;

    // Un perfil personal de Facebook no es una Página: la API de Páginas gestiona Páginas (INFERENCIA sobre la documentación).
    if (source.platform === 'facebook' && source.scope === 'personal') {
      return {
        ...base,
        readiness: 'manual_only',
        nextStep: 'Parece un perfil personal. La API de Páginas de Meta gestiona Páginas, no perfiles: Janus no lo lee de forma automática. Si en realidad es una Página, cambia su ámbito; si no, sigue manual (p. ej. exportación de tus datos).',
      } satisfies WatchPlanItem;
    }
    if (!env.adapters.has(spec.adapter)) {
      return { ...base, readiness: 'adapter_missing', nextStep: `Falta registrar el adaptador ${spec.adapter} en el runtime.` } satisfies WatchPlanItem;
    }
    if (!env.credentials[spec.credential]) {
      return {
        ...base,
        readiness: 'needs_auth',
        nextStep: source.platform === 'threads'
          ? 'Falta el token de Threads (permisos threads_basic + threads_manage_insights) en el proveedor seguro de credenciales.'
          : 'Falta el token de Meta con permisos de lectura de insights en el proveedor seguro de credenciales.',
      } satisfies WatchPlanItem;
    }
    if (source.platform === 'facebook' && !binding?.canonicalTargetUrl) {
      return { ...base, readiness: 'needs_canonical_target', nextStep: 'El enlace compartido de Facebook aún no está resuelto a una Página concreta: ábrelo con sesión y registra la URL canónica como evidencia.' } satisfies WatchPlanItem;
    }
    if (!binding?.graphEntityId) {
      return {
        ...base,
        readiness: 'needs_graph_binding',
        nextStep: source.platform === 'instagram'
          ? 'Vincula el ID de Graph de la cuenta (debe ser profesional: Business o Creator).'
          : source.platform === 'threads'
            ? 'Vincula el ID de usuario de Threads (lo devuelve threads.account.profile con tu token).'
            : 'Vincula el ID de Graph de la Página.',
      } satisfies WatchPlanItem;
    }
    const metrics = env.metrics?.[source.platform] ?? (source.platform === 'threads' ? DEFAULT_THREADS_METRICS : undefined);
    if (!metrics || metrics.length === 0) {
      return { ...base, readiness: 'needs_metrics', nextStep: `Define las métricas de ${source.platform} a seguir (los nombres de Meta cambian y no se suponen).` } satisfies WatchPlanItem;
    }
    return {
      ...base,
      readiness: 'ready',
      nextStep: 'Lista para leer.',
      tool: spec.adapter,
      action: spec.action,
      input: source.platform === 'threads' ? { userId: binding.graphEntityId, metrics: [...metrics] } : { entityId: binding.graphEntityId, metrics: [...metrics] },
    } satisfies WatchPlanItem;
  });
}

/* ------------------------------------------------------------------------------------------------------------- */

/**
 * Convierte la lista `data` de insights de Meta/Threads en `{ métrica: número }`.
 * `total_value.value` se usa tal cual; en series (`values`) se toma el último valor numérico; el resto (desgloses) se ignora.
 */
export function flattenInsights(data: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!Array.isArray(data)) return out;
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : '';
    if (!name) continue;
    const total = record.total_value;
    const totalValue = typeof total === 'object' && total !== null ? (total as Record<string, unknown>).value : undefined;
    if (typeof totalValue === 'number') {
      out[name] = totalValue;
      continue;
    }
    if (Array.isArray(record.values)) {
      for (let i = record.values.length - 1; i >= 0; i -= 1) {
        const entry: unknown = record.values[i];
        const value = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>).value : undefined;
        if (typeof value === 'number') {
          out[name] = value;
          break;
        }
      }
    }
  }
  return out;
}

export interface MetricChange {
  metric: string;
  previous: number;
  current: number;
  delta: number;
  /** null cuando la base es 0. */
  pct: number | null;
  flag: 'caida' | 'subida' | null;
}

export interface DiffOptions {
  /** Base mínima para considerar un cambio (evita alarmas por 2→1). Por defecto 20. */
  minBase?: number;
  /** Caída porcentual que dispara alerta (por defecto 30). */
  dropPct?: number;
  /** Subida porcentual que dispara aviso (por defecto 100). */
  risePct?: number;
  /** Los seguidores se mueven despacio: caída que dispara alerta (por defecto 5). */
  followerDropPct?: number;
}

export function diffMetrics(previous: Record<string, number> | undefined, current: Record<string, number>, options: DiffOptions = {}): MetricChange[] {
  if (!previous) return [];
  const { minBase = 20, dropPct = 30, risePct = 100, followerDropPct = 5 } = options;
  const changes: MetricChange[] = [];
  for (const [metric, value] of Object.entries(current)) {
    const before = previous[metric];
    if (typeof before !== 'number' || !Number.isFinite(before) || !Number.isFinite(value)) continue;
    const delta = value - before;
    const pct = before === 0 ? null : (delta / before) * 100;
    let flag: MetricChange['flag'] = null;
    if (pct !== null && before >= minBase) {
      const drop = /follower/i.test(metric) ? followerDropPct : dropPct;
      if (pct <= -drop) flag = 'caida';
      else if (pct >= risePct) flag = 'subida';
    }
    changes.push({ metric, previous: before, current: value, delta, pct: pct === null ? null : Math.round(pct * 10) / 10, flag });
  }
  return changes.sort((a, b) => a.metric.localeCompare(b.metric));
}

/* ------------------------------------------------------------------------------------------------------------- */

export interface StoredWatchSnapshot {
  referenceId: string;
  at: string;
  metrics: Record<string, number>;
}

export interface SocialWatchDeps {
  tools: Pick<ToolGateway, 'execute'>;
  loadPrevious(referenceId: string): StoredWatchSnapshot | undefined | Promise<StoredWatchSnapshot | undefined>;
  save(snapshot: StoredWatchSnapshot): void | Promise<void>;
  now?: () => Date;
  diff?: DiffOptions;
}

export interface SocialWatchItemReport {
  referenceId: string;
  label: string;
  platform: FounderSocialPlatform;
  scope: FounderSocialScope;
  status: 'read' | 'skipped' | 'failed';
  /** Para `skipped`: el siguiente paso del plan. Para `failed`: el error del conector. */
  detail?: string;
  readiness: WatchReadiness;
  metrics?: Record<string, number>;
  changes?: MetricChange[];
  alerts: string[];
  firstSnapshot?: boolean;
}

export interface SocialWatchReport {
  generatedAt: string;
  items: SocialWatchItemReport[];
  summary: { read: number; skipped: number; failed: number; alerts: number };
}

export async function runSocialWatch(plan: readonly WatchPlanItem[], deps: SocialWatchDeps): Promise<SocialWatchReport> {
  const now = deps.now ?? (() => new Date());
  const items: SocialWatchItemReport[] = [];
  for (const item of plan) {
    const common = { referenceId: item.referenceId, label: item.label, platform: item.platform, scope: item.scope, readiness: item.readiness };
    if (item.readiness !== 'ready' || !item.tool || !item.action || !item.input) {
      items.push({ ...common, status: 'skipped', detail: item.nextStep, alerts: [] });
      continue;
    }
    const result = await deps.tools.execute({ tool: item.tool, action: item.action, input: item.input }, () => undefined);
    if (!result.ok) {
      items.push({ ...common, status: 'failed', detail: result.error ?? 'Lectura fallida', alerts: [`${item.label}: no se pudo leer (${result.error ?? 'error'})`] });
      continue;
    }
    const metrics = flattenInsights(result.output?.data);
    const previous = await deps.loadPrevious(item.referenceId);
    const changes = diffMetrics(previous?.metrics, metrics, deps.diff);
    const alerts = changes
      .filter((c) => c.flag)
      .map((c) => `${item.label}: ${c.metric} ${c.flag === 'caida' ? 'cae' : 'sube'} ${Math.abs(c.pct ?? 0)}% (${c.previous} → ${c.current})`);
    await deps.save({ referenceId: item.referenceId, at: now().toISOString(), metrics });
    items.push({ ...common, status: 'read', metrics, changes, alerts, ...(previous ? {} : { firstSnapshot: true }) });
  }
  return {
    generatedAt: now().toISOString(),
    items,
    summary: {
      read: items.filter((i) => i.status === 'read').length,
      skipped: items.filter((i) => i.status === 'skipped').length,
      failed: items.filter((i) => i.status === 'failed').length,
      alerts: items.reduce((n, i) => n + i.alerts.length, 0),
    },
  };
}
