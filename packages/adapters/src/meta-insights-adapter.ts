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
    // Añadidos 2026-10-14 (solo lectura) para el panel del Founder.
    'instagram.account.profile',
    'instagram.reels.recent',
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
    if (request.action === 'instagram.account.profile') return this.accountProfile(entityId, token);
    if (request.action === 'instagram.reels.recent') {
      return this.recentReels(entityId, token, boundedLimit(request.input.limit), onProgress);
    }
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

  /** GET /{ig-user-id}?fields=username,name,followers_count,media_count (IG User reference). */
  private async accountProfile(entityId: string, token: string): Promise<ToolResult> {
    const url = new URL(`${this.graphBase}/${this.apiVersion}/${encodeURIComponent(entityId)}`);
    url.searchParams.set('fields', 'username,name,followers_count,media_count');
    const result = await this.getJson(url, token);
    if (!result.ok) return result;
    const body = result.body;
    return {
      ok: true,
      output: {
        platform: 'instagram',
        entityId,
        apiVersion: this.apiVersion,
        username: typeof body.username === 'string' ? body.username : null,
        name: typeof body.name === 'string' ? body.name : null,
        followersCount: finiteOrNull(body.followers_count),
        mediaCount: finiteOrNull(body.media_count),
        verifiedAt: new Date().toISOString(),
      },
      externalReference: 'meta-graph-api',
    };
  }

  /**
   * Últimos reels con métricas. Media: GET /{ig-user-id}/media (filtrando
   * media_product_type=REELS). Insights por reel: views, reach, likes, comments,
   * shares, saved, total_interactions (Instagram Media Insights; `plays` y
   * `ig_reels_aggregated_all_plays_count` retirados el 2025-04-21). Si los
   * insights fallan, se conservan like_count/comments_count del propio media.
   */
  private async recentReels(
    entityId: string,
    token: string,
    limit: number,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    const url = new URL(`${this.graphBase}/${this.apiVersion}/${encodeURIComponent(entityId)}/media`);
    url.searchParams.set('fields', 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count');
    url.searchParams.set('limit', String(Math.min(50, limit * 3)));
    const listed = await this.getJson(url, token);
    if (!listed.ok) return listed;
    const items = (Array.isArray(listed.body.data) ? listed.body.data : [])
      .filter(isRecord)
      .filter((item) => item.media_product_type === 'REELS')
      .slice(0, limit);
    await onProgress({ phase: 'progress', message: `Meta: ${items.length} reels`, percent: 40 });
    const reels = [];
    for (const item of items) {
      const id = typeof item.id === 'string' ? item.id : '';
      if (!id) continue;
      const insightsUrl = new URL(`${this.graphBase}/${this.apiVersion}/${encodeURIComponent(id)}/insights`);
      insightsUrl.searchParams.set('metric', REEL_METRICS.join(','));
      const insights = await this.getJson(insightsUrl, token);
      const metrics: Record<string, number | null> = {
        likes: finiteOrNull(item.like_count),
        comments: finiteOrNull(item.comments_count),
      };
      if (insights.ok && Array.isArray(insights.body.data)) {
        for (const row of insights.body.data.filter(isRecord)) {
          const name = typeof row.name === 'string' ? row.name : '';
          const values = Array.isArray(row.values) ? row.values.filter(isRecord) : [];
          const total = isRecord(row.total_value) ? row.total_value.value : values[0]?.value;
          if (REEL_METRICS.includes(name)) metrics[name] = finiteOrNull(total);
        }
      }
      reels.push({
        id,
        caption: typeof item.caption === 'string' ? item.caption.slice(0, 500) : '',
        permalink: typeof item.permalink === 'string' && item.permalink.startsWith('https://') ? item.permalink : null,
        publishedAt: typeof item.timestamp === 'string' ? item.timestamp : null,
        metrics,
        insightsAvailable: insights.ok,
      });
    }
    return {
      ok: true,
      output: { platform: 'instagram', entityId, apiVersion: this.apiVersion, reels, verifiedAt: new Date().toISOString() },
      externalReference: 'meta-graph-api',
    };
  }

  private async getJson(url: URL, token: string): Promise<{ ok: true; body: JsonRecord } | { ok: false; error: string }> {
    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
    } catch (error) {
      return { ok: false, error: `Meta network error: ${error instanceof Error ? error.message : String(error)}` };
    }
    const body = await safeJson(response);
    if (!response.ok) return { ok: false, error: metaError(body, response.status) };
    return { ok: true, body };
  }
}

const REEL_METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions'];

function boundedLimit(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? Math.min(25, Math.max(1, value)) : 12;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
