import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';

/**
 * Hostinger READ adapter (public API, https://developers.hostinger.com, Bearer token from hPanel).
 * Verified 2026-10-16 against docs.hostinger.com: GET /api/hosting/v1/websites (paginated list of
 * websites accessible to the token). The response item field names are NOT rendered in the public docs
 * pages → POR CONFIRMAR: the adapter returns only a whitelist of well-known fields and never fails on
 * extra/missing ones.
 */
export interface HostingerAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const SAFE_FIELDS = ['domain', 'username', 'order_id', 'is_enabled', 'status', 'type', 'root_directory', 'created_at'];

export class HostingerAdapter implements ToolAdapter {
  readonly name = 'hostinger';
  readonly capabilities: string[] = ['websites.list'];
  private readonly apiBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HostingerAdapterOptions = {}) {
    this.apiBase = (options.apiBase ?? 'https://developers.hostinger.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Hostinger action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Hostinger is not authenticated; provide the API token (HOSTINGER_API_TOKEN).' };
    await onProgress({ phase: 'progress', message: 'Hostinger: webs', percent: 40 });
    const result = await requestJson({ fetchImpl: this.fetchImpl, url: `${this.apiBase}/api/hosting/v1/websites`, headers: { authorization: `Bearer ${token}` }, service: 'Hostinger' });
    if (!result.ok) return { ok: false, error: result.error };
    const body = result.body;
    const items = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.data) ? body.data : [];
    const websites = items.filter(isRecord).map((item) => Object.fromEntries(SAFE_FIELDS.filter((key) => key in item).map((key) => [key, item[key]])));
    return { ok: true, output: { websites, count: websites.length } };
  }
}
