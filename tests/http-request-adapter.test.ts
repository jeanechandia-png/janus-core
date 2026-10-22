import test from 'node:test';
import assert from 'node:assert/strict';
import type { ToolRequest } from '../packages/gateways/src/contracts.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { HttpRequestAdapter, checkPath, isPrivateHost, parseHttpEndpoints, validateEndpoint } from '../packages/adapters/src/http-request-adapter.js';

type Call = { url: string; init: RequestInit };
function fakeFetch(responder: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (url: string | URL, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    return responder(call);
  }) as typeof fetch;
  return { impl, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const noop = async () => {};
const req = (action: string, input: Record<string, unknown>, idempotencyKey?: string): ToolRequest => ({ tool: 'http', action, input, ...(idempotencyKey ? { idempotencyKey } : {}) });
const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

const ENDPOINTS = {
  clima: { baseUrl: 'https://api.open-meteo.com/v1', methods: ['GET'] as const, allowPrefixes: ['/forecast'] },
  crm: { baseUrl: 'https://crm.example.eu/api', methods: ['GET', 'POST', 'DELETE'] as const, credentialService: 'crm' },
};

test('lectura: GET con query, JSON parseado, marcado como dato no confiable', async () => {
  const { impl, calls } = fakeFetch(() => json({ hourly: { temperature_2m: [7, 8] } }));
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, fetchImpl: impl });
  const res = await adapter.execute(req('request.read', { endpoint: 'clima', path: '/forecast', query: { latitude: 52.37, longitude: 4.9, hourly: 'temperature_2m' } }), noop);
  assert.equal(res.ok, true);
  assert.equal(calls[0]!.url, 'https://api.open-meteo.com/v1/forecast?latitude=52.37&longitude=4.9&hourly=temperature_2m');
  assert.equal(calls[0]!.init.redirect, 'manual');
  assert.deepEqual(res.output!.body, { hourly: { temperature_2m: [7, 8] } });
  assert.equal(res.output!.untrusted, true);
});

test('endpoint inexistente o URL directa del flujo: rechazado (solo nombres autorizados)', async () => {
  const { impl, calls } = fakeFetch(() => json({}));
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, fetchImpl: impl });
  for (const endpoint of ['evil', 'https://evil.example/x', '../clima', '']) {
    const res = await adapter.execute(req('request.read', { endpoint, path: '/x' }), noop);
    assert.equal(res.ok, false);
    assert.match(res.error ?? '', /allowlist/);
  }
  assert.equal(calls.length, 0);
});

test('ruta: sin traversal, esquema, // ni caracteres de control; respeta allowPrefixes', () => {
  assert.deepEqual(checkPath('/forecast', ['/forecast']), { path: '/forecast' });
  for (const bad of ['forecast', '//evil.example/x', '/a/../b', '/a/%2e%2e/b', '/a/%2E%2E', '/x?y=1', '/x#f', '/a\\b', '/http://x', '/a\u0000b', '/x@evil']) {
    assert.ok('error' in checkPath(bad), `debe rechazar ${JSON.stringify(bad)}`);
  }
  assert.ok('error' in checkPath('/otra', ['/forecast']));
});

test('método y acción deben coincidir: una escritura no puede disfrazarse de lectura', async () => {
  const { impl, calls } = fakeFetch(() => json({ ok: true }));
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, tokenProvider: async () => 'tok', fetchImpl: impl });
  const disfrazada = await adapter.execute(req('request.read', { endpoint: 'crm', method: 'POST', path: '/contactos', body: { a: 1 } }), noop);
  assert.equal(disfrazada.ok, false);
  assert.match(disfrazada.error ?? '', /request\.send/);
  const lecturaConEnvio = await adapter.execute(req('request.send', { endpoint: 'crm', method: 'GET', path: '/contactos' }), noop);
  assert.equal(lecturaConEnvio.ok, false);
  assert.equal(calls.length, 0);
});

