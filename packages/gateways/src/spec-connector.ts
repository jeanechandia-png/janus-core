/**
 * Integración agnóstica guiada por especificación (pilar 1 de la arquitectura anti-obsolescencia).
 *
 * JANUS no lleva integraciones escritas a mano para cada servicio: lee la descripción técnica que el propio servicio
 * publica y construye las llamadas sobre la marcha.
 *
 *   OpenAPI 3.x / Swagger 2.0 (JSON)  → parseOpenApi
 *   GraphQL (resultado de introspección) → parseGraphqlIntrospection
 *   MCP (Model Context Protocol, lista de herramientas `tools/list`) → parseMcpTools  +  McpHttpClient
 *
 * Todas producen el mismo `ServiceCatalog`; `SpecToolAdapter` lo expone por la Tool Gateway existente, así que
 * autorización, idempotencia, auditoría y aprobación humana (operation-risk.ts) se aplican igual que al resto.
 *
 * Límites declarados: YAML no se interpreta (sin dependencias: pedir la variante JSON); `$ref` solo locales
 * (`#/…`); la validación de argumentos cubre obligatorios, tipos básicos y enumerados, no todo JSON Schema.
 * Seguridad: solo https, solo el host declarado por la especificación registrada, sin seguir redirecciones a otro host.
 */
import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from './contracts.js';

export type CatalogSource = 'openapi' | 'graphql' | 'mcp';

export interface CatalogParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  type?: string;
  enum?: readonly unknown[];
  description?: string;
}

export interface CatalogOperation {
  id: string;
  method: string;
  path: string;
  summary: string;
  parameters: CatalogParameter[];
  /** Esquema JSON (resuelto) del cuerpo, si lo hay. */
  bodySchema?: Record<string, unknown>;
  bodyRequired: boolean;
  graphql?: 'query' | 'mutation';
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

export interface ServiceCatalog {
  service: string;
  source: CatalogSource;
  title: string;
  version: string;
  baseUrl: string;
  /** Esquemas de autenticación que declara el servicio (nombres; los secretos viven en la bóveda). */
  auth: Array<{ name: string; type: string; in?: string; scheme?: string }>;
  operations: CatalogOperation[];
  warnings: string[];
}

export class SpecError extends Error {
  constructor(message: string) { super(message); this.name = 'SpecError'; }
}

const SERVICE_ID = /^[a-z][a-z0-9-]{1,39}$/;
const METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'] as const;
const MAX_OPERATIONS = 2000;

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown, max = 300): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function httpsBase(value: string, service: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new SpecError(`${service}: la especificación no declara una dirección base válida`); }
  if (url.protocol !== 'https:') throw new SpecError(`${service}: la dirección base debe ser https`);
  if (url.username || url.password) throw new SpecError(`${service}: la dirección base no puede llevar credenciales`);
  return url.toString().replace(/\/+$/, '');
}

function resolveRef(root: Json, node: unknown, depth = 0): unknown {
  if (!isObject(node) || typeof node.$ref !== 'string') return node;
  if (depth > 20) throw new SpecError('referencias $ref demasiado anidadas o circulares');
  if (!node.$ref.startsWith('#/')) throw new SpecError(`solo se admiten referencias locales: ${node.$ref.slice(0, 80)}`);
  let current: unknown = root;
  for (const part of node.$ref.slice(2).split('/')) {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isObject(current) || !(key in current)) throw new SpecError(`referencia no encontrada: ${node.$ref.slice(0, 80)}`);
    current = current[key];
  }
  return resolveRef(root, current, depth + 1);
}

/** Resuelve `$ref` de un esquema hasta una profundidad razonable (los ciclos se cortan dejando el esquema abierto). */
function resolveSchema(root: Json, node: unknown, depth = 0): Json | undefined {
  const resolved = resolveRef(root, node);
  if (!isObject(resolved)) return undefined;
  if (depth >= 6) return { type: typeof resolved.type === 'string' ? resolved.type : 'object' };
  const out: Json = { ...resolved };
  if (isObject(resolved.properties)) out.properties = Object.fromEntries(Object.entries(resolved.properties).map(([key, value]) => [key, resolveSchema(root, value, depth + 1) ?? {}]));
  if (resolved.items !== undefined) out.items = resolveSchema(root, resolved.items, depth + 1) ?? {};
  return out;
}

