import { createHash, randomBytes } from 'node:crypto';
import type { CredentialLease, CredentialProvider, CredentialRequest, CredentialStatus } from './credential-provider.js';
import { CredentialRefreshError, type CredentialVault, type VaultCredential } from './credential-vault.js';

/**
 * Google OAuth 2.0 para aplicación de escritorio / servidor propio: código de autorización con PKCE (S256), un consentimiento por buzón.
 *
 * Hechos verificados en la documentación oficial de Google (2026-10-23): endpoint de autorización
 * `https://accounts.google.com/o/oauth2/v2/auth`; redirección de bucle local `http://127.0.0.1:<puerto>`; `response_type=code`;
 * PKCE S256 recomendado; endpoint de tokens `https://oauth2.googleapis.com/token` (el secreto de cliente es opcional en clientes de
 * escritorio); renovación con `grant_type=refresh_token`; revocación en `https://oauth2.googleapis.com/revoke`.
 *
 * Mínimo privilegio: lectura y escritura son consentimientos SEPARADOS y se guardan en credenciales separadas
 * (`google-workspace:<buzón>` y `google-workspace-write:<buzón>`): quien solo puede leer no puede redactar ni enviar.
 *
 * Nada de lo que reciba este módulo se escribe en registros ni se devuelve en errores: los mensajes llevan el código de error de Google, no tokens.
 */
export const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

export const GOOGLE_READ_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
] as const;
export const GOOGLE_WRITE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events',
] as const;
const IDENTITY_SCOPES = ['openid', 'email'] as const;

export type GoogleConsentMode = 'read' | 'write';

export function googleCredentialService(mode: GoogleConsentMode, accountId: string): string {
  return mode === 'read' ? `google-workspace:${accountId}` : `google-workspace-write:${accountId}`;
}

export function googleScopesFor(mode: GoogleConsentMode): readonly string[] {
  return mode === 'read' ? GOOGLE_READ_SCOPES : GOOGLE_WRITE_SCOPES;
}

export class GoogleOAuthError extends CredentialRefreshError {
  constructor(code: string, message: string, retryable = false) {
    super(code, message, retryable);
    this.name = 'GoogleOAuthError';
  }
}

export interface GoogleOAuthClientOptions {
  clientId: string;
  /** Opcional en clientes de escritorio; obligatorio en clientes de tipo «aplicación web». Nunca se registra. */
  clientSecret?: string;
  /** URL completa del callback registrada en Google Cloud (HTTPS, o bucle local http://127.0.0.1:<puerto>/…). */
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  /** Vida de una solicitud pendiente. */
  pendingTtlMs?: number;
}

interface PendingAuthorization {
  accountId: string;
  mode: GoogleConsentMode;
  expectedEmail: string;
  verifier: string;
  scopes: string[];
  expiresAt: number;
}

export interface AuthorizationRequest {
  url: string;
  state: string;
  expiresAt: string;
  scopes: string[];
}

export interface ConsentResult {
  accountId: string;
  mode: GoogleConsentMode;
  service: string;
  accountEmail: string;
  grantedScopes: string[];
  missingScopes: string[];
  hasRefreshToken: boolean;
  expiresAt: string;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  token_type?: string;
}

const MAX_PENDING = 20;
const MAX_RESPONSE_BYTES = 256 * 1024;

export function assertRedirectUri(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('OAuth redirect URI is not a valid URL');
  }
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('OAuth redirect URI must be https, or http on a loopback address');
  }
  if (url.hash || url.search || url.username || url.password) {
    throw new Error('OAuth redirect URI may not carry a fragment, query or credentials');
  }
  return url;
}

