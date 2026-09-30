import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

export interface MetaInsightsAdapterOptions {
  apiVersion: string;
  accessToken?: string;
  tokenProvider?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
  graphBase?: string;
}

type JsonRecord = Record<string, unknown>;

export class MetaInsightsAdapter implements ToolAdapter {
  readonly name = 'meta-insights';
  readonly capabilities = [
    'facebook.page.insights',
    'instagram.account.insights',
  ];

  private readonly apiVersion: string;
  private readonly accessToken?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;
  private readonly graphBase: string;

  constructor(options: MetaInsightsAdapterOptions) {
    if (!/^v\d+\.\d+$/.test(options.apiVersion.trim())) {
      throw new Error('Meta Graph API version must be explicitly configured, for example v26.0');
    }
    this.apiVersion = options.apiVersion.trim();
    this.accessToken = options.accessToken;
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.graphBase = (options.graphBase ?? 'https://graph.facebook.com').replace(/\/$/, '');
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported Meta insights action: ${request.action}` };
    }

    const token = (this.tokenProvider ? await this.tokenProvider() : this.accessToken)?.trim();
    if (!token) {
      return {
        ok: false,
        error: 'Meta is not authenticated; provide an ephemeral token through the secure credential provider.',
      };
    }

    const entityId = requiredString(request.input.entityId, 'entityId', 300);
    const metrics = metricList(request.input.metrics);
    if (metrics.length === 0) {
      return { ok: false, error: 'At least one Meta insight metric is required.' };
    }

    const url = new URL(
      `${this.graphBase}/${this.apiVersion}/${encodeURIComponent(entityId)}/insights`,
    );
    url.searchParams.set('metric', metrics.join(','));

    const period = optionalString(request.input.period, 40);
    if (period) url.searchParams.set('period', period);
    const since = optionalTimestamp(request.input.since);
    const until = optionalTimestamp(request.input.until);
    if (since) url.searchParams.set('since', since);
    if (until) url.searchParams.set('until', until);

    await onProgress({
      phase: 'progress',
      message: `Meta insights: ${request.action}`,
      percent: 20,
      data: {
        apiVersion: this.apiVersion,
        entityId,
        metrics,
      },
    });

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
      });
    } catch (error) {
      return {
        ok: false,
        error: `Meta network error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const body = await safeJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: metaError(body, response.status),
      };
    }

    return {
      ok: true,
      output: {
        platform: request.action.startsWith('facebook.') ? 'facebook' : 'instagram',
        entityId,
        apiVersion: this.apiVersion,
        requestedMetrics: metrics,
        data: Array.isArray(body.data) ? body.data : [],
        paging: isRecord(body.paging) ? body.paging : undefined,
        verifiedAt: new Date().toISOString(),
      },
      externalReference: 'meta-graph-api',
    };
  }
}

function metricList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const metric = item.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(metric)) return [];
    return [metric];
  }))].slice(0, 25);
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`Meta input '${label}' is required`);
  }
  return value.trim();
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim() && value.trim().length <= maxLength
    ? value.trim()
    : undefined;
}

function optionalTimestamp(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(Math.floor(value));
  }
  if (typeof value === 'string' && /^\d{1,12}$/.test(value.trim())) return value.trim();
  return undefined;
}

async function safeJson(response: Response): Promise<JsonRecord> {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function metaError(body: JsonRecord, status: number): string {
  const error = isRecord(body.error) ? body.error : {};
  const message = typeof error.message === 'string' ? error.message : undefined;
  const code = typeof error.code === 'number' ? ` code ${error.code}` : '';
  return message
    ? `Meta Graph API ${status}${code}: ${message}`
    : `Meta Graph API request failed with HTTP ${status}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