/** Lee un documento OpenAPI 3.x o Swagger 2.0 ya convertido a objeto. */
export function parseOpenApi(service: string, document: unknown, options: { baseUrl?: string } = {}): ServiceCatalog {
  if (!SERVICE_ID.test(service)) throw new SpecError('identificador de servicio no válido (minúsculas, números y guiones)');
  if (!isObject(document)) throw new SpecError(`${service}: el documento no es un objeto JSON (¿es YAML? pida la versión JSON)`);
  const isV3 = typeof document.openapi === 'string' && document.openapi.startsWith('3');
  const isV2 = document.swagger === '2.0';
  if (!isV3 && !isV2) throw new SpecError(`${service}: no es OpenAPI 3.x ni Swagger 2.0`);
  const warnings: string[] = [];
  let base = options.baseUrl ?? '';
  if (!base && isV3 && Array.isArray(document.servers) && isObject(document.servers[0])) base = str(document.servers[0].url, 500);
  if (!base && isV2 && typeof document.host === 'string') base = `https://${document.host}${str(document.basePath, 200)}`;
  const baseUrl = httpsBase(base, service);
  const info = isObject(document.info) ? document.info : {};
  const paths = isObject(document.paths) ? document.paths : {};
  const operations: CatalogOperation[] = [];
  const seen = new Set<string>();
  for (const [path, rawItem] of Object.entries(paths)) {
    const item = resolveRef(document, rawItem);
    if (!isObject(item) || !path.startsWith('/')) continue;
    const shared = Array.isArray(item.parameters) ? item.parameters : [];
    for (const method of METHODS) {
      const operation = item[method];
      if (!isObject(operation)) continue;
      if (operations.length >= MAX_OPERATIONS) { warnings.push(`más de ${MAX_OPERATIONS} operaciones: el resto se omite`); break; }
      let id = str(operation.operationId, 120) || `${method}_${path.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      id = id.replace(/[^A-Za-z0-9_.-]/g, '_');
      while (seen.has(id)) id += '_';
      seen.add(id);
      const parameters: CatalogParameter[] = [];
      let bodySchema: Json | undefined;
      let bodyRequired = false;
      for (const rawParameter of [...shared, ...(Array.isArray(operation.parameters) ? operation.parameters : [])]) {
        const parameter = resolveRef(document, rawParameter);
        if (!isObject(parameter)) continue;
        const where = str(parameter.in, 20);
        if (where === 'body') { bodySchema = resolveSchema(document, parameter.schema); bodyRequired = parameter.required === true; continue; } // Swagger 2
        if (where !== 'path' && where !== 'query' && where !== 'header') { if (where) warnings.push(`${id}: parámetro «${str(parameter.name, 40)}» en «${where}» no admitido`); continue; }
        const schema = resolveSchema(document, parameter.schema) ?? parameter;
        const existing = parameters.findIndex((p) => p.name === parameter.name && p.in === where);
        const entry: CatalogParameter = { name: str(parameter.name, 80), in: where, required: where === 'path' || parameter.required === true, ...(typeof schema.type === 'string' ? { type: schema.type } : {}), ...(Array.isArray(schema.enum) ? { enum: schema.enum } : {}), ...(str(parameter.description) ? { description: str(parameter.description) } : {}) };
        if (existing >= 0) parameters[existing] = entry; else parameters.push(entry);
      }
      if (isV3 && operation.requestBody !== undefined) {
        const body = resolveRef(document, operation.requestBody);
        if (isObject(body) && isObject(body.content)) {
          const json = body.content['application/json'];
          if (isObject(json)) { bodySchema = resolveSchema(document, json.schema); bodyRequired = body.required === true; }
          else warnings.push(`${id}: el cuerpo no es JSON (${Object.keys(body.content).join(', ').slice(0, 80)}); no se puede construir automáticamente`);
        }
      }
      operations.push({ id, method: method.toUpperCase(), path, summary: str(operation.summary) || str(operation.description), parameters, ...(bodySchema ? { bodySchema } : {}), bodyRequired });
    }
  }
  if (!operations.length) throw new SpecError(`${service}: la especificación no describe ninguna operación`);
  const schemes = isV3 ? (isObject(document.components) && isObject(document.components.securitySchemes) ? document.components.securitySchemes : {}) : (isObject(document.securityDefinitions) ? document.securityDefinitions : {});
  const auth = Object.entries(schemes).filter(([, value]) => isObject(value)).map(([name, value]) => { const v = value as Json; return { name, type: str(v.type, 30), ...(str(v.in, 20) ? { in: str(v.in, 20) } : {}), ...(str(v.scheme, 30) ? { scheme: str(v.scheme, 30) } : {}) }; });
  return { service, source: 'openapi', title: str(info.title, 120) || service, version: str(info.version, 40) || '—', baseUrl, auth, operations, warnings };
}

/** Lee el resultado de una introspección GraphQL (`{ data: { __schema } }` o `{ __schema }`). */
export function parseGraphqlIntrospection(service: string, introspection: unknown, endpoint: string): ServiceCatalog {
  if (!SERVICE_ID.test(service)) throw new SpecError('identificador de servicio no válido');
  const root = isObject(introspection) && isObject(introspection.data) ? introspection.data : introspection;
  const schema = isObject(root) && isObject(root.__schema) ? root.__schema : null;
  if (!schema || !Array.isArray(schema.types)) throw new SpecError(`${service}: no es un resultado de introspección GraphQL`);
  const baseUrl = httpsBase(endpoint, service);
  const typeName = (node: unknown): string => (isObject(node) ? str(node.name, 80) : '');
  const named = (node: unknown): { name: string; required: boolean } => {
    let current = node, required = false, guard = 0;
    while (isObject(current) && current.ofType && guard++ < 8) { if (current.kind === 'NON_NULL' && current === node) required = true; current = current.ofType; }
    return { name: typeName(current), required: isObject(node) && node.kind === 'NON_NULL' ? true : required };
  };
  const operations: CatalogOperation[] = [];
  for (const [kind, rootName] of [['query', typeName(schema.queryType)], ['mutation', typeName(schema.mutationType)]] as const) {
    const type = (schema.types as unknown[]).find((candidate) => isObject(candidate) && candidate.name === rootName);
    if (!rootName || !isObject(type) || !Array.isArray(type.fields)) continue;
    for (const field of type.fields) {
      if (!isObject(field) || operations.length >= MAX_OPERATIONS) continue;
      const args = Array.isArray(field.args) ? field.args : [];
      operations.push({
        id: str(field.name, 120), method: 'POST', path: '', summary: str(field.description), graphql: kind, bodyRequired: true,
        parameters: args.filter(isObject).map((arg) => { const t = named(arg.type); return { name: str(arg.name, 80), in: 'body' as const, required: t.required, type: t.name, ...(str(arg.description) ? { description: str(arg.description) } : {}) }; }),
      });
    }
  }
  if (!operations.length) throw new SpecError(`${service}: el esquema GraphQL no expone consultas ni mutaciones`);
  return { service, source: 'graphql', title: service, version: '—', baseUrl, auth: [], operations, warnings: ['GraphQL: JANUS pide solo campos escalares de primer nivel salvo que se indique la selección.'] };
}

/** Convierte la respuesta `tools/list` de un servidor MCP en catálogo. */
export function parseMcpTools(service: string, listResult: unknown, endpoint: string): ServiceCatalog {
  if (!SERVICE_ID.test(service)) throw new SpecError('identificador de servicio no válido');
  const tools = isObject(listResult) && Array.isArray(listResult.tools) ? listResult.tools : null;
  if (!tools) throw new SpecError(`${service}: no es una lista de herramientas MCP`);
  const baseUrl = httpsBase(endpoint, service);
  const operations: CatalogOperation[] = tools.filter(isObject).slice(0, MAX_OPERATIONS).map((tool) => {
    const schema = isObject(tool.inputSchema) ? tool.inputSchema : { type: 'object' };
    const required = Array.isArray(schema.required) ? schema.required.map(String) : [];
    const properties = isObject(schema.properties) ? schema.properties : {};
    const annotations = isObject(tool.annotations) ? tool.annotations : {};
    return {
      id: str(tool.name, 120).replace(/[^A-Za-z0-9_.-]/g, '_'), method: 'POST', path: '', summary: str(tool.description), bodySchema: schema, bodyRequired: required.length > 0,
      parameters: Object.entries(properties).filter(([, value]) => isObject(value)).map(([name, value]) => { const v = value as Json; return { name, in: 'body' as const, required: required.includes(name), ...(typeof v.type === 'string' ? { type: v.type } : {}), ...(Array.isArray(v.enum) ? { enum: v.enum } : {}), ...(str(v.description) ? { description: str(v.description) } : {}) }; }),
      // Las anotaciones MCP son pistas del servidor: sirven para subir el nivel de riesgo, nunca para bajarlo.
      ...(annotations.readOnlyHint === true ? { readOnlyHint: true } : {}), ...(annotations.destructiveHint === true ? { destructiveHint: true } : {}),
    };
  }).filter((operation) => operation.id);
  if (!operations.length) throw new SpecError(`${service}: el servidor MCP no expone herramientas`);
  return { service, source: 'mcp', title: service, version: '—', baseUrl, auth: [], operations, warnings: [] };
}

/** Búsqueda por palabras para que el planificador encuentre la operación adecuada sin cargar todo el catálogo. */
export function findOperations(catalog: ServiceCatalog, query: string, limit = 8): CatalogOperation[] {
  const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  const terms = fold(query).split(/[^a-z0-9]+/).filter((term) => term.length > 1);
  if (!terms.length) return catalog.operations.slice(0, limit);
  return catalog.operations
    .map((operation) => { const text = fold(`${operation.id} ${operation.method} ${operation.path} ${operation.summary}`); return { operation, score: terms.reduce((sum, term) => sum + (text.includes(term) ? (fold(operation.id).includes(term) ? 3 : 1) : 0), 0) }; })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.operation.id.localeCompare(b.operation.id))
    .slice(0, limit)
    .map((entry) => entry.operation);
}

export interface BuiltRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

function checkType(name: string, value: unknown, type: string | undefined, enumeration: readonly unknown[] | undefined): void {
  if (enumeration && !enumeration.includes(value)) throw new SpecError(`«${name}» debe ser uno de: ${enumeration.map(String).join(', ').slice(0, 200)}`);
  if (!type) return;
  const ok = type === 'string' ? typeof value === 'string'
    : type === 'integer' ? Number.isInteger(value)
    : type === 'number' ? typeof value === 'number' && Number.isFinite(value)
    : type === 'boolean' ? typeof value === 'boolean'
    : type === 'array' ? Array.isArray(value)
    : type === 'object' ? isObject(value) : true;
  if (!ok) throw new SpecError(`«${name}» debe ser de tipo ${type}`);
}

function validateBody(schema: Json | undefined, body: unknown, where = 'cuerpo'): void {
  if (!schema || body === undefined) return;
  if (schema.type === 'object' || isObject(schema.properties)) {
    if (!isObject(body)) throw new SpecError(`el ${where} debe ser un objeto`);
    for (const name of Array.isArray(schema.required) ? schema.required.map(String) : []) if (body[name] === undefined) throw new SpecError(`falta «${name}» en el ${where}`);
    for (const [name, sub] of Object.entries(isObject(schema.properties) ? schema.properties : {})) {
      if (body[name] === undefined || !isObject(sub)) continue;
      checkType(name, body[name], typeof sub.type === 'string' ? sub.type : undefined, Array.isArray(sub.enum) ? sub.enum : undefined);
      if (isObject(body[name])) validateBody(sub, body[name], `campo «${name}»`);
    }
  }
}

/**
 * Construye la llamada a partir del catálogo y de los argumentos que da el planificador.
 * `args` son los parámetros por nombre; `args.body` es el cuerpo JSON cuando la operación lo tiene.
 */
export function buildRequest(catalog: ServiceCatalog, operationId: string, args: Record<string, unknown> = {}): BuiltRequest {
  const operation = catalog.operations.find((candidate) => candidate.id === operationId);
  if (!operation) throw new SpecError(`${catalog.service}: operación desconocida «${operationId}»`);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (catalog.source === 'graphql') {
    for (const parameter of operation.parameters) if (parameter.required && args[parameter.name] === undefined) throw new SpecError(`falta el argumento obligatorio «${parameter.name}»`);
    const used = operation.parameters.filter((parameter) => args[parameter.name] !== undefined);
    const selection = typeof args.selection === 'string' && /^[\w\s{}.,:()"-]{1,2000}$/.test(args.selection) ? args.selection : '';
    const declare = used.map((p) => `$${p.name}: ${p.type}${p.required ? '!' : ''}`).join(', ');
    const pass = used.map((p) => `${p.name}: $${p.name}`).join(', ');
    const query = `${operation.graphql} ${declare ? `(${declare}) ` : ''}{ ${operation.id}${pass ? `(${pass})` : ''}${selection ? ` ${selection}` : ''} }`;
    return { method: 'POST', url: catalog.baseUrl, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables: Object.fromEntries(used.map((p) => [p.name, args[p.name]])) }) };
  }
  if (catalog.source === 'mcp') {
    const body = isObject(args.body) ? args.body : Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'body'));
    validateBody(operation.bodySchema, body, 'argumento');
    return { method: 'POST', url: catalog.baseUrl, headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: operation.id, arguments: body } }) };
  }
  let path = operation.path;
  const query = new URLSearchParams();
  for (const parameter of operation.parameters) {
    const value = args[parameter.name];
    if (value === undefined || value === null) { if (parameter.required) throw new SpecError(`falta el parámetro obligatorio «${parameter.name}»`); continue; }
    checkType(parameter.name, value, parameter.type, parameter.enum);
    const text = Array.isArray(value) ? value.map(String).join(',') : String(value);
    if (/[\r\n]/.test(text)) throw new SpecError(`«${parameter.name}» contiene saltos de línea`);
    if (parameter.in === 'path') path = path.split(`{${parameter.name}}`).join(encodeURIComponent(text));
    else if (parameter.in === 'query') query.append(parameter.name, text);
    else if (parameter.in === 'header') { if (/^(authorization|cookie|host|content-length)$/i.test(parameter.name)) throw new SpecError(`la cabecera «${parameter.name}» no puede fijarse desde los argumentos`); headers[parameter.name.toLowerCase()] = text; }
  }
  if (/\{[^}]+\}/.test(path)) throw new SpecError(`quedan parámetros de ruta sin valor en ${operation.path}`);
  const body = args.body;
  if (operation.bodyRequired && body === undefined) throw new SpecError('esta operación necesita un cuerpo (`body`)');
  validateBody(operation.bodySchema, body);
  const url = new URL(catalog.baseUrl + path);
  if (url.origin !== new URL(catalog.baseUrl).origin) throw new SpecError('la ruta resultante sale del servicio declarado');
  const search = query.toString();
  return { method: operation.method, url: url.toString() + (search ? `?${search}` : ''), headers: body !== undefined ? { ...headers, 'content-type': 'application/json' } : headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) };
}

export interface SpecTransportResponse { status: number; headers: Record<string, string>; text: string }
export type SpecTransport = (request: BuiltRequest) => Promise<SpecTransportResponse>;

export interface SpecAdapterOptions {
  catalog: ServiceCatalog;
  transport: SpecTransport;
  /** Devuelve las cabeceras de autenticación desde la bóveda de credenciales. Nunca se guardan en el catálogo. */
  authHeaders?(): Promise<Record<string, string>>;
  /** Puerta HITL (operation-risk.ts): se llama ANTES de cada ejecución y puede pausar o rechazar. */
  authorize?(operation: CatalogOperation, request: ToolRequest): Promise<void>;
  maxResponseBytes?: number;
}

/** Expone un catálogo como adaptador de la Tool Gateway: `tool` = servicio, `action` = operación. */
export class SpecToolAdapter implements ToolAdapter {
  readonly name: string;
  readonly capabilities: string[];

  constructor(private readonly options: SpecAdapterOptions) {
    this.name = options.catalog.service;
    this.capabilities = options.catalog.operations.map((operation) => operation.id);
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    const operation = this.options.catalog.operations.find((candidate) => candidate.id === request.action);
    if (!operation) return { ok: false, error: `Operación desconocida: ${request.action}` };
    let built: BuiltRequest;
    try { built = buildRequest(this.options.catalog, request.action, request.input); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'argumentos no válidos' }; }
    try { await this.options.authorize?.(operation, request); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'operación no autorizada' }; }
    const auth = this.options.authHeaders ? await this.options.authHeaders() : {};
    if (request.idempotencyKey && operation.method !== 'GET') built.headers['idempotency-key'] = request.idempotencyKey.slice(0, 120);
    await onProgress({ phase: 'progress', message: `${operation.method} ${new URL(built.url).pathname}` });
    const response = await this.options.transport({ ...built, headers: { ...built.headers, ...auth } });
    const max = this.options.maxResponseBytes ?? 200_000;
    const text = response.text.length > max ? response.text.slice(0, max) : response.text;
    let data: unknown = text;
    if (/json/i.test(response.headers['content-type'] ?? '') || /^[\[{]/.test(text.trim())) { try { data = JSON.parse(text); } catch { /* texto plano */ } }
    const ok = response.status >= 200 && response.status < 300 && !(this.options.catalog.source !== 'openapi' && isObject(data) && (data.errors !== undefined || data.error !== undefined));
    return ok
      ? { ok: true, output: { status: response.status, data: data as never, truncated: response.text.length > max }, externalReference: `${this.name}.${operation.id}` }
      : { ok: false, error: `${this.name}.${operation.id} respondió ${response.status}`, output: { status: response.status, data: data as never } };
  }
}

/** Transporte real: https, mismo host que el catálogo, sin redirecciones a otro origen, con tiempo y tamaño acotados. */
export function fetchTransport(catalog: ServiceCatalog, options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): SpecTransport {
  const origin = new URL(catalog.baseUrl).origin;
  const doFetch = options.fetchImpl ?? fetch;
  return async (request) => {
    if (new URL(request.url).origin !== origin) throw new SpecError('destino fuera del servicio registrado');
    const result = await doFetch(request.url, { method: request.method, headers: request.headers, ...(request.body !== undefined ? { body: request.body } : {}), redirect: 'error', signal: AbortSignal.timeout(options.timeoutMs ?? 20_000) });
    const headers: Record<string, string> = {};
    result.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });
    return { status: result.status, headers, text: await result.text() };
  };
}

/**
 * Cliente MCP mínimo sobre HTTP (JSON-RPC 2.0): `initialize` y `tools/list` para descubrir herramientas.
 * La ejecución (`tools/call`) va por `SpecToolAdapter`, igual que cualquier otra operación.
 * Límite declarado: transporte HTTP con respuesta JSON; no implementa sesiones SSE ni OAuth dinámico.
 */
export class McpHttpClient {
  private nextId = 1;
  constructor(private readonly endpoint: string, private readonly send: (body: string, headers: Record<string, string>) => Promise<SpecTransportResponse>, private readonly authHeaders: Record<string, string> = {}) {
    httpsBase(endpoint, 'mcp');
  }

  private async call(method: string, params: Json): Promise<Json> {
    const response = await this.send(JSON.stringify({ jsonrpc: '2.0', id: this.nextId++, method, params }), { 'content-type': 'application/json', accept: 'application/json', ...this.authHeaders });
    if (response.status < 200 || response.status >= 300) throw new SpecError(`MCP ${method}: HTTP ${response.status}`);
    let parsed: unknown;
    try { parsed = JSON.parse(response.text); } catch { throw new SpecError(`MCP ${method}: respuesta no JSON`); }
    if (!isObject(parsed)) throw new SpecError(`MCP ${method}: respuesta inesperada`);
    if (isObject(parsed.error)) throw new SpecError(`MCP ${method}: ${str(parsed.error.message, 200) || 'error'}`);
    return isObject(parsed.result) ? parsed.result : {};
  }

  async discover(service: string): Promise<ServiceCatalog> {
    const init = await this.call('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'janus-core', version: '1' } });
    const tools: unknown[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const result = await this.call('tools/list', cursor ? { cursor } : {});
      if (Array.isArray(result.tools)) tools.push(...result.tools);
      cursor = typeof result.nextCursor === 'string' && result.nextCursor ? result.nextCursor : undefined;
      if (!cursor) break;
    }
    const catalog = parseMcpTools(service, { tools }, this.endpoint);
    const server = isObject(init.serverInfo) ? init.serverInfo : {};
    return { ...catalog, title: str(server.name, 120) || service, version: str(server.version, 40) || '—' };
  }
}
