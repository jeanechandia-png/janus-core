import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolGateway, ToolRequest, ToolResult } from '../packages/gateways/src/contracts.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { createAutomationWorkflow, type WorkflowConnection, type WorkflowNode } from '../packages/automation/src/workflow.js';
import { FlowResumeError, redactSecrets, resumeWorkflowRun, runWorkflowPersisted } from '../packages/automation/src/flow-run-persistence.js';

const node = (id: string, kind: WorkflowNode['kind'], type: string, parameters: Record<string, unknown> = {}, extra: Partial<WorkflowNode> = {}): WorkflowNode => ({
  id, type, version: 1, label: id, kind, executionMode: 'deterministic', parameters, risk: 'none', reversible: true, requiresApproval: false,
  ...(kind === 'trigger' ? { toolOperation: { tool: 'manual', action: 'receive' } } : {}),
  ...extra,
});
const toolNode = (id: string, tool: string, action: string, extra: Partial<WorkflowNode> = {}) =>
  node(id, 'action', 'action.tool', {}, { toolOperation: { tool, action }, ...extra });
const flow = (nodes: WorkflowNode[], connections: WorkflowConnection[], over: Record<string, unknown> = {}) =>
  createAutomationWorkflow({ id: 'wf', name: 'Prueba', revision: 1, status: 'published', maxConcurrency: 2, createdAt: '2026-10-23T00:00:00.000Z', nodes, connections, ...over } as never);
const T = node('t', 'trigger', 'trigger.manual');

function stubTools(handler: (req: ToolRequest) => ToolResult = () => ({ ok: true, output: {} })): { tools: ToolGateway; calls: ToolRequest[] } {
  const calls: ToolRequest[] = [];
  const tools = { register: () => undefined, execute: async (req: ToolRequest) => { calls.push(req); return handler(req); } } as unknown as ToolGateway;
  return { tools, calls };
}

const approvalFlow = () => flow(
  [T, toolNode('enviar', 'mail', 'message.read', { requiresApproval: true, risk: 'medium' }), toolNode('despues', 'demo', 'after.read')],
  [{ from: 't', to: 'enviar' }, { from: 'enviar', to: 'despues' }],
);

test('una ejecución completa se guarda con estado, salidas y eventos en orden', async () => {
  const store = new SqliteStore(':memory:');
  const { tools } = stubTools((req) => ({ ok: true, output: { echo: req.action } }));
  const wf = flow([T, toolNode('a', 'demo', 'uno.read')], [{ from: 't', to: 'a' }]);
  const res = await runWorkflowPersisted(wf, { runId: 'p1' }, { tools }, store);
  assert.equal(res.status, 'completed');

  const record = store.getFlowRun('p1')!;
  assert.equal(record.status, 'completed');
  assert.equal(record.workflowId, 'wf');
  assert.equal(record.revision, 1);
  assert.ok(record.finishedAt);
  assert.equal(record.resumable, false);
  const events = store.listFlowRunEvents('p1');
  assert.deepEqual(events.map((event) => event.seq), events.map((_, index) => index + 1), 'secuencia 1..n sin huecos');
  assert.equal(events[0]!.type, 'run_started');
  assert.equal(events.at(-1)!.type, 'run_completed');
});

