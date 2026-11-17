import assert from 'node:assert/strict';
import test from 'node:test';
import { IntegrationHubAdapter, integrationBrief } from '../packages/adapters/src/integration-hub-adapter.js';
import { parseOpenApi } from '../packages/gateways/src/spec-connector.js';
import { classifyOperation } from '../packages/core/src/operation-risk.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';

const catalog = parseOpenApi('tienda', { openapi: '3.0.3', info: { title: 'Tienda', version: '1' }, servers: [{ url: 'https://tienda.example/v1' }], paths: {
  '/orders': { get: { operationId: 'listOrders', summary: 'List orders', parameters: [{ name: 'status', in: 'query', schema: { type: 'string' } }] }, post: { operationId: 'createOrder', summary: 'Create an order', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } } } },
  '/orders/{id}': { delete: { operationId: 'deleteOrder', summary: 'Delete an order', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }] } } } });

function hub(calls: string[]) {
  return new IntegrationHubAdapter({
    listCatalogs: () => [catalog],
    classify: (descriptor) => classifyOperation(descriptor),
    executeOperation: async (c, operation, request) => { calls.push(`${c.service}.${operation.id}:${JSON.stringify(request.input)}`); return { ok: true, output: { status: 200 } }; },
  });
}
const run = (adapter: IntegrationHubAdapter, action: string, input: Record<string, unknown>) => adapter.execute({ tool: 'integration', action, input: input as never, idempotencyKey: 'k' }, () => {});

test('una orden encuentra la operación adecuada de un servicio conectado', async () => {
  const brief = integrationBrief([catalog], 'lista los pedidos pendientes orders', (d) => classifyOperation(d));
  assert.equal(brief[0]!.service, 'tienda'); assert.equal(brief[0]!.operations[0]!.id, 'listOrders'); assert.equal(brief[0]!.operations[0]!.level, 'auto');
  const found = await run(hub([]), 'operation.find', { query: 'delete order' });
  assert.equal(found.ok, true);
  const ops = (found.output as { services: Array<{ operations: Array<{ id: string; level: string }> }> }).services[0]!.operations;
  assert.equal(ops.find((o) => o.id === 'deleteOrder')!.level, 'restricted');
});

test('una escritura no puede colarse etiquetada como lectura', async () => {
  const calls: string[] = [];
  const adapter = hub(calls);
  assert.equal((await run(adapter, 'operation.read', { service: 'tienda', operation: 'listOrders', args: { status: 'open' } })).ok, true);
  const refused = await run(adapter, 'operation.read', { service: 'tienda', operation: 'deleteOrder', args: { id: '7' } });
  assert.equal(refused.ok, false); assert.match(refused.error!, /no es una lectura/);
  assert.equal((await run(adapter, 'operation.read', { service: 'tienda', operation: 'createOrder' })).ok, false);
  assert.deepEqual(calls, ['tienda.listOrders:{"status":"open"}'], 'solo se ejecutó la lectura');
});

test('toda escritura por integración exige aprobación aunque el planificador diga lo contrario', async () => {
  const { plan, enforced } = enforceSensitiveActionPolicy({ goal: 'x', steps: [
    { id: 's1', tool: 'integration', action: 'operation.write', input: {}, risk: 'low', reversible: true, requiresApproval: false, description: 'x' },
    { id: 's2', tool: 'integration', action: 'operation.read', input: {}, risk: 'low', reversible: true, requiresApproval: false, description: 'x' },
  ] } as never);
  assert.equal(plan.steps[0]!.requiresApproval, true); assert.equal(plan.steps[0]!.risk, 'high');
  assert.equal(plan.steps[1]!.requiresApproval, false); assert.equal(enforced.length, 1);
  const calls: string[] = [];
  assert.equal((await run(hub(calls), 'operation.write', { service: 'tienda', operation: 'deleteOrder', args: { id: '7' } })).ok, true);
  assert.deepEqual(calls, ['tienda.deleteOrder:{"id":"7"}'], 'tras la aprobación del TaskRunner, se ejecuta');
});

test('servicio u operación desconocidos: error claro, nada se ejecuta; un fallo del servicio se informa', async () => {
  const calls: string[] = [];
  assert.match((await run(hub(calls), 'operation.read', { service: 'netflix', operation: 'x' })).error!, /Conéctelo primero/);
  assert.match((await run(hub(calls), 'operation.read', { service: 'tienda', operation: 'noExiste' })).error!, /operation\.find/);
  assert.equal((await run(hub(calls), 'otra.cosa', {})).ok, false); assert.deepEqual(calls, []);
  const failing = new IntegrationHubAdapter({ listCatalogs: () => [catalog], classify: (d) => classifyOperation(d), executeOperation: async () => { throw new Error('fetch failed'); } });
  assert.match((await run(failing, 'operation.read', { service: 'tienda', operation: 'listOrders' })).error!, /no respondió/);
});

test('de la orden al plan: el planificador recibe los servicios conectados y su escritura queda con aprobación', async () => {
  const { planWithModel } = await import('../packages/orchestrator/src/model-planner.js');
  let seen = '';
  const modelGateway = { complete: async (request: { messages: Array<{ content: string }> }) => { seen = request.messages.map((m) => m.content).join('\n'); return { model: 'stub', provider: 'stub', text: JSON.stringify({ goal: 'Borrar el pedido 7', steps: [
    { id: 's1', label: 'Ver pedidos', tool: 'integration', action: 'operation.read', input: { service: 'tienda', operation: 'listOrders', args: {} }, risk: 'none', reversible: true, requiresApproval: false },
    { id: 's2', label: 'Borrar pedido 7', tool: 'integration', action: 'operation.write', input: { service: 'tienda', operation: 'deleteOrder', args: { id: '7' } }, risk: 'low', reversible: true, requiresApproval: false },
  ] }) }; } };
  const result = await planWithModel('borra el pedido 7 de la tienda', {
    modelGateway: modelGateway as never,
    toolCatalog: { integration: ['operation.find', 'operation.read', 'operation.write'] },
    context: { connectedServices: { services: integrationBrief([catalog], 'borra el pedido 7 de la tienda delete order', (d) => classifyOperation(d)) } },
    allowedTools: new Set(['integration']),
    allowedActions: new Map([['integration', new Set(['operation.find', 'operation.read', 'operation.write'])]]),
  } as never);
  assert.match(seen, /deleteOrder/, 'el modelo ve las operaciones del servicio conectado');
  assert.match(seen, /restricted/);
  const plan = (result as { plan?: { steps: Array<{ tool: string; action: string }> } }).plan;
  assert.ok(plan, 'el Núcleo acepta el plan: ' + JSON.stringify(result).slice(0, 300));
  const guarded = enforceSensitiveActionPolicy(plan as never);
  assert.equal(guarded.plan.steps[1]!.requiresApproval, true, 'aunque el modelo dijo que no hacía falta');
  assert.equal(guarded.plan.steps[0]!.requiresApproval, false);
});
