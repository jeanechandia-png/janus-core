import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';

/**
 * Threads read-only adapter (LEGO piece). Verified 2026-10-23 against the official Threads API docs
 * (developers.facebook.com/documentation/threads): host `graph.threads.com`, version `v1.0`,
 *  - `GET /me?fields=id,username,name,is_verified`           permission `threads_basic`
 *  - `GET /{threads-user-id}/threads_insights?metric=…`       permissions `threads_basic` + `threads_manage_insights`
 * User metrics: views, likes, replies, reposts, quotes, clicks, followers_count, follower_demographics.
 * The Insights API reads the AUTHENTICATED user's own Threads account. The token travels as the documented
 * `access_token` parameter; it is never written to output, errors or progress events.
 *
 * Read-only by construction: no publish, reply, delete or message actions exist here. Those would be a separate,
 * approval-gated capability (threads_content_publish / threads_manage_replies).
 */
export interface ThreadsInsightsAdapterOptions {
  /** Default `v1.0`. */
  apiVersion?: string;
  graphBase?: string;
  tokenProvider?: () => Promise<string | undefined>;
  accessToken?: string;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

export const THREADS_USER_METRICS = ['views', 'likes', 'replies', 'reposts', 'quotes', 'clicks', 'followers_count', 'follower_demographics'] as const;
const BREAKDOWNS = new Set(['country', 'city', 'age', 'gender']);
/** Earliest timestamp the API accepts for since/until (from the official docs). */
export const THREADS_EARLIEST_TIMESTAMP = 1_712_991_600;

export class ThreadsInsightsAdapter implements ToolAdapter {
  readonly name = 'threads-insights';
  readonly capabilities = ['threads.account.profile', 'threads.account.insights'];

  private readonly apiVersion: string;
  private readonly graphBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ThreadsInsightsAdapterOptions = {}) {
    const version = (options.apiVersion ?? 'v1.0').trim();
    if (!/^v\d+\.\d+$/.test(version)) throw new Error('Threads API version must look like v1.0');
    this.apiVersion = version;
    this.graphBase = (options.graphBase ?? 'https://graph.threads.com').replace(/\/$/, '');
    if (!this.graphBase.startsWith('https://')) throw new Error('Threads graphBase must be https');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Threads action: ${request.action}` };

    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.accessToken)?.trim();
    if (!token) return { ok: false, error: 'Threads is not authenticated; provide the token through the secure credential provider.' };

    let url: URL;
    let metrics: string[] = [];
    if (request.action === 'threads.account.profile') {
      url = new URL(`${this.graphBase}/${this.apiVersion}/me`);
      url.searchParams.set('fields', 'id,username,name,is_verified');
    } else {
      const userId = typeof request.input.userId === 'string' ? request.input.userId.trim() : '';
      if (!/^\d{1,30}$/.test(userId)) return { ok: false, error: "Threads input 'userId' must be the numeric Threads user id (bind it first with threads.account.profile)." };
      metrics = metricList(request.input.metrics);
      if (metrics.length === 0) return { ok: false, error: `At least one valid Threads metric is required (${THREADS_USER_METRICS.join(', ')}).` };
      url = new URL(`${this.graphBase}/${this.apiVersion}/${userId}/threads_insights`);
      url.searchParams.set('metric', metrics.join(','));
      const since = timestamp(request.input.since);
      const until = timestamp(request.input.until);
      if (request.input.since !== undefined && since === undefined) return { ok: false, error: 'Threads since must be a Unix timestamp not earlier than 1712991600.' };
      if (request.input.until !== undefined && until === undefined) return { ok: false, error: 'Threads until must be a Unix timestamp not earlier than 1712991600.' };
      if (since !== undefined) url.searchParams.set('since', String(since));
      if (until !== undefined) url.searchParams.set('until', String(until));
      if (metrics.includes('followers_count') && (since !== undefined || until !== undefined)) {
        return { ok: false, error: 'Threads followers_count does not support since/until; request it separately.' };
      }
      if (typeof request.input.breakdown === 'string') {
        if (!BREAKDOWNS.has(request.input.breakdown)) return { ok: false, error: 'Threads breakdown must be country, city, age or gender.' };
        url.searchParams.set('breakdown', request.input.breakdown);
      }
    }
    url.searchParams.set('access_token', token);

    await onProgress({ phase: 'progress', message: `Threads: ${request.action}`, percent: 30, data: { metrics } });

    let response: Response;
    try {
      response = await this.fetchImpl(url, { method: 'GET', redirect: 'error', headers: { accept: 'application/json' } });
    } catch {
      // The raw error may embed the URL (and therefore the token): never forward it.
      return { ok: false, error: 'Threads network error' };
    }
    const body = await safeJson(response);
    if (!response.ok) return { ok: false, error: threadsError(body, response.status) };

    if (request.action === 'threads.account.profile') {
      return {
        ok: true,
        output: {
          platform: 'threads',
          userId: typeof body.id === 'string' || typeof body.id === 'number' ? String(body.id) : null,
          username: typeof body.username === 'string' ? body.username : null,
          name: typeof body.name === 'string' ? body.name : null,
          isVerified: body.is_verified === true,
          verifiedAt: new Date().toISOString(),
        },
        externalReference: 'threads-graph-api',
      };
    }
    return {
      ok: true,
      output: {
        platform: 'threads',
        userId: String(request.input.userId).trim(),
        apiVersion: this.apiVersion,
        requestedMetrics: metrics,
        data: Array.isArray(body.data) ? body.data : [],
        verifiedAt: new Date().toISOString(),
      },
      externalReference: 'threads-graph-api',
    };
  }
}

function metricList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(THREADS_USER_METRICS);
  return [...new Set(value.filter((m): m is string => typeof m === 'string' && allowed.has(m.trim())).map((m) => m.trim()))];
}

function timestamp(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,12}$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(n) && n >= THREADS_EARLIEST_TIMESTAMP ? Math.floor(n) : undefined;
}

async function safeJson(response: Response): Promise<JsonRecord> {
  try {
    const value: unknown = await response.json();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {};
  } catch {
    return {};
  }
}

function threadsError(body: JsonRecord, status: number): string {
  const error = typeof body.error === 'object' && body.error !== null ? (body.error as JsonRecord) : {};
  const message = typeof error.message === 'string' ? error.message.replace(/access_token=[^&\s]+/gi, 'access_token=***') : undefined;
  const code = typeof error.code === 'number' ? ` code ${error.code}` : '';
  return message ? `Threads API ${status}${code}: ${message.slice(0, 240)}` : `Threads API request failed with HTTP ${status}`;
}
