/**
 * Model provider configuration (ChatGPT/OpenAI, Claude/Anthropic, Gemini/Google,
 * plus the existing generic OpenAI-compatible endpoint, e.g. a local model).
 *
 * Rules:
 * - A provider is enabled only when BOTH its API key and its model name are
 *   configured. Janus never hardcodes model ids (they change); the Founder
 *   sets them, e.g. JANUS_OPENAI_MODEL.
 * - Secrets are referenced by environment variable NAME only; values never
 *   enter SQLite, receipts or logs.
 * - Order: JANUS_MODEL_ORDER (comma list) or default local/custom first
 *   (local-first), then openai, anthropic, gemini.
 * Endpoints verified 2026-10-14 against official docs:
 * - OpenAI: https://api.openai.com + /v1/chat/completions (Bearer)
 * - Anthropic: https://api.anthropic.com/v1/messages (x-api-key, anthropic-version)
 * - Gemini (OpenAI-compatible): https://generativelanguage.googleapis.com/v1beta/openai + /chat/completions (Bearer)
 * - Perplexity (OpenAI-compatible orchestrator): https://api.perplexity.ai/router/v1 + /chat/completions (Bearer)
 */
export type ModelProviderId = 'custom' | 'openai' | 'anthropic' | 'gemini' | 'perplexity';

export interface ModelProviderConfig {
  id: ModelProviderId;
  label: string;
  protocol: 'chat-completions' | 'anthropic-messages';
  baseUrl: string;
  chatPath?: string;
  model: string;
  credentialEnv: string;
  jsonMode: boolean;
}

interface ProviderPreset {
  id: ModelProviderId;
  label: string;
  protocol: ModelProviderConfig['protocol'];
  baseUrl: string;
  chatPath?: string;
  keyEnv: string;
  modelEnv: string;
  jsonMode: boolean;
}

const PRESETS: readonly ProviderPreset[] = [
  { id: 'openai', label: 'ChatGPT (OpenAI)', protocol: 'chat-completions', baseUrl: 'https://api.openai.com', chatPath: '/v1/chat/completions', keyEnv: 'JANUS_OPENAI_API_KEY', modelEnv: 'JANUS_OPENAI_MODEL', jsonMode: true },
  { id: 'anthropic', label: 'Claude (Anthropic)', protocol: 'anthropic-messages', baseUrl: 'https://api.anthropic.com', keyEnv: 'JANUS_ANTHROPIC_API_KEY', modelEnv: 'JANUS_ANTHROPIC_MODEL', jsonMode: false },
  { id: 'perplexity', label: 'Perplexity', protocol: 'chat-completions', baseUrl: 'https://api.perplexity.ai/router/v1', chatPath: '/chat/completions', keyEnv: 'PERPLEXITY_API_KEY', modelEnv: 'JANUS_PERPLEXITY_MODEL', jsonMode: false },
  { id: 'gemini', label: 'Gemini (Google)', protocol: 'chat-completions', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', chatPath: '/chat/completions', keyEnv: 'JANUS_GEMINI_API_KEY', modelEnv: 'JANUS_GEMINI_MODEL', jsonMode: true },
];

export const MODEL_PROVIDER_CREDENTIAL_ENV: Readonly<Record<ModelProviderId, string>> = Object.freeze({
  custom: 'JANUS_MODEL_API_KEY',
  openai: 'JANUS_OPENAI_API_KEY',
  anthropic: 'JANUS_ANTHROPIC_API_KEY',
  gemini: 'JANUS_GEMINI_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
});

const DEFAULT_ORDER: readonly ModelProviderId[] = ['custom', 'openai', 'anthropic', 'gemini', 'perplexity'];

type Env = Record<string, string | undefined>;

export function resolveModelProviders(env: Env): ModelProviderConfig[] {
  const read = (name: string) => env[name]?.trim() || '';
  const found = new Map<ModelProviderId, ModelProviderConfig>();

  const customBase = read('JANUS_MODEL_BASE_URL');
  const customModel = read('JANUS_MODEL_NAME');
  if (customBase && customModel) {
    found.set('custom', {
      id: 'custom',
      label: read('JANUS_MODEL_PROVIDER') || 'Modelo configurado (compatible OpenAI / local)',
      protocol: 'chat-completions',
      baseUrl: customBase,
      model: customModel,
      credentialEnv: MODEL_PROVIDER_CREDENTIAL_ENV.custom,
      jsonMode: read('JANUS_MODEL_JSON_MODE') === 'true',
    });
  }
  for (const preset of PRESETS) {
    const model = read(preset.modelEnv);
    if (!model || !read(preset.keyEnv)) continue;
    found.set(preset.id, {
      id: preset.id,
      label: preset.label,
      protocol: preset.protocol,
      baseUrl: preset.baseUrl,
      ...(preset.chatPath ? { chatPath: preset.chatPath } : {}),
      model,
      credentialEnv: preset.keyEnv,
      jsonMode: preset.jsonMode,
    });
  }

  const requested = read('JANUS_MODEL_ORDER')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ModelProviderId => (DEFAULT_ORDER as readonly string[]).includes(item));
  const order = [...new Set([...requested, ...DEFAULT_ORDER])];
  return order.map((id) => found.get(id)).filter((config): config is ModelProviderConfig => Boolean(config));
}

