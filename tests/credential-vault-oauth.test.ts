import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CredentialBroker, EnvironmentCredentialProvider } from '../packages/security/src/credential-provider.js';
import { CredentialVault, FileVaultStorage, MemoryVaultStorage, parseCredentialVaultKey } from '../packages/security/src/credential-vault.js';
import {
  GOOGLE_READ_SCOPES,
  GOOGLE_WRITE_SCOPES,
  GoogleOAuthClient,
  GoogleOAuthError,
  VaultCredentialProvider,
  assertRedirectUri,
} from '../packages/security/src/google-oauth.js';
import { THREADS_SERVICE, exchangeThreadsToken, storeThreadsToken, threadsRefresher } from '../packages/security/src/threads-token.js';

const KEY = new Uint8Array(randomBytes(32));
const CLIENT_ID = 'cliente-123.apps.googleusercontent.com';
const REDIRECT = 'https://janus.example/api/oauth/google/callback';
const MAILBOX = 'persona.ejemplo@gmail.com';
const SECRET_TOKEN = 'ya29.TOKEN-SECRETO-DE-PRUEBA';
const REFRESH = '1//REFRESH-SECRETO-DE-PRUEBA';

function clock(start = '2026-10-23T10:00:00.000Z') {
  let current = Date.parse(start);
  return { now: () => new Date(current), advance: (ms: number) => { current += ms; } };
}

