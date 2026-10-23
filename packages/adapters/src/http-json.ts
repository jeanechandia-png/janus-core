/**
 * Shared, minimal JSON-over-HTTPS helper for Tool Gateway adapters (LEGO piece).
 * Bounded time and size, never logs tokens, never follows redirects to other
 * hosts silently (fetch default 'follow' is replaced by 'error').
 */
export interface JsonHttpResult {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
}

export async function requestJson(input: {
  fetchImpl: typeof fetch;
  url: string;
  method?: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  maxBytes?: number;
  service: string;
}): Promise<JsonHttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 20_000);
  try {
    const response = await input.fetchImpl(input.url, {
      method: input.method ?? 'GET',
      redirect: 'error',
      headers: { accept: 'application/json', ...(input.body !== undefined ? { 'content-type': 'application/json' } : {}), ...input.headers },
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
      signal: controller.signal,
    });
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > (input.maxBytes ?? 2 * 1024 * 1024)) {
      return { ok: false, status: response.status, body: null, error: `${input.service} response is too large` };
    }
    let body: unknown = null;
    if (text) {
      try { body = JSON.parse(text); } catch { return { ok: false, status: response.status, body: null, error: `${input.service} response is not valid JSON` }; }
    }
    if (!response.ok) {
      return { ok: false, status: response.status, body, error: `${input.service} responded ${response.status}${errorDetail(body)}` };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: null, error: `${input.service} request failed: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timer);
  }
}

function errorDetail(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as Record<string, unknown>;
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const first = errors[0] && typeof errors[0] === 'object' ? (errors[0] as Record<string, unknown>).message : undefined;
  const nested = record.error && typeof record.error === 'object' ? (record.error as Record<string, unknown>).message : record.error;
  const message = first ?? nested;
  return typeof message === 'string' && message ? `: ${message.slice(0, 200)}` : '';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cleanId(value: unknown, pattern: RegExp): string | null {
  const text = typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
  return pattern.test(text) ? text : null;
}
