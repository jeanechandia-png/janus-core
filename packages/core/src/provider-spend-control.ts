/**
 * JANUS provider-spend control. Only evidence-backed consumption is shown.
 * Missing billing integration != zero usage or zero cost.
 */
export const PROVIDERS = [
  ['elevenlabs','ElevenLabs'], ['openai-api','OpenAI API'],
  ['chatgpt','ChatGPT'], ['anthropic-api','Anthropic API'],
  ['claude','Claude'], ['gemini','Gemini'], ['google-cloud','Google Cloud'],
  ['google-workspace','Google Workspace'], ['hostinger','Hostinger'],
  ['vercel','Vercel'], ['netlify','Netlify'], ['supabase','Supabase'],
  ['other','Otros servicios'],
] as const;

export type SpendAlert = 'unknown' | 'normal' | 'watch' | 'high' | 'critical';
export interface ProviderSpendObservation {
  provider: string;
  observedAt: string;
  source: string;
  used: number;
  limit: number;
  unit: string;
  percent: number | null;
  resetAt: string | null;
  alert: SpendAlert;
  overageEnabled: boolean | null;
  overageCap: number | 'unlimited' | null;
  overageEUR: number | null;
  currency: string | null;
  // The subscription endpoint does not report the full subscription cost.
  totalCostEUR: null;
}
export interface ProviderSpendHistoryPoint {
  date: string;
  used: number;
  limit: number;
  observedAt: string;
}
export interface SpendProviderSummary {
  id: string;
  name: string;
  state: 'verified' | 'not_connected' | 'unavailable';
  alert: SpendAlert;
  used: number | null;
  limit: number | null;
  unit: string | null;
  percent: number | null;
  observedAt: string | null;
  resetAt: string | null;
  overageEnabled: boolean | null;
  overageCap: number | 'unlimited' | null;
  overageEUR: number | null;
  totalCostEUR: number | null;
  currency: string | null;
  source: string | null;
  history: ProviderSpendHistoryPoint[];
  note: string;
}

const object = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
function nonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function overageAmountEUR(v: unknown): number | null {
  const o = object(v);
  if (!o || o.currency !== 'eur') return null;
  const n = typeof o.amount === 'string' || typeof o.amount === 'number' ? Number(o.amount) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
/** No FX guessing, no plan-fee guessing, no "credits" label for character_count. */
export function parseElevenLabsSubscription(raw: unknown, observedAt: string): ProviderSpendObservation {
  const body = object(raw);
  const used = nonnegative(body?.character_count);
  const limit = nonnegative(body?.character_limit);
  if (!body || used === null || limit === null || !Number.isFinite(Date.parse(observedAt))) {
    throw new Error('ElevenLabs subscription response missing trustworthy usage fields');
  }
  const percent = limit > 0 ? Math.round(used / limit * 1000) / 10 : null;
  let alert: SpendAlert = percent === null ? 'unknown'
    : percent >= 95 ? 'critical' : percent >= 85 ? 'high' : percent >= 70 ? 'watch' : 'normal';
  const cap = body.max_credit_limit_extension;
  const overageCap = cap === 'unlimited' ? 'unlimited' : nonnegative(cap);
  const overageEnabled = overageCap === null ? null : overageCap === 'unlimited' || overageCap > 0;
  if (overageEnabled === true && alert === 'normal') alert = 'watch';
  const reset = body.next_character_count_reset_unix;
  const resetAt = typeof reset === 'number' && Number.isSafeInteger(reset) && reset > 0
    ? new Date(reset * 1000).toISOString() : null;
  return {
    provider: 'elevenlabs', observedAt: new Date(observedAt).toISOString(),
    source: 'ElevenLabs GET /v1/user/subscription',
    used, limit, unit: 'caracteres reportados por API', percent, resetAt, alert,
    overageEnabled, overageCap,
    overageEUR: overageAmountEUR(body.current_overage),
    currency: typeof body.currency === 'string' ? body.currency : null,
    totalCostEUR: null,
  };
}
export function buildProviderSpendSnapshot(
  elevenLabs: ProviderSpendObservation | null,
  history: readonly ProviderSpendHistoryPoint[] = [],
  providerState: 'not_connected' | 'unavailable' = 'not_connected',
): { providers: SpendProviderSummary[]; alerts: number; verifiedProviders: number; totalCostEUR: null; costComplete: false } {
  const providers = PROVIDERS.map(([id, name]): SpendProviderSummary => {
    if (id === 'elevenlabs' && elevenLabs) {
      return {
        id, name, state: 'verified', alert: elevenLabs.alert,
        used: elevenLabs.used, limit: elevenLabs.limit, unit: elevenLabs.unit,
        percent: elevenLabs.percent, observedAt: elevenLabs.observedAt,
        resetAt: elevenLabs.resetAt, overageEnabled: elevenLabs.overageEnabled,
        overageCap: elevenLabs.overageCap, overageEUR: elevenLabs.overageEUR,
        totalCostEUR: null, currency: elevenLabs.currency,
        source: elevenLabs.source, history: [...history].slice(-90),
        note: 'La API muestra caracteres y excedentes, no el coste total del plan ni el consumo de otras aplicaciones.',
      };
    }
    return {
      id, name, state: id === 'elevenlabs' ? providerState : 'not_connected',
      alert: 'unknown', used: null, limit: null, unit: null, percent: null,
      observedAt: null, resetAt: null, overageEnabled: null, overageCap: null,
      overageEUR: null, totalCostEUR: null, currency: null, source: null, history: [],
      note: id === 'elevenlabs' && providerState === 'unavailable'
        ? 'No se pudo verificar la API del proveedor. Últimos valores no se presentan como actuales.'
        : 'Sin integración de facturación verificada. No equivale a coste cero.',
    };
  });
  return {
    providers,
    alerts: providers.filter(p => p.alert === 'watch' || p.alert === 'high' || p.alert === 'critical').length,
    verifiedProviders: providers.filter(p => p.state === 'verified').length,
    totalCostEUR: null,
    costComplete: false,
  };
}