function idToken(claims: Record<string, unknown>): string {
  const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.firma`;
}

type Request = { url: string; method: string; fields: Record<string, string> };
function fakeGoogle(handler: (request: Request) => { status?: number; body: unknown }) {
  const requests: Request[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const fields = Object.fromEntries(new URLSearchParams(String(init.body ?? '')));
    const request = { url: String(url), method: init.method ?? 'GET', fields };
    requests.push(request);
    const { status = 200, body } = handler(request);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, requests };
}

function claims(overrides: Record<string, unknown> = {}, now = Date.parse('2026-10-23T10:00:00.000Z')) {
  return { iss: 'https://accounts.google.com', aud: CLIENT_ID, email: MAILBOX, email_verified: true, exp: Math.floor(now / 1000) + 3600, ...overrides };
}

/* ------------------------------------------------------------------ Almacén */

test('almacén: cifra (el token no aparece en el archivo), no devuelve secretos al describir y falla con llave equivocada o archivo alterado', async () => {
  const storage = new MemoryVaultStorage();
  const vault = new CredentialVault(storage, KEY);
  await vault.put({ service: 'google-workspace:persona', kind: 'oauth-google', accessToken: SECRET_TOKEN, refreshToken: REFRESH, requestedScopes: ['a', 'b'], grantedScopes: ['a'], accountEmail: MAILBOX });
  const blob = Buffer.from((await storage.load())!).toString('utf8');
  assert.doesNotMatch(blob, /TOKEN-SECRETO|REFRESH-SECRETO|persona\.ejemplo/);
  assert.equal((await vault.get('google-workspace:persona'))!.accessToken, SECRET_TOKEN);

  const description = await vault.describe('google-workspace:persona');
  assert.ok(description);
  assert.doesNotMatch(JSON.stringify(description), /TOKEN-SECRETO|REFRESH-SECRETO/);
  assert.deepEqual(description!.missingScopes, ['b']);
  assert.equal(description!.hasRefreshToken, true);
  assert.equal(await vault.describe('no-existe'), null);

  const wrong = new CredentialVault(storage, new Uint8Array(randomBytes(32)));
  await assert.rejects(() => wrong.get('google-workspace:persona'), /cannot be decrypted/);
  const tampered = new MemoryVaultStorage();
  const bytes = Buffer.from((await storage.load())!);
  const envelope = JSON.parse(bytes.toString('utf8')) as { ct: string };
  const ct = Buffer.from(envelope.ct, 'base64');
  ct[0] = ct[0]! ^ 0xff;
  envelope.ct = ct.toString('base64');
  await tampered.save(new Uint8Array(Buffer.from(JSON.stringify(envelope))));
  await assert.rejects(() => new CredentialVault(tampered, KEY).get('google-workspace:persona'), /cannot be decrypted/);
});

test('almacén: escrituras simultáneas no se pierden; el registro de auditoría no lleva tokens', async () => {
  const vault = new CredentialVault(new MemoryVaultStorage(), KEY);
  await Promise.all(Array.from({ length: 12 }, (_, index) => vault.put({ service: `servicio-${index}`, kind: 'long-lived-token', accessToken: `${SECRET_TOKEN}-${index}` })));
  for (let index = 0; index < 12; index += 1) assert.ok(await vault.get(`servicio-${index}`), `servicio-${index}`);
  assert.equal(await vault.remove('servicio-3'), true);
  assert.equal(await vault.remove('servicio-3'), false);
  const audit = await vault.auditTrail();
  assert.equal(audit.length, 13);
  assert.doesNotMatch(JSON.stringify(audit), /TOKEN-SECRETO/);
});

test('almacén en archivo: permisos 0600 y reabre con la misma llave', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'janus-vault-'));
  const path = join(dir, 'sub', 'vault.bin');
  const vault = new CredentialVault(new FileVaultStorage(path), KEY);
  await vault.put({ service: 'threads', kind: 'long-lived-token', accessToken: SECRET_TOKEN });
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.doesNotMatch(await readFile(path, 'utf8'), /TOKEN-SECRETO/);
  assert.equal((await new CredentialVault(new FileVaultStorage(path), KEY).get('threads'))!.accessToken, SECRET_TOKEN);
});

test('llave del almacén: 32 bytes en base64 (normal o URL-safe) o hex; lo demás se rechaza', () => {
  const raw = randomBytes(32);
  assert.deepEqual(parseCredentialVaultKey(raw.toString('hex')), new Uint8Array(raw));
  assert.deepEqual(parseCredentialVaultKey(raw.toString('base64')), new Uint8Array(raw));
  assert.deepEqual(parseCredentialVaultKey(raw.toString('base64url')), new Uint8Array(raw));
  for (const bad of [undefined, '', 'corta', randomBytes(16).toString('hex'), randomBytes(33).toString('base64')]) {
    assert.throws(() => parseCredentialVaultKey(bad), /vault key/, String(bad));
  }
});

/* ------------------------------------------------------------------ OAuth de Google */

test('URI de redirección: https o bucle local; nada con consulta, fragmento o credenciales', () => {
  assert.doesNotThrow(() => assertRedirectUri('https://janus.example/api/oauth/google/callback'));
  assert.doesNotThrow(() => assertRedirectUri('http://127.0.0.1:8787/api/oauth/google/callback'));
  for (const bad of ['http://janus.example/cb', 'ftp://x/cb', 'https://janus.example/cb?x=1', 'https://janus.example/cb#f', 'https://u:p@janus.example/cb', 'no-url']) {
    assert.throws(() => assertRedirectUri(bad), /redirect URI/, bad);
  }
});

test('solicitud de consentimiento: PKCE S256, state secreto, login_hint, acceso offline y solo los permisos del modo pedido', () => {
  const oauth = new GoogleOAuthClient({ clientId: CLIENT_ID, redirectUri: REDIRECT, fetchImpl: fakeGoogle(() => ({ body: {} })).impl });
  const read = oauth.createAuthorizationRequest({ accountId: 'persona', mode: 'read', expectedEmail: 'Persona.Ejemplo@Gmail.com' });
  const url = new URL(read.url);
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  const q = url.searchParams;
  assert.equal(q.get('client_id'), CLIENT_ID);
  assert.equal(q.get('redirect_uri'), REDIRECT);
  assert.equal(q.get('response_type'), 'code');
  assert.equal(q.get('code_challenge_method'), 'S256');
  assert.match(q.get('code_challenge') ?? '', /^[A-Za-z0-9_-]{43}$/);
  assert.equal(q.get('access_type'), 'offline');
  assert.equal(q.get('prompt'), 'consent');
  assert.equal(q.get('login_hint'), MAILBOX);
  assert.equal(q.get('state'), read.state);
  assert.ok(read.state.length >= 40);
  const readScopes = (q.get('scope') ?? '').split(' ');
  assert.deepEqual(readScopes, ['openid', 'email', ...GOOGLE_READ_SCOPES]);
  assert.ok(!readScopes.some((scope) => /compose|calendar\.events$/.test(scope)), 'la lectura no pide permisos de escritura');

  const write = oauth.createAuthorizationRequest({ accountId: 'persona', mode: 'write', expectedEmail: MAILBOX });
  const writeScopes = (new URL(write.url).searchParams.get('scope') ?? '').split(' ');
  assert.deepEqual(writeScopes, ['openid', 'email', ...GOOGLE_WRITE_SCOPES]);
  assert.ok(!writeScopes.some((scope) => /readonly/.test(scope)), 'la escritura no pide lectura');
  assert.notEqual(read.state, write.state);
  assert.throws(() => oauth.createAuthorizationRequest({ accountId: 'x', mode: 'read', expectedEmail: 'no-es-correo' }), /mailbox address/);
});

async function consent(overrides: { tokens?: Record<string, unknown>; claims?: Record<string, unknown> | null; secret?: string } = {}) {
  const time = clock();
  const google = fakeGoogle((request) => {
    if (request.url.endsWith('/revoke')) return { body: {} };
    return {
      body: {
        access_token: SECRET_TOKEN,
        refresh_token: REFRESH,
        expires_in: 3599,
        scope: ['openid', 'https://www.googleapis.com/auth/userinfo.email', ...GOOGLE_READ_SCOPES].join(' '),
        ...(overrides.claims === null ? {} : { id_token: idToken(claims(overrides.claims ?? {}, time.now().getTime())) }),
        ...overrides.tokens,
      },
    };
  });
  const oauth = new GoogleOAuthClient({ clientId: CLIENT_ID, ...(overrides.secret ? { clientSecret: overrides.secret } : {}), redirectUri: REDIRECT, fetchImpl: google.impl, now: time.now });
  const request = oauth.createAuthorizationRequest({ accountId: 'persona', mode: 'read', expectedEmail: MAILBOX });
  return { oauth, google, time, request };
}

test('consentimiento: canjea el código con el verificador PKCE, comprueba la cuenta y entrega la credencial; el state es de un solo uso', async () => {
  const { oauth, google, request } = await consent();
  const { result, credential } = await oauth.completeAuthorization({ state: request.state, code: 'codigo-1' });
  const exchange = google.requests[0]!;
  assert.equal(exchange.url, 'https://oauth2.googleapis.com/token');
  assert.equal(exchange.method, 'POST');
  assert.equal(exchange.fields.grant_type, 'authorization_code');
  assert.equal(exchange.fields.code, 'codigo-1');
  assert.equal(exchange.fields.redirect_uri, REDIRECT);
  assert.equal(exchange.fields.client_id, CLIENT_ID);
  assert.equal(exchange.fields.client_secret, undefined, 'sin secreto configurado no se envía');
  const challenge = new URL(request.url).searchParams.get('code_challenge');
  assert.equal(createHash('sha256').update(exchange.fields.code_verifier!).digest('base64url'), challenge);

  assert.equal(result.service, 'google-workspace:persona');
  assert.equal(result.accountEmail, MAILBOX);
  assert.deepEqual(result.missingScopes, []);
  assert.deepEqual(result.grantedScopes, [...GOOGLE_READ_SCOPES]);
  assert.equal(result.hasRefreshToken, true);
  assert.equal(credential.kind, 'oauth-google');
  assert.equal(credential.accessToken, SECRET_TOKEN);
  assert.equal(credential.refreshToken, REFRESH);
  assert.doesNotMatch(JSON.stringify(result), /TOKEN-SECRETO|REFRESH-SECRETO/, 'el resultado público no lleva secretos');

  await assert.rejects(() => oauth.completeAuthorization({ state: request.state, code: 'codigo-1' }), /unknown or was already used/);
  assert.equal(oauth.pendingCount(), 0);
});

test('consentimiento: con secreto de cliente configurado se envía solo al endpoint de tokens', async () => {
  const { oauth, google, request } = await consent({ secret: 'secreto-del-cliente' });
  await oauth.completeAuthorization({ state: request.state, code: 'c' });
  assert.equal(google.requests[0]!.fields.client_secret, 'secreto-del-cliente');
  assert.doesNotMatch(request.url, /secreto-del-cliente/);
});

test('consentimiento: otra cuenta de Google o identidad no verificable → no se guarda nada y se revoca lo recibido', async () => {
  const cases: Array<[string, Parameters<typeof consent>[0]]> = [
    ['otro correo', { claims: { email: 'intruso@gmail.com' } }],
    ['correo no verificado', { claims: { email_verified: false } }],
    ['audiencia ajena', { claims: { aud: 'otro-cliente' } }],
    ['emisor ajeno', { claims: { iss: 'https://evil.example' } }],
    ['id_token caducado', { claims: { exp: 1 } }],
    ['sin id_token', { claims: null }],
  ];
  for (const [name, setup] of cases) {
    const { oauth, google, request } = await consent(setup);
    await assert.rejects(() => oauth.completeAuthorization({ state: request.state, code: 'c' }), (error: unknown) => error instanceof GoogleOAuthError && error.code === 'account_mismatch', name);
    const revoke = google.requests.find((item) => item.url.endsWith('/revoke'));
    assert.ok(revoke, `${name}: debe revocar`);
    assert.equal(revoke!.fields.token, REFRESH, `${name}: revoca el token de renovación`);
  }
});

test('consentimiento: permisos parciales se registran como faltantes; state caducado o desconocido se rechaza', async () => {
  const partial = await consent({ tokens: { scope: `openid email ${GOOGLE_READ_SCOPES[0]}` } });
  const { result } = await partial.oauth.completeAuthorization({ state: partial.request.state, code: 'c' });
  assert.deepEqual(result.grantedScopes, [GOOGLE_READ_SCOPES[0]]);
  assert.deepEqual(result.missingScopes, [GOOGLE_READ_SCOPES[1], GOOGLE_READ_SCOPES[2]]);

  const stale = await consent();
  stale.time.advance(11 * 60_000);
  await assert.rejects(() => stale.oauth.completeAuthorization({ state: stale.request.state, code: 'c' }), /expired/);
  assert.equal(stale.google.requests.length, 0, 'no se llama a Google con un state caducado');
  await assert.rejects(() => stale.oauth.completeAuthorization({ state: 'inventado', code: 'c' }), /unknown or was already used/);
  await assert.rejects(() => (async () => { const fresh = await consent(); return fresh.oauth.completeAuthorization({ state: fresh.request.state, code: '  ' }); })(), /authorization code/);
});

test('consentimiento: un error de Google no filtra el cuerpo ni los tokens; un segundo intento sustituye al primero', async () => {
  const time = clock();
  const google = fakeGoogle(() => ({ status: 400, body: { error: 'invalid_grant', error_description: `código ${SECRET_TOKEN} inválido` } }));
  const oauth = new GoogleOAuthClient({ clientId: CLIENT_ID, redirectUri: REDIRECT, fetchImpl: google.impl, now: time.now });
  const first = oauth.createAuthorizationRequest({ accountId: 'persona', mode: 'read', expectedEmail: MAILBOX });
  const second = oauth.createAuthorizationRequest({ accountId: 'persona', mode: 'read', expectedEmail: MAILBOX });
  assert.equal(oauth.pendingCount(), 1);
  await assert.rejects(() => oauth.completeAuthorization({ state: first.state, code: 'c' }), /unknown or was already used/);
  await assert.rejects(
    () => oauth.completeAuthorization({ state: second.state, code: 'c' }),
    (error: unknown) => error instanceof GoogleOAuthError && error.code === 'invalid_grant' && !/TOKEN-SECRETO/.test(error.message),
  );
});

/* ------------------------------------------------------------------ Proveedor con renovación */

async function providerFixture(refreshResponse: (request: Request) => { status?: number; body: unknown }, entry: Partial<Parameters<CredentialVault['put']>[0]> = {}) {
  const time = clock();
  const vault = new CredentialVault(new MemoryVaultStorage(), KEY, time.now);
  const google = fakeGoogle(refreshResponse);
  const oauth = new GoogleOAuthClient({ clientId: CLIENT_ID, redirectUri: REDIRECT, fetchImpl: google.impl, now: time.now });
  await vault.put({
    service: 'google-workspace:persona',
    kind: 'oauth-google',
    accessToken: 'token-viejo',
    refreshToken: REFRESH,
    expiresAt: new Date(time.now().getTime() + 30 * 60_000).toISOString(),
    requestedScopes: [...GOOGLE_READ_SCOPES],
    grantedScopes: [...GOOGLE_READ_SCOPES],
    accountEmail: MAILBOX,
    ...entry,
  });
  const provider = new VaultCredentialProvider({ vault, now: time.now, refreshers: { 'oauth-google': async (item) => oauth.refresh(item.refreshToken!) } });
  return { time, vault, google, provider };
}

test('proveedor: entrega el token vigente sin renovar; renueva al acercarse la caducidad, una sola vez aunque haya peticiones simultáneas', async () => {
  const fixture = await providerFixture(() => ({ body: { access_token: 'token-nuevo', expires_in: 3600 } }));
  const first = await fixture.provider.get({ service: 'google-workspace:persona' });
  assert.equal(first!.accessToken, 'token-viejo');
  assert.equal(first!.source, 'credential-vault');
  assert.equal(fixture.google.requests.length, 0);

  fixture.time.advance(29 * 60_000); // queda 1 min: dentro del margen de 2 min
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => fixture.provider.get({ service: 'google-workspace:persona' })));
  assert.equal(a!.accessToken, 'token-nuevo');
  assert.equal(b!.accessToken, 'token-nuevo');
  assert.equal(c!.accessToken, 'token-nuevo');
  assert.equal(fixture.google.requests.length, 1, 'una sola renovación');
  assert.equal(fixture.google.requests[0]!.fields.grant_type, 'refresh_token');
  assert.equal(fixture.google.requests[0]!.fields.refresh_token, REFRESH);
  const stored = await fixture.vault.get('google-workspace:persona');
  assert.equal(stored!.accessToken, 'token-nuevo');
  assert.equal(stored!.refreshToken, REFRESH, 'si Google no devuelve otro, se conserva el de renovación');
  assert.equal((await fixture.provider.get({ service: 'otro-servicio' })), null);
});

test('proveedor: invalid_grant = permiso perdido (hace falta nuevo consentimiento); un fallo de red no lo marca como perdido', async () => {
  const lost = await providerFixture(() => ({ status: 400, body: { error: 'invalid_grant' } }), { expiresAt: '2026-10-23T09:00:00.000Z' });
  assert.equal(await lost.provider.get({ service: 'google-workspace:persona' }), null);
  const description = await lost.vault.describe('google-workspace:persona');
  assert.equal(description!.needsReconsent, true);
  assert.equal(description!.hasAccessToken, false);
  const status = await lost.provider.status('google-workspace:persona');
  assert.equal(status.configured, false);
  assert.match(status.reason ?? '', /nuevo consentimiento/);
  const before = lost.google.requests.length;
  assert.equal(await lost.provider.get({ service: 'google-workspace:persona' }), null);
  assert.equal(lost.google.requests.length, before, 'no insiste con un permiso perdido');

  let down = true;
  const transient = await providerFixture(() => (down ? { status: 503, body: { error: 'backend_error' } } : { body: { access_token: 'token-nuevo', expires_in: 3600 } }), { expiresAt: '2026-10-23T09:00:00.000Z' });
  assert.equal(await transient.provider.get({ service: 'google-workspace:persona' }), null);
  assert.equal((await transient.vault.describe('google-workspace:persona'))!.needsReconsent, false, 'un 503 no revoca nada');
  down = false;
  assert.equal((await transient.provider.get({ service: 'google-workspace:persona' }))!.accessToken, 'token-nuevo');
});

test('proveedor: sin token de renovación y caducado = permiso perdido; almacén ilegible no lanza', async () => {
  const noRefresh = await providerFixture(() => ({ body: {} }), { refreshToken: undefined, expiresAt: '2026-10-23T09:00:00.000Z' });
  assert.equal(await noRefresh.provider.get({ service: 'google-workspace:persona' }), null);
  assert.equal(noRefresh.google.requests.length, 0);
  assert.equal((await noRefresh.vault.describe('google-workspace:persona'))!.needsReconsent, true);

  const storage = new MemoryVaultStorage();
  await new CredentialVault(storage, KEY).put({ service: 's', kind: 'long-lived-token', accessToken: 'x' });
  const broken = new VaultCredentialProvider({ vault: new CredentialVault(storage, new Uint8Array(randomBytes(32))), refreshers: {} });
  assert.equal(await broken.get({ service: 's' }), null);
  const status = await broken.status('s');
  assert.equal(status.configured, false);
  assert.match(status.reason ?? '', /no se puede leer/);
});

test('broker: el token del almacén gana sobre la variable de entorno; sin entrada en el almacén, responde el entorno', async () => {
  const vault = new CredentialVault(new MemoryVaultStorage(), KEY);
  await vault.put({ service: 'google-workspace:persona', kind: 'oauth-google', accessToken: 'del-almacen', refreshToken: REFRESH, expiresAt: '2099-01-01T00:00:00.000Z' });
  const env = new EnvironmentCredentialProvider({
    serviceVariables: { 'google-workspace:persona': 'G_PERSONA', 'google-workspace:otra': 'G_OTRA' },
    environment: { G_PERSONA: 'del-entorno', G_OTRA: 'del-entorno-otra' },
  });
  const broker = new CredentialBroker([new VaultCredentialProvider({ vault, refreshers: {} }), env]);
  assert.equal(await broker.accessToken('google-workspace:persona'), 'del-almacen');
  assert.equal(await broker.accessToken('google-workspace:otra'), 'del-entorno-otra');
  assert.equal((await broker.status('google-workspace:persona')).source, 'credential-vault');
});

/* ------------------------------------------------------------------ Threads */

function threadsFetch(handler: (url: URL) => { status?: number; body: unknown }) {
  const calls: URL[] = [];
  const impl = (async (url: string | URL) => {
    const parsed = new URL(String(url));
    calls.push(parsed);
    const { status = 200, body } = handler(parsed);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

test('Threads: se guarda cifrado, no se renueva antes de 24 h, se renueva cuando caduca y renueva a los 30 días si no se conoce la caducidad', async () => {
  const time = clock();
  const vault = new CredentialVault(new MemoryVaultStorage(), KEY, time.now);
  const threads = threadsFetch(() => ({ body: { access_token: 'threads-renovado', token_type: 'bearer', expires_in: 5183944 } }));
  const provider = new VaultCredentialProvider({ vault, now: time.now, refreshers: { 'long-lived-token': threadsRefresher({ fetchImpl: threads.impl, now: time.now }) } });

  await assert.rejects(() => storeThreadsToken(vault, { accessToken: 'con espacios' }), /invalid format/);
  await storeThreadsToken(vault, { accessToken: 'threads-original', expiresAt: new Date(time.now().getTime() + 59 * 24 * 3600_000).toISOString() });
  assert.equal((await provider.get({ service: THREADS_SERVICE }))!.accessToken, 'threads-original');
  assert.equal(threads.calls.length, 0);

  // Caduca a las 6 h (token de 6 h de vida: no renovable por tener menos de 24 h, pero tampoco hay llamada inútil).
  const young = new CredentialVault(new MemoryVaultStorage(), KEY, time.now);
  await young.put({ service: THREADS_SERVICE, kind: 'long-lived-token', accessToken: 'tok-joven', expiresAt: new Date(time.now().getTime() + 3600_000).toISOString() });
  const youngProvider = new VaultCredentialProvider({ vault: young, now: time.now, refreshers: { 'long-lived-token': threadsRefresher({ fetchImpl: threads.impl, now: time.now }) } });
  time.advance(30 * 60_000); // dentro del margen de renovación, pero con menos de 24 h
  assert.equal((await youngProvider.get({ service: THREADS_SERVICE }))!.accessToken, 'tok-joven');
  assert.equal(threads.calls.length, 0, 'menos de 24 h: no se llama');

  // Un token cuya caducidad se conoce y se acerca se renueva con el endpoint oficial.
  time.advance(58 * 24 * 3600_000 + 23.5 * 3600_000);
  assert.equal((await provider.get({ service: THREADS_SERVICE }))!.accessToken, 'threads-renovado');
  assert.equal(threads.calls.length, 1);
  assert.equal(threads.calls[0]!.origin + threads.calls[0]!.pathname, 'https://graph.threads.com/refresh_access_token');
  assert.equal(threads.calls[0]!.searchParams.get('grant_type'), 'th_refresh_token');
  assert.equal(threads.calls[0]!.searchParams.get('access_token'), 'threads-original');
  const stored = await vault.get(THREADS_SERVICE);
  assert.ok(Date.parse(stored!.expiresAt!) > time.now().getTime() + 59 * 24 * 3600_000);

  // Sin caducidad conocida: a los 30 días se renueva.
  const unknown = new CredentialVault(new MemoryVaultStorage(), KEY, time.now);
  await storeThreadsToken(unknown, { accessToken: 'tok-sin-caducidad' });
  const unknownProvider = new VaultCredentialProvider({ vault: unknown, now: time.now, refreshers: { 'long-lived-token': threadsRefresher({ fetchImpl: threads.impl, now: time.now }) } });
  assert.equal((await unknownProvider.get({ service: THREADS_SERVICE }))!.accessToken, 'tok-sin-caducidad');
  assert.equal(threads.calls.length, 1);
  time.advance(31 * 24 * 3600_000);
  assert.equal((await unknownProvider.get({ service: THREADS_SERVICE }))!.accessToken, 'threads-renovado');
  assert.equal(threads.calls.length, 2);
});

test('Threads: un rechazo definitivo pide nuevo token sin filtrarlo; canje de corta a larga duración', async () => {
  const time = clock();
  const vault = new CredentialVault(new MemoryVaultStorage(), KEY, time.now);
  await vault.put({ service: THREADS_SERVICE, kind: 'long-lived-token', accessToken: SECRET_TOKEN, expiresAt: '2026-10-22T00:00:00.000Z' });
  await vault.patch(THREADS_SERVICE, {}, 'stored');
  const rejected = threadsFetch(() => ({ status: 400, body: { error: { message: `token ${SECRET_TOKEN} inválido`, code: 190 } } }));
  const provider = new VaultCredentialProvider({ vault, now: time.now, refreshers: { 'long-lived-token': threadsRefresher({ fetchImpl: rejected.impl, now: time.now }) } });
  time.advance(2 * 24 * 3600_000);
  assert.equal(await provider.get({ service: THREADS_SERVICE }), null);
  assert.equal((await vault.describe(THREADS_SERVICE))!.needsReconsent, true);
  assert.doesNotMatch(JSON.stringify(await vault.auditTrail()), /TOKEN-SECRETO/);
  await assert.rejects(() => threadsRefresher({ fetchImpl: rejected.impl, now: time.now })({ service: THREADS_SERVICE, kind: 'long-lived-token', accessToken: SECRET_TOKEN, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }), (error: unknown) => error instanceof Error && !error.message.includes('TOKEN-SECRETO'));

  const exchange = threadsFetch(() => ({ body: { access_token: 'larga-duracion', token_type: 'bearer', expires_in: 5184000 } }));
  const result = await exchangeThreadsToken({ shortLivedToken: 'corta', clientSecret: 'secreto-app', fetchImpl: exchange.impl, now: time.now });
  assert.equal(result.accessToken, 'larga-duracion');
  assert.equal(exchange.calls[0]!.pathname, '/access_token');
  assert.equal(exchange.calls[0]!.searchParams.get('grant_type'), 'th_exchange_token');
  assert.equal(exchange.calls[0]!.searchParams.get('client_secret'), 'secreto-app');
  assert.equal(Date.parse(result.expiresAt) - time.now().getTime(), 5184000 * 1000);
});
