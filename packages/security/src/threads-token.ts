import { CredentialRefreshError, type CredentialVault, type VaultCredential } from './credential-vault.js';
import type { CredentialRefresher, RefreshOutcome } from './google-oauth.js';

/**
 * Threads: el token de larga duración se guarda cifrado en el almacén y se renueva solo.
 *
 * Hechos verificados en la documentación oficial de Threads (2026-10-23):
 * - Canje de un token de corta duración por uno de larga duración: `GET https://graph.threads.com/access_token?grant_type=th_exchange_token&client_secret=…&access_token=…`
 * - Renovación: `GET https://graph.threads.com/refresh_access_token?grant_type=th_refresh_token&access_token=…`; el token debe tener al menos 24 h
 *   y se renueva 60 días; no necesita el secreto de la aplicación.
 * La API exige el token en la dirección (no en una cabecera): este módulo no registra direcciones ni cuerpos, y los errores no los incluyen.
 */
export const THREADS_SERVICE = 'threads';
const THREADS_API = 'https://graph.threads.com';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export interface ThreadsTokenOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

async function threadsGet(fetchImpl: typeof fetch, path: string, query: Record<string, string>): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = new URL(`${THREADS_API}${path}`);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(url.toString(), { method: 'GET', redirect: 'error', headers: { accept: 'application/json' }, signal: controller.signal });
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new CredentialRefreshError('response_too_large', 'Threads response is too large');
    let body: Record<string, unknown> = {};
    try {
      const value = JSON.parse(text) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) body = value as Record<string, unknown>;
    } catch {
      throw new CredentialRefreshError('bad_response', `Threads returned a non-JSON response (${response.status})`, response.status >= 500);
    }
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof CredentialRefreshError) throw error;
    throw new CredentialRefreshError('network_error', 'Threads could not be reached', true);
  } finally {
    clearTimeout(timer);
  }
}

function failure(status: number, body: Record<string, unknown>): CredentialRefreshError {
  const detail = body.error && typeof body.error === 'object' ? (body.error as Record<string, unknown>) : {};
  const code = typeof detail.code === 'number' || typeof detail.code === 'string' ? String(detail.code).slice(0, 20) : `http_${status}`;
  return new CredentialRefreshError(`threads_${code}`, `Threads rejected the request (${code})`, status >= 500 || status === 429);
}

/** Canjea un token de corta duración por uno de larga duración (necesita el secreto de la aplicación). */
export async function exchangeThreadsToken(input: { shortLivedToken: string; clientSecret: string } & ThreadsTokenOptions): Promise<{ accessToken: string; expiresAt: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const now = (input.now ?? (() => new Date()))();
  const { status, body } = await threadsGet(fetchImpl, '/access_token', {
    grant_type: 'th_exchange_token',
    client_secret: input.clientSecret,
    access_token: input.shortLivedToken,
  });
  if (status < 200 || status >= 300 || typeof body.access_token !== 'string') throw failure(status, body);
  const seconds = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 60 * 24 * 3600;
  return { accessToken: body.access_token, expiresAt: new Date(now.getTime() + seconds * 1000).toISOString() };
}

/** Renovador para el proveedor del almacén. Un token con menos de 24 h no se puede renovar todavía: se deja como está. */
export function threadsRefresher(options: ThreadsTokenOptions = {}): CredentialRefresher {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nowFn = options.now ?? (() => new Date());
  return async (entry: VaultCredential): Promise<RefreshOutcome> => {
    if (!entry.accessToken) throw new CredentialRefreshError('no_token', 'There is no Threads token to refresh');
    const now = nowFn();
    if (now.getTime() - Date.parse(entry.updatedAt) < DAY_MS && entry.expiresAt && Date.parse(entry.expiresAt) > now.getTime()) {
      return { accessToken: entry.accessToken, expiresAt: entry.expiresAt };
    }
    const { status, body } = await threadsGet(fetchImpl, '/refresh_access_token', {
      grant_type: 'th_refresh_token',
      access_token: entry.accessToken,
    });
    if (status < 200 || status >= 300 || typeof body.access_token !== 'string') throw failure(status, body);
    const seconds = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 60 * 24 * 3600;
    return { accessToken: body.access_token, expiresAt: new Date(now.getTime() + seconds * 1000).toISOString() };
  };
}

/** Guarda un token de larga duración en el almacén (la renovación empieza a las 24 h y el token se renueva unos días antes de caducar). */
export async function storeThreadsToken(vault: CredentialVault, input: { accessToken: string; expiresAt?: string }): Promise<void> {
  const token = input.accessToken.trim();
  if (!token || token.length > 2048 || /\s/.test(token)) throw new Error('The Threads token has an invalid format');
  await vault.put({
    service: THREADS_SERVICE,
    kind: 'long-lived-token',
    accessToken: token,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });
}