export class GoogleOAuthClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly pending = new Map<string, PendingAuthorization>();
  private readonly ttl: number;
  readonly redirectUri: string;

  constructor(private readonly options: GoogleOAuthClientOptions) {
    if (!options.clientId.trim()) throw new Error('Google OAuth client id is required');
    this.redirectUri = assertRedirectUri(options.redirectUri).toString();
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.ttl = options.pendingTtlMs ?? 10 * 60_000;
  }

  /** Crea la dirección a la que el Founder va a dar su consentimiento. El `state` es secreto, de un solo uso y caduca. */
  createAuthorizationRequest(input: { accountId: string; mode: GoogleConsentMode; expectedEmail: string }): AuthorizationRequest {
    const expectedEmail = input.expectedEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(expectedEmail)) throw new Error('A mailbox address is required to request consent');
    this.sweep();
    if (this.pending.size >= MAX_PENDING) throw new GoogleOAuthError('too_many_pending', 'Too many consent requests are pending; wait for them to expire', true);
    // Un nuevo intento para el mismo buzón y modo sustituye al anterior.
    for (const [state, entry] of this.pending) {
      if (entry.accountId === input.accountId && entry.mode === input.mode) this.pending.delete(state);
    }
    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const scopes = [...googleScopesFor(input.mode)];
    const expiresAt = this.now().getTime() + this.ttl;
    this.pending.set(state, { accountId: input.accountId, mode: input.mode, expectedEmail, verifier, scopes, expiresAt });
    const url = new URL(GOOGLE_AUTH_ENDPOINT);
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', [...IDENTITY_SCOPES, ...scopes].join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('access_type', 'offline');
    // Sin esto Google no entrega token de renovación en consentimientos repetidos.
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('login_hint', expectedEmail);
    return { url: url.toString(), state, expiresAt: new Date(expiresAt).toISOString(), scopes };
  }

  /**
   * Completa el consentimiento: valida el `state`, canjea el código, COMPRUEBA que la cuenta autorizada es la del buzón registrado
   * y devuelve la credencial lista para guardar. Si la cuenta no coincide, revoca lo recibido y no guarda nada.
   */
  async completeAuthorization(input: { state: string; code: string }): Promise<{ result: ConsentResult; credential: Omit<VaultCredential, 'createdAt' | 'updatedAt'> }> {
    const pending = this.pending.get(input.state);
    // Un solo uso, también si falla.
    this.pending.delete(input.state);
    if (!pending) throw new GoogleOAuthError('unknown_state', 'The consent request is unknown or was already used');
    if (pending.expiresAt <= this.now().getTime()) throw new GoogleOAuthError('expired_state', 'The consent request expired; start again');
    if (!input.code.trim()) throw new GoogleOAuthError('missing_code', 'Google did not return an authorization code');

    const tokens = await this.tokenRequest({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: this.redirectUri,
      code_verifier: pending.verifier,
    });
    if (!tokens.access_token) throw new GoogleOAuthError('bad_token_response', 'Google returned no access token');

    const identity = this.identityFrom(tokens.id_token);
    if (!identity || identity.email !== pending.expectedEmail) {
      await this.revoke(tokens.refresh_token ?? tokens.access_token).catch(() => undefined);
      throw new GoogleOAuthError(
        'account_mismatch',
        identity
          ? 'The Google account that gave consent is not the registered mailbox; nothing was stored'
          : 'The Google account could not be verified; nothing was stored',
      );
    }

    const grantedScopes = (tokens.scope ?? '').split(/\s+/).filter(Boolean).filter((scope) => !(IDENTITY_SCOPES as readonly string[]).includes(scope) && !/^https:\/\/www\.googleapis\.com\/auth\/userinfo\./.test(scope));
    const missingScopes = pending.scopes.filter((scope) => !grantedScopes.includes(scope));
    const expiresAt = new Date(this.now().getTime() + Math.max(60, Number(tokens.expires_in ?? 3600)) * 1000).toISOString();
    const service = googleCredentialService(pending.mode, pending.accountId);
    return {
      result: {
        accountId: pending.accountId,
        mode: pending.mode,
        service,
        accountEmail: identity.email,
        grantedScopes,
        missingScopes,
        hasRefreshToken: Boolean(tokens.refresh_token),
        expiresAt,
      },
      credential: {
        service,
        kind: 'oauth-google',
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt,
        requestedScopes: pending.scopes,
        grantedScopes,
        accountEmail: identity.email,
      },
    };
  }

  /** Renueva el acceso con el token de renovación. `invalid_grant` significa que el permiso ya no existe. */
  async refresh(refreshToken: string): Promise<{ accessToken: string; expiresAt: string; refreshToken?: string; grantedScopes?: string[] }> {
    const tokens = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (!tokens.access_token) throw new GoogleOAuthError('bad_token_response', 'Google returned no access token');
    return {
      accessToken: tokens.access_token,
      expiresAt: new Date(this.now().getTime() + Math.max(60, Number(tokens.expires_in ?? 3600)) * 1000).toISOString(),
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      ...(tokens.scope ? { grantedScopes: tokens.scope.split(/\s+/).filter((scope) => scope.startsWith('https://www.googleapis.com/auth/') && !scope.includes('/userinfo.')) } : {}),
    };
  }

  /** Revoca el permiso en Google. Devuelve true si Google lo aceptó. */
  async revoke(token: string): Promise<boolean> {
    const response = await this.post(GOOGLE_REVOKE_ENDPOINT, { token });
    return response.status >= 200 && response.status < 300;
  }

  /** Descarta una solicitud pendiente (p. ej. el Founder canceló en la pantalla de Google). */
  cancel(state: string): void {
    this.pending.delete(state);
  }

  /** Cantidad de solicitudes de consentimiento pendientes (solo para pruebas y diagnóstico). */
  pendingCount(): number {
    this.sweep();
    return this.pending.size;
  }

  private sweep(): void {
    const now = this.now().getTime();
    for (const [state, entry] of this.pending) if (entry.expiresAt <= now) this.pending.delete(state);
  }

  private async tokenRequest(fields: Record<string, string>): Promise<TokenResponse> {
    const body: Record<string, string> = { ...fields, client_id: this.options.clientId };
    if (this.options.clientSecret) body.client_secret = this.options.clientSecret;
    const response = await this.post(GOOGLE_TOKEN_ENDPOINT, body);
    let parsed: Record<string, unknown> = {};
    try {
      const value = JSON.parse(response.text) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) parsed = value as Record<string, unknown>;
    } catch {
      throw new GoogleOAuthError('bad_token_response', `Google token endpoint returned a non-JSON response (${response.status})`, response.status >= 500);
    }
    if (response.status < 200 || response.status >= 300) {
      // Solo el código de error de Google; nunca el cuerpo completo.
      const code = typeof parsed.error === 'string' ? parsed.error.slice(0, 60) : `http_${response.status}`;
      throw new GoogleOAuthError(code, `Google token endpoint rejected the request: ${code}`, response.status >= 500 || response.status === 429);
    }
    return parsed as TokenResponse;
  }

  private async post(url: string, fields: Record<string, string>): Promise<{ status: number; text: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        redirect: 'error',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams(fields).toString(),
        signal: controller.signal,
      });
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new GoogleOAuthError('response_too_large', 'Google response is too large');
      return { status: response.status, text };
    } catch (error) {
      if (error instanceof GoogleOAuthError) throw error;
      throw new GoogleOAuthError('network_error', 'Google could not be reached', true);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Identidad desde el `id_token`. Se recibió directamente del endpoint de tokens de Google por TLS, por lo que (OpenID Connect Core,
   * §3.1.3.7) la comprobación de la firma puede sustituirse por la validación del servidor TLS; aun así se exige emisor, audiencia,
   * vigencia y correo verificado.
   */
  private identityFrom(idToken: string | undefined): { email: string } | null {
    if (!idToken) return null;
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    try {
      const claims = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
      const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') return null;
      if (!audience.includes(this.options.clientId)) return null;
      if (typeof claims.exp !== 'number' || claims.exp * 1000 <= this.now().getTime()) return null;
      if (claims.email_verified !== true || typeof claims.email !== 'string') return null;
      return { email: claims.email.trim().toLowerCase() };
    } catch {
      return null;
    }
  }
}

