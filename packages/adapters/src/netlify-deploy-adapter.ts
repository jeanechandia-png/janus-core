import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

/**
 * Read-only Netlify adapter. It answers one question: which deploy is
 * actually published (live) for a site, and from which commit.
 *
 * It never creates, publishes, locks or rolls back deploys.
 */
export interface NetlifyDeployAdapterOptions {
  token?: string;
  tokenProvider?: () => Promise<string | undefined>;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

const SITE_ID = /^[A-Za-z0-9._-]{1,100}$/;

export class NetlifyDeployAdapter implements ToolAdapter {
  readonly name = 'netlify';
  readonly capabilities: string[] = ['site.published_deploy'];

  private readonly token?: string;
  private readonly tokenProvider?: () => Promise<string | undefined>;
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NetlifyDeployAdapterOptions = {}) {
    this.token = options.token;
    this.tokenProvider = options.tokenProvider;
    this.apiBase = (options.apiBase ?? 'https://api.netlify.com/api/v1').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported Netlify action: ${request.action}` };
    }
    const siteId = typeof request.input.siteId === 'string' ? request.input.siteId.trim() : '';
    if (!SITE_ID.test(siteId)) {
      return { ok: false, error: 'Netlify input siteId is invalid' };
    }
    const token = (this.tokenProvider ? await this.tokenProvider() : this.token)?.trim();
    if (!token) {
      return {
        ok: false,
        error: 'Netlify is not authenticated; provide a read token through the secure credential provider.',
      };
    }

    await onProgress({ phase: 'progress', message: `Netlify: published deploy of ${siteId}`, percent: 30 });

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiBase}/sites/${encodeURIComponent(siteId)}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      });
    } catch (error) {
      return { ok: false, error: `Netlify request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!response.ok) {
      return { ok: false, error: `Netlify responded ${response.status}` };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, error: 'Netlify response is not valid JSON' };
    }
    if (!isRecord(body)) return { ok: false, error: 'Netlify site response is malformed' };
    const deploy = body.published_deploy;
    if (!isRecord(deploy) || typeof deploy.id !== 'string') {
      return { ok: false, error: 'Netlify site has no published deploy' };
    }

    return {
      ok: true,
      output: {
        provider: 'netlify',
        siteId: typeof body.id === 'string' ? body.id : siteId,
        deployId: deploy.id,
        state: stringOrNull(deploy.state),
        context: stringOrNull(deploy.context),
        branch: stringOrNull(deploy.branch),
        // Deliberately only the structured commit_ref; free-text titles are never parsed as evidence.
        commitSha: stringOrNull(deploy.commit_ref),
        title: stringOrNull(deploy.title),
        publishedAt: stringOrNull(deploy.published_at),
        observedAt: new Date().toISOString(),
      },
      externalReference: `netlify:site/${siteId}/deploy/${deploy.id}`,
    };
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
