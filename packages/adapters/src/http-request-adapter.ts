import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord } from './http-json.js';

/**
 * Generic HTTP request adapter (LEGO piece) for the Janus flow engine — the equivalent of n8n's "HTTP Request" node,
 * but without its open door: a workflow NEVER supplies a URL, only the NAME of an endpoint the Founder authorised
 * (JANUS_HTTP_ENDPOINTS) plus a path inside it.
 *
 * Guarantees (each one covered by tests/http-request-adapter.test.ts):
 *  - https only; host fixed by the Founder's config; IP literals, localhost and private ranges refused unless the
 *    endpoint is explicitly marked `allowPrivateNetwork` (home devices on the LAN).
 *  - path must stay inside the endpoint (no `..`, no scheme, no `//`, no encoded traversal) and, if configured,
 *    inside `allowPrefixes`.
 *  - actions: `request.read` (GET/HEAD) and `request.send` (POST/PUT/PATCH/DELETE). The method must match the action,
 *    so the Tool Gateway's privileged-action rule (`send`) cannot be bypassed by relabelling a write as a read.
 *  - credentials only through the CredentialBroker (`credentialService`), injected as a header; workflows cannot set
 *    Authorization/Cookie/Host and the secret is never returned in the output or in errors.
 *  - redirects are not followed; response size and time are capped; the body is returned as DATA (untrusted).
 */
export interface HttpEndpointConfig {
  /** https://host[:port][/base] — fixed by the Founder, never by a workflow. */
  baseUrl: string;
  /** Allowed methods for this endpoint (default: GET, HEAD). */
  methods?: readonly HttpMethod[];
  /** If set, the request path must start with one of these prefixes. */
  allowPrefixes?: readonly string[];
  /** Credential service name resolved by the CredentialBroker. */
  credentialService?: string;
  /** How the secret is sent. Default: bearer in `Authorization`. */
  auth?: { type: 'bearer' } | { type: 'header'; name: string };
  allowPrivateNetwork?: boolean;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const READ_METHODS: readonly HttpMethod[] = ['GET', 'HEAD'];
const WRITE_METHODS: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
const ALL_METHODS = new Set<string>([...READ_METHODS, ...WRITE_METHODS]);

export interface HttpRequestAdapterOptions {
  endpoints: Readonly<Record<string, HttpEndpointConfig>>;
  tokenProvider?: (service: string) => Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

const NAME = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_HEADERS = new Set(['accept', 'accept-language', 'content-type', 'if-none-match', 'if-modified-since', 'x-request-id', 'user-agent']);
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 256 * 1024;
const MAX_QUERY_PARAMS = 40;

/** Parse JANUS_HTTP_ENDPOINTS (JSON object name → config). Throws a clear error on any invalid entry. */
export function parseHttpEndpoints(value: string | undefined): Record<string, HttpEndpointConfig> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('JANUS_HTTP_ENDPOINTS must be a JSON object { name: { baseUrl, ... } }'); }
  if (!isRecord(parsed)) throw new Error('JANUS_HTTP_ENDPOINTS must be a JSON object { name: { baseUrl, ... } }');
  const out: Record<string, HttpEndpointConfig> = {};
  for (const [name, raw] of Object.entries(parsed)) {
    if (!NAME.test(name)) throw new Error(`JANUS_HTTP_ENDPOINTS: invalid endpoint name "${name}"`);
    if (!isRecord(raw) || typeof raw.baseUrl !== 'string') throw new Error(`JANUS_HTTP_ENDPOINTS.${name}: baseUrl is required`);
    const config: HttpEndpointConfig = { baseUrl: raw.baseUrl };
    if (Array.isArray(raw.methods)) {
      const methods = raw.methods.map((m) => String(m).toUpperCase());
      if (methods.some((m) => !ALL_METHODS.has(m))) throw new Error(`JANUS_HTTP_ENDPOINTS.${name}: unsupported method`);
      config.methods = methods as HttpMethod[];
    }
    if (Array.isArray(raw.allowPrefixes)) config.allowPrefixes = raw.allowPrefixes.map(String);
    if (typeof raw.credentialService === 'string') config.credentialService = raw.credentialService;
    if (isRecord(raw.auth)) {
      if (raw.auth.type === 'bearer') config.auth = { type: 'bearer' };
      else if (raw.auth.type === 'header' && typeof raw.auth.name === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(raw.auth.name)) config.auth = { type: 'header', name: raw.auth.name };
      else throw new Error(`JANUS_HTTP_ENDPOINTS.${name}: invalid auth`);
    }
    if (raw.allowPrivateNetwork === true) config.allowPrivateNetwork = true;
    if (typeof raw.timeoutMs === 'number') config.timeoutMs = raw.timeoutMs;
    if (typeof raw.maxResponseBytes === 'number') config.maxResponseBytes = raw.maxResponseBytes;
    const problem = validateEndpoint(config);
    if (problem) throw new Error(`JANUS_HTTP_ENDPOINTS.${name}: ${problem}`);
    out[name] = config;
  }
  return out;
}