/** Public, secret-free description for capability views and receipts. */
export function describeModelProviders(env: Env): Array<{ id: ModelProviderId; label: string; configured: boolean; missing: string[] }> {
  const configured = new Set(resolveModelProviders(env).map((provider) => provider.id));
  return PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    configured: configured.has(preset.id),
    missing: [preset.keyEnv, preset.modelEnv].filter((name) => !env[name]?.trim()),
  }));
}

/**
 * Policy: independently-operated models first, external credit-consuming
 * providers only with explicit runtime opt-in AND a positive bounded budget.
 * Credential presence is configuration, NOT permission to spend.
 *
 * Only custom endpoints on loopback are self-hosted by default. A LAN model
 * must have an explicitly trusted origin; this avoids calling a remote API
 * 'local' because its provider label says so.
 */
export type ModelExecutionTier = 'local' | 'external-credit';

export interface ModelExecutionPlan {
  local: ModelProviderConfig[];
  external: ModelProviderConfig[];
  blocked: Array<{ id: ModelProviderId; reason: string }>;
  maxExternalCalls: number;
}

export function modelExecutionTier(config: ModelProviderConfig, env: Env): ModelExecutionTier {
  if (config.id !== 'custom') return 'external-credit';
  try {
    const endpoint = new URL(config.baseUrl);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) return 'external-credit';
    const hostname = endpoint.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return 'local';
    const trusted = (env.JANUS_TRUSTED_LOCAL_MODEL_ORIGINS ?? '')
      .split(',').map((origin) => origin.trim()).filter(Boolean);
    // An allowlisted public host remains external: an environment typo must
    // not silently reclassify a paid cloud API as a free local model.
    const ipv4 = hostname.split('.').map((part) => /^\\d{1,3}$/.test(part) ? Number(part) : NaN);
    const privateIpv4 = ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
      && (ipv4[0] === 10 || (ipv4[0] === 192 && ipv4[1] === 168)
      || (ipv4[0] === 172 && (ipv4[1] ?? -1) >= 16 && (ipv4[1] ?? 99) <= 31));
    const localHostname = hostname.endsWith('.local');
    if ((privateIpv4 || localHostname) && trusted.includes(endpoint.origin)) return 'local';
  } catch {
    // An invalid/unknown URL is never classified as cost-free.
  }
  return 'external-credit';
}

export function planModelExecution(env: Env): ModelExecutionPlan {
  const configured = resolveModelProviders(env);
  const local = configured.filter((p) => modelExecutionTier(p, env) === 'local');
  const remote = configured.filter((p) => modelExecutionTier(p, env) === 'external-credit');
  // Invalid/absent permission or limit => zero credits. Hard limit prevents
  // accidental unbounded charging even with a mistyped environment variable.
  const rawLimit = env.JANUS_MAX_EXTERNAL_MODEL_CALLS?.trim() ?? '';
  const n = /^\d+$/.test(rawLimit) ? Number(rawLimit) : 0;
  const maxExternalCalls = env.JANUS_ALLOW_EXTERNAL_MODEL_CREDITS === 'true' && Number.isSafeInteger(n) && n > 0 && n <= 100
    ? n : 0;
  return {
    local,
    external: maxExternalCalls ? remote : [],
    blocked: maxExternalCalls ? [] : remote.map(({ id }) => ({
      id,
      reason: 'Créditos externos en reposo: requieren autorización explícita y límite de llamadas.',
    })),
    maxExternalCalls,
  };
}
