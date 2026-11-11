import assert from 'node:assert/strict';
import test from 'node:test';
import {
  McpHttpClient, SpecError, SpecToolAdapter, buildRequest, fetchTransport, findOperations, parseGraphqlIntrospection, parseMcpTools, parseOpenApi,
  type BuiltRequest,
} from '../packages/gateways/src/spec-connector.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { classifyOperation } from '../packages/core/src/operation-risk.js';

const openapi = {
  openapi: '3.0.3', info: { title: 'Servicio de ejemplo', version: '1.2.0' }, servers: [{ url: 'https://api.ejemplo.test/v1' }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } }, schemas: { Note: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, tag: { type: 'string', enum: ['a', 'b'] }, meta: { $ref: '#/components/schemas/Meta' } } }, Meta: { type: 'object', required: ['by'], properties: { by: { type: 'string' } } } } },
  paths: {
    '/clients/{clientId}/notes': {
      parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'integer' } }],
      get: { operationId: 'listNotes', summary: 'Lista las notas de un cliente', parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }] },
      post: { operationId: 'addNote', summary: 'Añade una nota', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Note' } } } } },
    },
    '/clients/{clientId}': { delete: { summary: 'Elimina un cliente', parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'integer' } }] } },
  },
};

test('lee una especificación OpenAPI nunca vista y entiende operaciones, parámetros y cuerpo', () => {
  const catalog = parseOpenApi('ejemplo', openapi);
  assert.equal(catalog.baseUrl, 'https://api.ejemplo.test/v1'); assert.equal(catalog.title, 'Servicio de ejemplo');
  assert.deepEqual(catalog.operations.map((o) => `${o.method} ${o.id}`), ['GET listNotes', 'POST addNote', 'DELETE delete_clients_clientId']);
  assert.deepEqual(catalog.auth, [{ name: 'bearer', type: 'http', scheme: 'bearer' }]);
  assert.deepEqual(findOperations(catalog, 'añade una nota').map((o) => o.id).slice(0, 1), ['addNote']);
  assert.throws(() => parseOpenApi('ejemplo', { ...openapi, servers: [{ url: 'http://inseguro.test' }] }), /https/);
  assert.throws(() => parseOpenApi('ejemplo', 'openapi: 3.0.0'), /YAML/);
  assert.throws(() => parseOpenApi('Ejemplo Malo', openapi), /identificador/);
  assert.equal(parseOpenApi('viejo', { swagger: '2.0', host: 'api.viejo.test', basePath: '/v2', paths: { '/ping': { get: {} } } }).baseUrl, 'https://api.viejo.test/v2');
});

test('construye la llamada sobre la marcha y rechaza argumentos que no cumplen la especificación', () => {
  const catalog = parseOpenApi('ejemplo', openapi);
  assert.deepEqual(buildRequest(catalog, 'listNotes', { clientId: 7, limit: 5 }), { method: 'GET', url: 'https://api.ejemplo.test/v1/clients/7/notes?limit=5', headers: { accept: 'application/json' } });
  const post = buildRequest(catalog, 'addNote', { clientId: 7, body: { text: 'Llamar el lunes', tag: 'a', meta: { by: 'janus' } } });
  assert.equal(post.method, 'POST'); assert.deepEqual(JSON.parse(post.body!), { text: 'Llamar el lunes', tag: 'a', meta: { by: 'janus' } });
  assert.throws(() => buildRequest(catalog, 'listNotes', {}), /clientId/);
  assert.throws(() => buildRequest(catalog, 'listNotes', { clientId: 'siete' }), /integer/);
  assert.throws(() => buildRequest(catalog, 'addNote', { clientId: 7 }), /cuerpo/);
  assert.throws(() => buildRequest(catalog, 'addNote', { clientId: 7, body: { tag: 'a' } }), /text/);
  assert.throws(() => buildRequest(catalog, 'addNote', { clientId: 7, body: { text: 'x', tag: 'z' } }), /uno de/);
  assert.throws(() => buildRequest(catalog, 'addNote', { clientId: 7, body: { text: 'x', meta: {} } }), /by/);
  assert.throws(() => buildRequest(catalog, 'noExiste', {}), SpecError);
  assert.throws(() => buildRequest(catalog, 'listNotes', { clientId: '../../admin' }), /integer/, 'un valor de ruta no puede escapar de su tipo');
});

