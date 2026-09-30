import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

export interface YouTubeInsightsAdapterOptions {
  accessToken?: string;
  tokenProvider?: () => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

export class YouTubeInsightsAdapter implements ToolAdapter {
  readonly name = 'youtube-insights';
  readonly capabilities = [
    'channel.statistics',
    'analytics.query',
  ];

  private readonly accessToken?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: YouTubeInsightsAdapterOptions = {}) {
    this.accessToken = options.accessToken;
    this.tokenProvider = options.tokenProvider;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported YouTube insights action: ${request.action}` };
    }

    const token = (this.tokenProvider ? await this.tokenProvider() : this.accessToken)?.trim();
    if (!token) {
      return {
        ok: false,
        error: 'YouTube is not authenticated; provide an ephemeral OAuth token through the secure credential provider.',
      };
    }

    await onProgress({
      phase: 'progress',
      message: `YouTube insights: ${request.action}`,
      percent: 20,
    });

    return request.action === 'channel.statistics'
      ? this.channelStatistics(request.input, token)
      : this.analyticsQuery(request.input, token);
  }

  private async channelStatistics(
    input: JsonRecord,
    token: string,
  ): Promise<ToolResult> {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'snippet,statistics');
    const channelId = optionalString(input.channelId, 300);
    if (channelId) url.searchParams.set('id', channelId);
    else url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');

    const payload = await this.requestJson(url, token);
    if (!payload.ok) return payload.result;

    const items = Array.isArray(payload.body.items)
      ? payload.body.items.filter(isRecord).map((item) => ({
          id: item.id,
          snippet: isRecord(item.snippet) ? {
            title: item.snippet.title,
            customUrl: item.snippet.customUrl,
            country: item.snippet.country,
          } : undefined,
          statistics: isRecord(item.statistics) ? item.statistics : {},
        }))
      : [];

    return {
      ok: true,
      output: {
        platform: 'youtube',
        channels: items,
        verifiedAt: new Date().toISOString(),
      },
      externalReference: 'youtube-data-api',
    };
  }

  private async analyticsQuery(
    input: JsonRecord,
    token: string,
  ): Promise<ToolResult> {
    const startDate = dateOnly(input.startDate, 'startDate');
    const endDate = dateOnly(input.endDate, 'endDate');
    const metrics = identifierList(input.metrics, 25);
    if (metrics.length === 0) {
      return { ok: false, error: 'At least one YouTube Analytics metric is required.' };
    }

    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    url.searchParams.set('ids', optionalString(input.ids, 100) ?? 'channel==MINE');
    url.searchParams.set('startDate', startDate);
    url.searchParams.set('endDate', endDate);
    url.searchParams.set('metrics', metrics.join(','));

    const dimensions = identifierList(input.dimensions, 10);
    if (dimensions.length > 0) url.searchParams.set('dimensions', dimensions.join(','));

    const filters = optionalString(input.filters, 500);
    if (filters) url.searchParams.set('filters', filters);
    const sort = sortList(input.sort);
    if (sort.length > 0) url.searchParams.set('sort', sort.join(','));

    const maxResults = boundedInteger(input.maxResults, 200, 1, 200);
    url.searchParams.set('maxResults', String(maxResults));

    const payload = await this.requestJson(url, token);
    if (!payload.ok) return payload.result;

    return {
      ok: true,
      output: {
        platform: 'youtube',
        startDate,
        endDate,
        metrics,
        dimensions,
        columnHeaders: Array.isArray(payload.body.columnHeaders)
          ? payload.body.columnHeaders
          : [],
        rows: Array.isArray(payload.body.rows) ? payload.body.rows : [],
        verifiedAt: new Date().toISOString(),
      },
      externalReference: 'youtube-analytics-api',
    };
  }

  private async requestJson(
    url: URL,
    token: string,
  ): Promise<
    | { ok: true; body: JsonRecord }
    | { ok: false; result: ToolResult }
  > {
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
        result: {
          ok: false,
          error: `YouTube network error: ${error instanceof Error ? error.message : String(error)}`,
        },
      };
    }

    const body = await safeJson(response);
    if (!response.ok) {
      return {
        ok: false,
        result: {
          ok: false,
          error: youtubeError(body, response.status),
        },
      };
    }
    return { ok: true, body };
  }
}

function identifierList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const identifier = item.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(identifier)) return [];
    return [identifier];
  }))].slice(0, maxItems);
}

function sortList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const sort = item.trim();
    if (!/^-?[A-Za-z][A-Za-z0-9_]{0,79}$/.test(sort)) return [];
    return [sort];
  }))].slice(0, 10);
}

function dateOnly(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`YouTube input '${label}' must use YYYY-MM-DD`);
  }
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`YouTube input '${label}' is invalid`);
  }
  return value.trim();
}

function optionalString(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.trim() && value.trim().length <= maxLength
    ? value.trim()
    : undefined;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? Math.trunc(value) : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

async function safeJson(response: Response): Promise<JsonRecord> {
  try {
    const value: unknown = await response.json();
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}

function youtubeError(body: JsonRecord, status: number): string {
  const error = isRecord(body.error) ? body.error : {};
  const message = typeof error.message === 'string' ? error.message : undefined;
  return message
    ? `YouTube API ${status}: ${message}`
    : `YouTube API request failed with HTTP ${status}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