/* ------------------------------------------------------------------ Proveedor con renovación */

export interface RefreshOutcome {
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
  grantedScopes?: string[];
}

/** Devuelve el resultado, o lanza `CredentialRefreshError`; `invalid_grant` (o cualquier error no reintentable) marca el permiso como perdido. */
export type CredentialRefresher = (entry: VaultCredential) => Promise<RefreshOutcome>;

export interface VaultCredentialProviderOptions {
  vault: CredentialVault;
  refreshers: Partial<Record<VaultCredential['kind'], CredentialRefresher>>;
  now?: () => Date;
  /** Se renueva con este margen antes de que caduque. */
  skewMs?: number;
  sourceName?: string;
}

/**
 * Entrega al CredentialBroker el token vigente de cada servicio guardado en el almacén, renovándolo cuando hace falta.
 * Va ANTES del proveedor de entorno: un token del almacén gana sobre una variable de desarrollo.
 */
export class VaultCredentialProvider implements CredentialProvider {
  private readonly inflight = new Map<string, Promise<VaultCredential | null>>();
  private readonly now: () => Date;
  private readonly skewMs: number;
  private readonly sourceName: string;

  constructor(private readonly options: VaultCredentialProviderOptions) {
    this.now = options.now ?? (() => new Date());
    this.skewMs = options.skewMs ?? 120_000;
    this.sourceName = options.sourceName ?? 'credential-vault';
  }