test('método no permitido en el endpoint (p. ej. DELETE en clima) se rechaza', async () => {
  const { impl, calls } = fakeFetch(() => json({}));
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, fetchImpl: impl });
  const res = await adapter.execute(req('request.send', { endpoint: 'clima', method: 'DELETE', path: '/forecast' }), noop);
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /not allowed/);
  assert.equal(calls.length, 0);
});

test('credencial: se inyecta desde el broker, no se acepta de los parámetros ni se devuelve', async () => {
  const { impl, calls } = fakeFetch(() => json({ id: 7 }));
  const asked: string[] = [];
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, tokenProvider: async (s) => { asked.push(s); return 'SECRETO-123'; }, fetchImpl: impl });
  const res = await adapter.execute(req('request.send', { endpoint: 'crm', method: 'POST', path: '/contactos', body: { nombre: 'Ana' } }, 'flow:wf:1:r1:crear'), noop);
  assert.equal(res.ok, true);
  assert.deepEqual(asked, ['crm']);
  assert.equal(header(calls[0]!, 'authorization'), 'Bearer SECRETO-123');
  assert.equal(header(calls[0]!, 'idempotency-key'), 'flow:wf:1:r1:crear');
  assert.equal(header(calls[0]!, 'content-type'), 'application/json');
  assert.equal(JSON.stringify(res).includes('SECRETO-123'), false);

  for (const h of [{ authorization: 'Bearer robado' }, { Cookie: 'a=b' }, { host: 'evil.example' }, { 'x-ok': 'a\r\nB: c' }]) {
    const bad = await adapter.execute(req('request.send', { endpoint: 'crm', method: 'POST', path: '/contactos', headers: h }), noop);
    assert.equal(bad.ok, false);
  }
  assert.equal(calls.length, 1);
});

test('sin credencial disponible: falla con mensaje claro y sin llamar a la red', async () => {
  const { impl, calls } = fakeFetch(() => json({}));
  const adapter = new HttpRequestAdapter({ endpoints: ENDPOINTS, tokenProvider: async () => undefined, fetchImpl: impl });
  const res = await adapter.execute(req('request.read', { endpoint: 'crm', path: '/contactos' }), noop);
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /needs a credential/);
  assert.equal(calls.length, 0);
});

test('redirecciones no se siguen; errores HTTP devuelven estado y pista sin secretos', async () => {
  const redirect = fakeFetch(() => new Response(null, { status: 302, headers: { location: 'https://evil.example/' } }));
  const a1 = new HttpRequestAdapter({ endpoints: ENDPOINTS, fetchImpl: redirect.impl });
  const r1 = await a1.execute(req('request.read', { endpoint: 'clima', path: '/forecast' }), noop);
  assert.equal(r1.ok, false);
  assert.match(r1.error ?? '', /redirect/);

  const notFound = fakeFetch(() => json({ error: { message: 'no existe' } }, 404));
  const a2 = new HttpRequestAdapter({ endpoints: ENDPOINTS, fetchImpl: notFound.impl });
  const r2 = await a2.execute(req('request.read', { endpoint: 'clima', path: '/forecast' }), noop);
  assert.equal(r2.ok, false);
  assert.match(r2.error ?? '', /HTTP 404.*no existe/);
  assert.equal(r2.output!.status, 404);
});

test('respuesta enorme se corta en el límite y se marca truncada', async () => {
  const { impl } = fakeFetch(() => new Response('x'.repeat(5000), { status: 200, headers: { 'content-type': 'text/plain' } }));
  const adapter = new HttpRequestAdapter({ endpoints: { clima: { ...ENDPOINTS.clima, maxResponseBytes: 1000 } }, fetchImpl: impl });
  const res = await adapter.execute(req('request.read', { endpoint: 'clima', path: '/forecast' }), noop);
  assert.equal(res.ok, true);
  assert.equal(res.output!.truncated, true);
  assert.equal(String(res.output!.body).length, 1000);
});