test('la desduplicación del disparador sobrevive a un reinicio: la acción no se repite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-flow-'));
  try {
    const path = join(dir, 'janus.sqlite');
    const wf = flow([T, toolNode('a', 'demo', 'uno.read')], [{ from: 't', to: 'a' }]);
    const first = stubTools();
    const storeA = new SqliteStore(path);
    assert.equal((await runWorkflowPersisted(wf, { runId: 'd1', trigger: { dedupeKey: 'pedido-77' } }, { tools: first.tools }, storeA)).status, 'completed');
    assert.equal(first.calls.length, 1);

    // «Reinicio»: otro objeto sobre el mismo archivo.
    const second = stubTools();
    const storeB = new SqliteStore(path);
    const again = await runWorkflowPersisted(wf, { runId: 'd2', trigger: { dedupeKey: 'pedido-77' } }, { tools: second.tools }, storeB);
    assert.equal(again.status, 'deduplicated');
    assert.equal(second.calls.length, 0, 'no se vuelve a ejecutar la acción');
    assert.equal(storeB.getFlowRun('d2')!.status, 'deduplicated');
    assert.equal(storeB.getFlowRun('d1')!.status, 'completed', 'la ejecución original no se toca');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('una ejecución pausada por aprobación se reanuda tras un reinicio, una sola vez y con el historial continuo', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-flow-'));
  try {
    const path = join(dir, 'janus.sqlite');
    const wf = approvalFlow();
    const before = stubTools();
    const storeA = new SqliteStore(path);
    const paused = await runWorkflowPersisted(wf, { runId: 'a1' }, { tools: before.tools }, storeA);
    assert.equal(paused.status, 'paused');
    assert.equal(before.calls.length, 0, 'sin aprobación no se ejecuta nada');
    const saved = storeA.getFlowRun('a1')!;
    assert.equal(saved.status, 'paused');
    assert.equal(saved.resumable, true);
    assert.equal((saved.pendingApprovals as Array<{ nodeId: string }>)[0]!.nodeId, 'enviar');
    const eventsBefore = storeA.listFlowRunEvents('a1').length;

    const after = stubTools();
    const storeB = new SqliteStore(path);
    const resumed = await resumeWorkflowRun(wf, 'a1', { enviar: 'approved' }, { tools: after.tools }, storeB);
    assert.equal(resumed.status, 'completed');
    assert.deepEqual(after.calls.map((call) => call.action), ['message.read', 'after.read']);
    const done = storeB.getFlowRun('a1')!;
    assert.equal(done.status, 'completed');
    assert.equal(done.startedAt, saved.startedAt, 'conserva el inicio original');
    assert.equal(done.resumable, false);
    const events = storeB.listFlowRunEvents('a1');
    assert.ok(events.length > eventsBefore);
    assert.deepEqual(events.map((event) => event.seq), events.map((_, index) => index + 1));

    // Una segunda reanudación ya no es posible (no se aprueba dos veces).
    await assert.rejects(() => resumeWorkflowRun(wf, 'a1', { enviar: 'approved' }, { tools: after.tools }, storeB), (error: unknown) => error instanceof FlowResumeError && error.code === 'not_paused');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rechazar la aprobación deja la ejecución fallida y registrada', async () => {
  const store = new SqliteStore(':memory:');
  const { tools, calls } = stubTools();
  const wf = approvalFlow();
  await runWorkflowPersisted(wf, { runId: 'r1' }, { tools }, store);
  const res = await resumeWorkflowRun(wf, 'r1', { enviar: 'rejected' }, { tools }, store);
  assert.equal(res.status, 'failed');
  assert.equal(store.getFlowRun('r1')!.status, 'failed');
  assert.ok(store.getFlowRun('r1')!.error);
  assert.equal(calls.length, 0);
});

test('reanudar falla cerrado: ejecución inexistente, no pausada o de otra revisión', async () => {
  const store = new SqliteStore(':memory:');
  const { tools } = stubTools();
  const wf = approvalFlow();
  await assert.rejects(() => resumeWorkflowRun(wf, 'no-existe', {}, { tools }, store), (e: unknown) => e instanceof FlowResumeError && e.code === 'not_found');

  const simple = flow([T, toolNode('a', 'demo', 'uno.read')], [{ from: 't', to: 'a' }]);
  await runWorkflowPersisted(simple, { runId: 'c1' }, { tools }, store);
  await assert.rejects(() => resumeWorkflowRun(simple, 'c1', {}, { tools }, store), (e: unknown) => e instanceof FlowResumeError && e.code === 'not_paused');

  await runWorkflowPersisted(wf, { runId: 'm1' }, { tools }, store);
  const otherRevision = approvalFlow();
  const bumped = { ...otherRevision, revision: 2 } as typeof otherRevision;
  await assert.rejects(() => resumeWorkflowRun(bumped, 'm1', { enviar: 'approved' }, { tools }, store), (e: unknown) => e instanceof FlowResumeError && e.code === 'workflow_mismatch');
});

test('los valores con aspecto de secreto no llegan a SQLite y esa ejecución no se puede reanudar con datos alterados', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'janus-flow-'));
  try {
    const path = join(dir, 'janus.sqlite');
    const store = new SqliteStore(path);
    const { tools } = stubTools((req) => ({ ok: true, output: req.action === 'login.read' ? { sesion: 'ok', apiKey: 'CLAVE-SECRETA-123', nested: { Authorization: 'Bearer XYZ-999' } } : {} }));
    const wf = flow(
      [T, toolNode('login', 'demo', 'login.read'), toolNode('enviar', 'mail', 'message.read', { requiresApproval: true, risk: 'medium' })],
      [{ from: 't', to: 'login' }, { from: 'login', to: 'enviar' }],
    );
    const paused = await runWorkflowPersisted(wf, { runId: 's1' }, { tools }, store);
    assert.equal(paused.status, 'paused');

    const record = store.getFlowRun('s1')!;
    assert.ok(record.redactions >= 2, `redacciones: ${record.redactions}`);
    assert.equal(record.resumable, false);
    const serialized = JSON.stringify(record) + JSON.stringify(store.listFlowRunEvents('s1'));
    assert.doesNotMatch(serialized, /CLAVE-SECRETA-123|XYZ-999/);
    assert.match(serialized, /\[redacted\]/);
    // Ni siquiera en el archivo de la base de datos.
    store.listFlowRuns(); // fuerza lectura; el WAL puede contener datos recientes
    for (const suffix of ['', '-wal']) {
      try { assert.doesNotMatch(readFileSync(path + suffix).toString('latin1'), /CLAVE-SECRETA-123|XYZ-999/); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }

    await assert.rejects(
      () => resumeWorkflowRun(wf, 's1', { enviar: 'approved' }, { tools }, store),
      (e: unknown) => e instanceof FlowResumeError && e.code === 'not_resumable' && /ocultados/.test(e.message),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('redactSecrets: oculta por nombre de clave, no toca el resto ni los valores vacíos', () => {
  const { value, redactions } = redactSecrets({ a: 1, token: 'x', lista: [{ password: 'p' }, { nombre: 'ok' }], vacio: { apiKey: '' }, nulo: { secret: null } });
  assert.deepEqual(value, { a: 1, token: '[redacted]', lista: [{ password: '[redacted]' }, { nombre: 'ok' }], vacio: { apiKey: '' }, nulo: { secret: null } });
  assert.equal(redactions, 2);
});

test('listar ejecuciones filtra por flujo y estado, más recientes primero, con límite', async () => {
  const store = new SqliteStore(':memory:');
  const { tools } = stubTools();
  let tick = Date.parse('2026-10-23T10:00:00.000Z');
  const deps = { tools, now: () => new Date((tick += 1000)) };
  const simple = flow([T, toolNode('a', 'demo', 'uno.read')], [{ from: 't', to: 'a' }]);
  for (const id of ['x1', 'x2', 'x3']) await runWorkflowPersisted(simple, { runId: id }, deps, store);
  await runWorkflowPersisted(approvalFlow(), { runId: 'x4' }, deps, store);

  assert.deepEqual(store.listFlowRuns().map((r) => r.runId), ['x4', 'x3', 'x2', 'x1']);
  assert.deepEqual(store.listFlowRuns({ status: 'paused' }).map((r) => r.runId), ['x4']);
  assert.deepEqual(store.listFlowRuns({ limit: 2 }).map((r) => r.runId), ['x4', 'x3']);
  assert.deepEqual(store.listFlowRuns({ workflowId: 'otro' }), []);
});
