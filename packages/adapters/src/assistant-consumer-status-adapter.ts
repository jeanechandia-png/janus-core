import type {
  ToolAdapter,
  ToolProgress,
  ToolRequest,
  ToolResult,
} from '../../gateways/src/contracts.js';

/**
 * Read-only probe of a product runtime's public assistant-control status
 * endpoint. It lets Janus observe, by itself, which bundle a live consumer
 * has actually loaded instead of trusting a typed checksum.
 *
 * Hard limits: HTTPS only, exact-URL allowlist, GET only, no credentials,
 * no redirects, bounded time and size.
 */
export interface AssistantConsumerStatusAdapterOptions {
  allowedUrls: readonly string[];
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

export class AssistantConsumerStatusAdapter implements ToolAdapter {
  readonly name = 'assistant-consumer';
  readonly capabilities: string[] = ['status.read'];

  private readonly allowed: Set<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;

  constructor(options: AssistantConsumerStatusAdapterOptions) {
    this.allowed = new Set(options.allowedUrls.map(normalizeUrl).filter((url): url is string => Boolean(url)));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxBytes = options.maxBytes ?? 64 * 1024;
  }

  async execute(
    request: ToolRequest,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) {
      return { ok: false, error: `Unsupported assistant-consumer action: ${request.action}` };
    }
    const url = normalizeUrl(typeof request.input.url === 'string' ? request.input.url : '');
    if (!url || !this.allowed.has(url)) {
      return { ok: false, error: 'consumer status URL is not in the allowlist' };
    }
    await onProgress({ phase: 'progress', message: `Consumer status: ${url}`, percent: 30 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        credentials: 'omit',
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      return { ok: false, error: `consumer status request failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    try {
      if (!response.ok) return { ok: false, error: `consumer status responded ${response.status}` };
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > this.maxBytes) {
        return { ok: false, error: 'consumer status response is too large' };
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return { ok: false, error: 'consumer status response is not valid JSON' };
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return { ok: false, error: 'consumer status response is malformed' };
      }
      return {
        ok: true,
        output: { url, observedAt: new Date().toISOString(), body: body as Record<string, unknown> },
        externalReference: url,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}