/** Returns a reason when the endpoint config is unsafe, or null when it is acceptable. */
export function validateEndpoint(config: HttpEndpointConfig): string | null {
  let url: URL;
  try { url = new URL(config.baseUrl); } catch { return 'baseUrl is not a valid URL'; }
  if (url.protocol !== 'https:') return 'baseUrl must be https';
  if (url.username || url.password) return 'baseUrl must not embed credentials';
  if (url.search || url.hash) return 'baseUrl must not include a query or fragment';
  if (!config.allowPrivateNetwork && isPrivateHost(url.hostname)) return 'private/loopback hosts require allowPrivateNetwork: true';
  const writes = (config.methods ?? []).some((m) => WRITE_METHODS.includes(m));
  if (writes && config.credentialService === undefined && !config.allowPrivateNetwork) {
    // Writing to a public host without any credential is almost always a misconfiguration; make it explicit.
    return 'write methods on a public host require credentialService';
  }
  return null;
}

export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split('.').map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (host.includes(':')) return true; // any IPv6 literal is treated as private/unsupported
  return false;
}

/** Path must stay inside the endpoint. Returns the normalised path or an error message. */
export function checkPath(value: unknown, allowPrefixes?: readonly string[]): { path: string } | { error: string } {
  if (typeof value !== 'string' || !value.startsWith('/')) return { error: 'path must be a string starting with "/"' };
  if (value.length > 2000) return { error: 'path is too long' };
  if (/[\u0000-\u001f\u007f\\#?@]/.test(value)) return { error: 'path contains forbidden characters (use "query" for parameters)' };
  if (value.startsWith('//')) return { error: 'path must not start with "//"' };
  let decoded: string;
  try { decoded = decodeURIComponent(value); } catch { return { error: 'path has invalid percent-encoding' }; }
  if (/(^|\/)\.\.?(\/|$)/.test(decoded) || /(^|\/)\.\.?(\/|$)/.test(value)) return { error: 'path traversal is not allowed' };
  if (/^\/[A-Za-z][A-Za-z0-9+.-]*:/.test(decoded)) return { error: 'path must not contain a scheme' };
  if (allowPrefixes?.length && !allowPrefixes.some((p) => value.startsWith(p))) return { error: 'path is outside the allowed prefixes for this endpoint' };
  return { path: value };
}

export class HttpRequestAdapter implements ToolAdapter {
  readonly name = 'http';
  readonly capabilities: string[] = ['request.read', 'request.send'];
  private readonly fetchImpl: typeof fetch;
  private readonly endpoints: Readonly<Record<string, HttpEndpointConfig>>;

  constructor(private readonly options: HttpRequestAdapterOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoints = options.endpoints;
    for (const [name, config] of Object.entries(this.endpoints)) {
      const problem = NAME.test(name) ? validateEndpoint(config) : 'invalid endpoint name';
      if (problem) throw new Error(`HTTP endpoint "${name}": ${problem}`);
    }
  }

  /** Names of authorised endpoints (never URLs or credentials) — for catalogs and the dashboard. */
  endpointNames(): string[] { return Object.keys(this.endpoints); }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported http action: ${request.action}` };
    const input = request.input;

    const endpointName = typeof input.endpoint === 'string' ? input.endpoint : '';
    const endpoint = NAME.test(endpointName) ? this.endpoints[endpointName] : undefined;
    if (!endpoint) return { ok: false, error: `HTTP endpoint "${endpointName}" is not in the Founder allowlist` };

    const method = String(input.method ?? 'GET').toUpperCase();
    if (!ALL_METHODS.has(method)) return { ok: false, error: `Unsupported HTTP method: ${method}` };
    const isRead = (READ_METHODS as readonly string[]).includes(method);
    if (isRead && request.action !== 'request.read') return { ok: false, error: 'GET/HEAD must use action request.read' };
    if (!isRead && request.action !== 'request.send') return { ok: false, error: `${method} must use action request.send (it writes to an external system)` };
    if (!(endpoint.methods ?? READ_METHODS).includes(method as HttpMethod)) return { ok: false, error: `Method ${method} is not allowed for endpoint "${endpointName}"` };

    const checked = checkPath(input.path, endpoint.allowPrefixes);
    if ('error' in checked) return { ok: false, error: checked.error };

    const base = new URL(endpoint.baseUrl);
    const basePath = base.pathname.replace(/\/$/, '');
    const url = new URL(`${base.origin}${basePath}${checked.path}`);
    if (url.origin !== base.origin || !url.pathname.startsWith(basePath || '/')) return { ok: false, error: 'resolved URL left the endpoint' };

    const query = input.query;
    if (query !== undefined) {
      if (!isRecord(query)) return { ok: false, error: 'query must be an object of primitive values' };
      const entries = Object.entries(query);
      if (entries.length > MAX_QUERY_PARAMS) return { ok: false, error: 'too many query parameters' };
      for (const [key, value] of entries) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'object') return { ok: false, error: `query.${key} must be a string, number or boolean` };
        url.searchParams.append(key, String(value));
      }
    }

    const headers = new Headers({ accept: 'application/json, text/plain;q=0.8, */*;q=0.1' });
    if (input.headers !== undefined) {
      if (!isRecord(input.headers)) return { ok: false, error: 'headers must be an object' };
      for (const [key, value] of Object.entries(input.headers)) {
        const lower = key.toLowerCase();
        if (!SAFE_HEADERS.has(lower)) return { ok: false, error: `Header "${key}" is not allowed (credentials are injected by Janus)` };
        if (typeof value !== 'string' || /[\r\n]/.test(value)) return { ok: false, error: `Header "${key}" must be a single-line string` };
        headers.set(lower, value);
      }
    }

    let body: string | undefined;
    if (input.body !== undefined && input.body !== null) {
      if (isRead) return { ok: false, error: `${method} cannot carry a body` };
      body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
      if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) return { ok: false, error: 'request body is too large' };
      if (!headers.has('content-type')) headers.set('content-type', typeof input.body === 'string' ? 'text/plain; charset=utf-8' : 'application/json');
    }

    if (endpoint.credentialService) {
      const token = (await this.options.tokenProvider?.(endpoint.credentialService))?.trim();
      if (!token) return { ok: false, error: `HTTP endpoint "${endpointName}" needs a credential (${endpoint.credentialService}); provide it through the secure credential provider.` };
      if (/[\r\n]/.test(token)) return { ok: false, error: 'Credential is malformed' };
      if (endpoint.auth?.type === 'header') headers.set(endpoint.auth.name, token);
      else headers.set('authorization', `Bearer ${token}`);
    }
    if (!isRead && request.idempotencyKey && !headers.has('idempotency-key')) headers.set('idempotency-key', request.idempotencyKey);

    await onProgress({ phase: 'progress', message: `HTTP ${method} ${endpointName}${checked.path}`, percent: 40 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(endpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS, 60_000));
    try {
      const response = await this.fetchImpl(url.toString(), { method, headers, redirect: 'manual', signal: controller.signal, ...(body !== undefined ? { body } : {}) });
      if (response.status >= 300 && response.status < 400) {
        return { ok: false, error: `HTTP ${response.status}: the endpoint redirected; redirects are not followed (use the final path)` };
      }
      const maxBytes = Math.min(endpoint.maxResponseBytes ?? DEFAULT_MAX_BYTES, 8 * 1024 * 1024);
      const { text, truncated } = await readCapped(response, maxBytes);
      const contentType = response.headers.get('content-type') ?? '';
      let parsed: unknown = text;
      if (/json/i.test(contentType) && text && !truncated) {
        try { parsed = JSON.parse(text); } catch { parsed = text; }
      }
      const output: Record<string, unknown> = {
        status: response.status,
        ok: response.ok,
        contentType,
        body: method === 'HEAD' ? null : parsed,
        truncated,
        // The remote body is DATA, never instructions for Janus.
        untrusted: true,
        endpoint: endpointName,
      };
      if (!response.ok) return { ok: false, error: `HTTP ${response.status} from ${endpointName}${errorHint(parsed)}`, output };
      return { ok: true, output, externalReference: `http:${endpointName}:${method}:${checked.path}` };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return { ok: false, error: aborted ? `HTTP request to ${endpointName} timed out` : `HTTP request to ${endpointName} failed: ${error instanceof Error ? error.message : String(error)}` };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!response.body) return { text: '', truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      const keep = value.byteLength - (total - maxBytes);
      if (keep > 0) chunks.push(value.subarray(0, keep));
      truncated = true;
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  return { text: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'), truncated };
}

function errorHint(body: unknown): string {
  if (typeof body === 'string') return body ? `: ${body.slice(0, 160).replace(/\s+/g, ' ')}` : '';
  if (isRecord(body)) {
    const message = isRecord(body.error) ? body.error.message : body.message ?? body.error;
    if (typeof message === 'string' && message) return `: ${message.slice(0, 160)}`;
  }
  return '';
}