test('por la Tool Gateway existente: la puerta humana decide antes de cada llamada', async () => {
  const catalog = parseOpenApi('ejemplo', openapi);
  const sent: BuiltRequest[] = []; const asked: string[] = [];
  const adapter = new SpecToolAdapter({
    catalog,
    transport: async (request) => { sent.push(request); return { status: 200, headers: { 'content-type': 'application/json' }, text: '{"ok":true}' }; },
    authHeaders: async () => ({ authorization: 'Bearer secreto-de-la-boveda' }),
    authorize: async (operation) => { const risk = classifyOperation({ service: 'ejemplo', operation: operation.id, method: operation.method, path: operation.path, summary: operation.summary }); asked.push(`${operation.id}:${risk.level}`); if (risk.level !== 'auto') throw new Error('pendiente de aprobación del CEO'); },
  });
  const gateway = new DefaultToolGateway(); gateway.register(adapter);
  const read = await gateway.execute({ tool: 'ejemplo', action: 'listNotes', input: { clientId: 7 } }, () => {});
  assert.equal(read.ok, true); assert.equal(sent[0]!.headers.authorization, 'Bearer secreto-de-la-boveda');
  const write = await gateway.execute({ tool: 'ejemplo', action: 'addNote', input: { clientId: 7, body: { text: 'x' } } }, () => {});
  assert.equal(write.ok, false); assert.match(write.error!, /aprobación/);
  const remove = await gateway.execute({ tool: 'ejemplo', action: 'delete_clients_clientId', input: { clientId: 7 } }, () => {});
  assert.equal(remove.ok, false); assert.match(remove.error!, /idempotency|authority permit/, 'la pasarela existente ya frena lo destructivo sin permiso auditado');
  assert.deepEqual(asked, ['listNotes:auto', 'addNote:approval']);
  assert.equal(classifyOperation({ service: 'ejemplo', operation: 'delete_clients_clientId', method: 'DELETE' }).level, 'restricted');
  assert.equal(sent.length, 1, 'lo no aprobado nunca sale de JANUS');
  assert.equal((await gateway.execute({ tool: 'ejemplo', action: 'inventada', input: {} }, () => {})).ok, false);
  assert.equal(JSON.stringify(catalog).includes('secreto'), false, 'las credenciales nunca viven en el catálogo');
});

test('el transporte real no sale del servicio registrado', async () => {
  const catalog = parseOpenApi('ejemplo', openapi);
  const calls: string[] = [];
  const transport = fetchTransport(catalog, { fetchImpl: (async (url: string, init: RequestInit) => { calls.push(`${init.method} ${url} redirect=${init.redirect}`); return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); }) as never });
  await assert.rejects(transport({ method: 'GET', url: 'https://otro.test/x', headers: {} }), /fuera del servicio/);
  assert.equal((await transport({ method: 'GET', url: 'https://api.ejemplo.test/v1/ping', headers: {} })).status, 200);
  assert.deepEqual(calls, ['GET https://api.ejemplo.test/v1/ping redirect=error']);
});

test('GraphQL: consultas y mutaciones desde la introspección', () => {
  const str = { kind: 'SCALAR', name: 'String' };
  const catalog = parseGraphqlIntrospection('iba', { data: { __schema: { queryType: { name: 'Query' }, mutationType: { name: 'Mutation' }, types: [
    { name: 'Query', fields: [{ name: 'client', description: 'Un cliente', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }] }] },
    { name: 'Mutation', fields: [{ name: 'deleteClient', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'ID' } } }, { name: 'reason', type: str }] }] }] } } }, 'https://iba.ejemplo.test/graphql');
  assert.deepEqual(catalog.operations.map((o) => `${o.graphql}:${o.id}`), ['query:client', 'mutation:deleteClient']);
  const built = JSON.parse(buildRequest(catalog, 'client', { id: '7', selection: '{ id name }' }).body!);
  assert.equal(built.query, 'query ($id: ID!) { client(id: $id) { id name } }'); assert.deepEqual(built.variables, { id: '7' });
  assert.throws(() => buildRequest(catalog, 'client', {}), /obligatorio/);
  assert.equal(classifyOperation({ service: 'iba', operation: 'client', graphql: 'query' }).level, 'auto');
  assert.equal(classifyOperation({ service: 'iba', operation: 'deleteClient', graphql: 'mutation', method: 'POST' }).level, 'restricted');
});

test('MCP: descubre herramientas por JSON-RPC y las pistas del servidor solo suben el riesgo', async () => {
  const log: string[] = [];
  const client = new McpHttpClient('https://mcp.ejemplo.test/mcp', async (body) => {
    const call = JSON.parse(body); log.push(call.method);
    const result = call.method === 'initialize' ? { serverInfo: { name: 'Servidor MCP', version: '0.3' } }
      : call.params.cursor ? { tools: [{ name: 'purge_cache', description: 'Vacía la caché', annotations: { destructiveHint: true }, inputSchema: { type: 'object' } }] }
      : { tools: [{ name: 'search_docs', description: 'Busca documentos', annotations: { readOnlyHint: true }, inputSchema: { type: 'object', required: ['q'], properties: { q: { type: 'string' } } } }], nextCursor: 'p2' };
    return { status: 200, headers: {}, text: JSON.stringify({ jsonrpc: '2.0', id: call.id, result }) };
  });
  const catalog = await client.discover('docs');
  assert.deepEqual(log, ['initialize', 'tools/list', 'tools/list']); assert.equal(catalog.title, 'Servidor MCP');
  assert.deepEqual(catalog.operations.map((o) => o.id), ['search_docs', 'purge_cache']);
  const call = JSON.parse(buildRequest(catalog, 'search_docs', { q: 'facturas' }).body!);
  assert.deepEqual(call.params, { name: 'search_docs', arguments: { q: 'facturas' } });
  assert.throws(() => buildRequest(catalog, 'search_docs', {}), /falta «q»/);
  assert.equal(classifyOperation({ service: 'docs', operation: 'purge_cache', destructiveHint: true }).level, 'restricted');
  assert.throws(() => parseMcpTools('docs', { nada: 1 }, 'https://mcp.ejemplo.test/mcp'), /MCP/);
  assert.throws(() => new McpHttpClient('http://inseguro.test/mcp', async () => ({ status: 200, headers: {}, text: '{}' })), /https/);
});