  async get(request: CredentialRequest): Promise<CredentialLease | null> {
    let entry: VaultCredential | null;
    try {
      entry = await this.options.vault.get(request.service);
    } catch {
      // Un almacén ilegible no debe tumbar al broker: otro proveedor puede responder, y el estado lo muestra `status()`.
      return null;
    }
    if (!entry || entry.needsReconsent) return null;
    if (entry.accessToken && !this.expiringSoon(entry)) return this.lease(entry);
    const renewed = await this.renew(entry);
    return renewed?.accessToken ? this.lease(renewed) : null;
  }

  async status(service: string): Promise<CredentialStatus> {
    try {
      const description = await this.options.vault.describe(service);
      if (!description) return { configured: false };
      if (description.needsReconsent) return { configured: false, source: this.sourceName, reason: 'El permiso ya no es válido: hace falta un nuevo consentimiento.' };
      return { configured: description.hasAccessToken || description.hasRefreshToken, source: this.sourceName };
    } catch {
      return { configured: false, source: this.sourceName, reason: 'El almacén de credenciales no se puede leer (llave incorrecta o archivo alterado).' };
    }
  }

  private lease(entry: VaultCredential): CredentialLease {
    return {
      accessToken: entry.accessToken!,
      source: this.sourceName,
      ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
    };
  }

  private expiringSoon(entry: VaultCredential): boolean {
    // Un token de larga duración sin caducidad conocida (p. ej. pegado a mano) se renueva a los 30 días: duran 60.
    if (!entry.expiresAt) return entry.kind === 'long-lived-token' && this.now().getTime() - Date.parse(entry.updatedAt) > 30 * 24 * 3600_000;
    const at = Date.parse(entry.expiresAt);
    return Number.isNaN(at) || at - this.skewMs <= this.now().getTime();
  }

  /** Una sola renovación a la vez por servicio. */
  private renew(entry: VaultCredential): Promise<VaultCredential | null> {
    const running = this.inflight.get(entry.service);
    if (running) return running;
    const task = this.doRenew(entry).finally(() => this.inflight.delete(entry.service));
    this.inflight.set(entry.service, task);
    return task;
  }

  private async doRenew(entry: VaultCredential): Promise<VaultCredential | null> {
    const refresher = this.options.refreshers[entry.kind];
    if (!refresher || (!entry.refreshToken && entry.kind === 'oauth-google')) {
      await this.markLost(entry.service);
      return null;
    }
    try {
      const outcome = await refresher(entry);
      await this.options.vault.patch(entry.service, {
        accessToken: outcome.accessToken,
        expiresAt: outcome.expiresAt,
        ...(outcome.refreshToken ? { refreshToken: outcome.refreshToken } : {}),
        ...(outcome.grantedScopes ? { grantedScopes: outcome.grantedScopes } : {}),
        needsReconsent: undefined,
      }, 'refreshed');
      return await this.options.vault.get(entry.service);
    } catch (error) {
      const retryable = error instanceof CredentialRefreshError ? error.retryable : false;
      if (retryable) {
        // Fallo transitorio (red, 5xx): se reintentará en la próxima petición; el permiso sigue vigente.
        await this.options.vault.patch(entry.service, {}, 'refresh_failed').catch(() => undefined);
        return null;
      }
      await this.markLost(entry.service);
      return null;
    }
  }

  private async markLost(service: string): Promise<void> {
    await this.options.vault.patch(service, { accessToken: undefined, needsReconsent: true }, 'reconsent_required').catch(() => undefined);
  }
}