test('tiempo agotado se informa como tal', async () => {
  const { impl } = fakeFetch((call) => new Promise<Response>((_, reject) => { (call.init.signal as AbortSignal).addEventListener('abort', () => { const e = new Error('abort'); e.name = 'AbortError'; reject(e); }); }));
  const adapter = new HttpRequestAdapter({ endpoints: { clima: { ...ENDPOINTS.clima, timeoutMs: 30 } }, fetchImpl: impl });
  const res = await adapter.execute(req('request.read', { endpoint: 'clima', path: '/forecast' }), noop);
  assert.equal(res.ok, false);
  assert.match(res.error ?? '', /timed out/);
});

test('configuración: https obligatorio, sin credenciales en la URL, sin red privada salvo permiso explícito', () => {
  assert.match(validateEndpoint({ baseUrl: 'http://api.example.eu' }) ?? '', /https/);
  assert.match(validateEndpoint({ baseUrl: 'https://user:pw@api.example.eu' }) ?? '', /credentials/);
  assert.match(validateEndpoint({ baseUrl: 'https://api.example.eu/?k=1' }) ?? '', /query/);
  assert.match(validateEndpoint({ baseUrl: 'https://192.168.1.20' }) ?? '', /private/);
  assert.match(validateEndpoint({ baseUrl: 'https://localhost:8443' }) ?? '', /private/);
  assert.equal(validateEndpoint({ baseUrl: 'https://192.168.1.20', allowPrivateNetwork: true }), null);
  assert.match(validateEndpoint({ baseUrl: 'https://api.example.eu', methods: ['POST'] }) ?? '', /credentialService/);
  assert.equal(isPrivateHost('10.0.0.5') && isPrivateHost('172.20.1.1') && isPrivateHost('169.254.1.1') && isPrivateHost('::1'), true);
  assert.equal(isPrivateHost('8.8.8.8') || isPrivateHost('api.open-meteo.com'), false);
  assert.throws(() => new HttpRequestAdapter({ endpoints: { mal: { baseUrl: 'http://x.example' } } }), /https/);
});

test('JANUS_HTTP_ENDPOINTS: parsea configuración válida y falla con claridad si no lo es', () => {
  const ok = parseHttpEndpoints(JSON.stringify({ clima: { baseUrl: 'https://api.open-meteo.com/v1', methods: ['get'], allowPrefixes: ['/forecast'] } }));
  assert.deepEqual(ok.clima!.methods, ['GET']);
  assert.deepEqual(parseHttpEndpoints(undefined), {});
  assert.throws(() => parseHttpEndpoints('no json'), /JSON object/);
  assert.throws(() => parseHttpEndpoints(JSON.stringify({ 'mal nombre': { baseUrl: 'https://a.example' } })), /invalid endpoint name/);
  assert.throws(() => parseHttpEndpoints(JSON.stringify({ x: { baseUrl: 'https://a.example', methods: ['TRACE'] } })), /unsupported method/);
  assert.throws(() => parseHttpEndpoints(JSON.stringify({ x: { baseUrl: 'ftp://a.example' } })), /https/);
});

test('Tool Gateway: request.send exige permiso de autoridad; request.read no', async () => {
  const { impl } = fakeFetch(() => json({ ok: 1 }));
  const gateway = new DefaultToolGateway();
  gateway.register(new HttpRequestAdapter({ endpoints: ENDPOINTS, tokenProvider: async () => 'tok', fetchImpl: impl }));
  const lectura = await gateway.execute({ tool: 'http', action: 'request.read', input: { endpoint: 'clima', path: '/forecast' } }, noop);
  assert.equal(lectura.ok, true);
  const escritura = await gateway.execute({ tool: 'http', action: 'request.send', input: { endpoint: 'crm', method: 'POST', path: '/c', body: {} }, idempotencyKey: 'k1' }, noop);
  assert.equal(escritura.ok, false);
  assert.match(escritura.error ?? '', /authority permit/);
});
