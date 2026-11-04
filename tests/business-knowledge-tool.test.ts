import assert from 'node:assert/strict';
import test from 'node:test';
import { actionRequiresFounderBiometric } from '../packages/core/src/authority.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { BusinessKnowledgeToolAdapter, type BusinessKnowledgeStorePort } from '../packages/adapters/src/business-knowledge-tool-adapter.js';
import { DefaultToolGateway } from '../packages/gateways/src/tool-gateway.js';
import { deterministicPlan, isKnowledgeChangeRequest } from '../packages/orchestrator/src/deterministic-planner.js';
import { enforceSensitiveActionPolicy } from '../packages/orchestrator/src/sensitive-action-policy.js';
import { validatePlan } from '../packages/orchestrator/src/plan.js';
import type { ToolRequest } from '../packages/gateways/src/contracts.js';

const HASH = 'ab'.repeat(32);
const permit = { privileged: true, authorityDecisionHash: HASH, principalId: 'founder' };
const noop = async () => {};

function portOf(store: SqliteStore): BusinessKnowledgeStorePort {
  return {
    appendRevision: (r) => store.appendBusinessKnowledgeRevision(r),
    listRevisions: () => store.listBusinessKnowledgeRevisions(),
    putProposal: (r) => store.putBusinessKnowledgeProposal(r),
    findPendingProposal: (k, n) => store.findPendingBusinessKnowledgeProposal(k, n),
    setProposalStatus: (id, s) => store.setBusinessKnowledgeProposalStatus(id, s),
    upsertConsumerReport: (r) => store.upsertBusinessKnowledgeConsumerReport(r),
    listConsumerReports: () => store.listBusinessKnowledgeConsumerReports(),
  };
}

async function run(adapter: BusinessKnowledgeToolAdapter, action: string, input: Record<string, unknown>, authorization?: ToolRequest['authorization']) {
  return adapter.execute({ tool: 'knowledge', action, input, ...(authorization ? { authorization } : {}) }, noop);
}

/** Propone y aplica una frase con aprobación simulada. */
async function say(adapter: BusinessKnowledgeToolAdapter, utterance: string, key: string) {
  const proposed = await run(adapter, 'change.propose', { utterance, proposalKey: key });
  assert.equal(proposed.ok, true, proposed.error);
  const applied = await run(adapter, 'change.apply', { proposalKey: key }, permit);
  assert.equal(applied.ok, true, applied.error);
  return { proposed, applied };
}

test('routing is strict: changes are detected, questions and personal preferences are not', () => {
  assert.equal(isKnowledgeChangeRequest('Janus, el precio del módulo de reservas pase a 135 euros'), true);
  assert.equal(isKnowledgeChangeRequest('Cambia el IVA al 21 %'), true);
  assert.equal(isKnowledgeChangeRequest('Guarda esta instrucción: ofrece la demo gratuita'), true);
  assert.equal(isKnowledgeChangeRequest('Melanie, a partir de ahora ofrece la demo gratuita'), true);
  assert.equal(isKnowledgeChangeRequest('Tenemos un nuevo integrante del equipo, Ana Pérez'), true);
  assert.equal(isKnowledgeChangeRequest('Añade el producto nuevo Chat de Voz que cuesta 250 euros'), true);

  assert.equal(isKnowledgeChangeRequest('¿Cuánto cuesta el módulo de reservas?'), false);
  assert.equal(isKnowledgeChangeRequest('A partir de ahora quiero que me hables más corto'), false);
  assert.equal(isKnowledgeChangeRequest('Mi café cuesta 3 euros'), false);
  assert.equal(isKnowledgeChangeRequest('Revisa el repositorio jeanechandia-png/janus-core'), false);
});

test('a dictated change plans propose (free) then apply (high risk, approval, idempotency key)', () => {
  const plan = deterministicPlan('Janus, el precio del módulo de reservas pase a 135 euros');
  assert.ok(plan);
  assert.deepEqual(plan.steps.map((s) => `${s.tool}.${s.action}`), ['knowledge.change.propose', 'knowledge.change.apply']);
  const [propose, apply] = plan.steps;
  assert.equal(propose?.requiresApproval, false);
  assert.equal(apply?.requiresApproval, true);
  assert.equal(apply?.risk, 'high');
  assert.ok(apply?.idempotencyKey);
  assert.equal(propose?.input.proposalKey, apply?.input.proposalKey);
  assert.deepEqual(validatePlan(plan).errors, []);

  // Aunque un planificador lo degradase, la política determinista lo vuelve a subir.
  const downgraded = { ...plan, steps: plan.steps.map((s) => ({ ...s, risk: 'none' as const, reversible: true, requiresApproval: false })) };
  const enforced = enforceSensitiveActionPolicy(downgraded);
  assert.equal(enforced.plan.steps[1]?.requiresApproval, true);
  assert.equal(enforced.enforced.length, 1);
  assert.equal(enforced.enforced[0]?.operation, 'knowledge.change.apply');
});

test('applying a knowledge change needs fresh Face ID (biometric) in the authority policy', () => {
  assert.equal(actionRequiresFounderBiometric('knowledge.change.apply'), true);
  assert.equal(actionRequiresFounderBiometric('knowledge.snapshot.publish'), true);
});

test('full flow on SQLite: propose reads back, nothing changes until the authorized apply', async () => {
  const store = new SqliteStore(':memory:');
  const adapter = new BusinessKnowledgeToolAdapter({ store: portOf(store), now: () => new Date('2026-11-04T12:00:00Z') });

  await say(adapter, 'Añade el producto nuevo Módulo de Reservas que cuesta 120 euros al mes', 'aaaaaaaaaaaaaaaaaaaaaaaa');
  const proposed = await run(adapter, 'change.propose', { utterance: 'El precio del módulo de reservas pase a 135 euros más IVA', proposalKey: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
  assert.equal(proposed.ok, true);
  assert.match(String(proposed.output?.reply), /de 120,00 € a 135,00 € \(IVA no incluido\)/);
  assert.match(String(proposed.output?.reply), /NO he cambiado nada/i);
  assert.equal(proposed.output?.awaitingApproval, true);
  assert.match(String((await run(adapter, 'entries.list', {})).output?.reply), /120,00 €/);

  const denied = await run(adapter, 'change.apply', { proposalKey: 'bbbbbbbbbbbbbbbbbbbbbbbb' });
  assert.equal(denied.ok, false);
  assert.match(String(denied.error), /autoridad/);
  assert.match(String((await run(adapter, 'entries.list', {})).output?.reply), /120,00 €/, 'sin permiso no cambia nada');

  const applied = await run(adapter, 'change.apply', { proposalKey: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, permit);
  assert.equal(applied.ok, true);
  assert.equal(applied.output?.revision, 2);
  assert.equal(applied.output?.syncState, 'local_only');
  assert.match(String((await run(adapter, 'entries.list', {})).output?.reply), /135,00 €/);

  // La misma aprobación no se reutiliza: la propuesta ya quedó aplicada.
  const replay = await run(adapter, 'change.apply', { proposalKey: 'bbbbbbbbbbbbbbbbbbbbbbbb' }, permit);
  assert.equal(replay.ok, false);

  // Historial append-only también a nivel de base de datos.
  assert.throws(() => store.appendBusinessKnowledgeRevision({ revision: 2, at: 'x', approvalRef: 'x', stateChecksum: 'x', payload: {} }));
  assert.equal(store.listBusinessKnowledgeRevisions().length, 2);
});

test('the Tool Gateway itself refuses change.apply without an authority permit', async () => {
  const store = new SqliteStore(':memory:');
  const gateway = new DefaultToolGateway();
  gateway.register(new BusinessKnowledgeToolAdapter({ store: portOf(store) }));
  const noKey = await gateway.execute({ tool: 'knowledge', action: 'change.apply', input: { proposalKey: 'cccccccccccccccccccccccc' } }, noop);
  assert.equal(noKey.ok, false);
  assert.match(String(noKey.error), /idempotency key/);
  const noPermit = await gateway.execute({ tool: 'knowledge', action: 'change.apply', input: { proposalKey: 'cccccccccccccccccccccccc' }, idempotencyKey: 'k' }, noop);
  assert.equal(noPermit.ok, false);
  assert.match(String(noPermit.error), /authority permit/);
  const publishNoPermit = await gateway.execute({ tool: 'knowledge', action: 'snapshot.publish', input: {}, idempotencyKey: 'k' }, noop);
  assert.match(String(publishNoPermit.error), /authority permit/);
});

test('unparseable or unresolvable requests stop at the free step with a helpful message', async () => {
  const store = new SqliteStore(':memory:');
  const adapter = new BusinessKnowledgeToolAdapter({ store: portOf(store) });
  const vague = await run(adapter, 'change.propose', { utterance: 'cámbialo todo un poco', proposalKey: 'dddddddddddddddddddddddd' });
  assert.equal(vague.ok, false);
  assert.match(String(vague.error), /No pude interpretar/);

  const missing = await run(adapter, 'change.propose', { utterance: 'El precio del módulo fantasma pase a 80 euros', proposalKey: 'eeeeeeeeeeeeeeeeeeeeeeee' });
  assert.equal(missing.ok, false);
  assert.match(String(missing.error), /No encuentro/);

  const secret = await run(adapter, 'change.propose', { utterance: 'Guarda esta instrucción: usa la api key sk-abcdefghijklmnopqrstuvwxyz123456', proposalKey: 'ffffffffffffffffffffffff' });
  assert.equal(secret.ok, false);
  assert.match(String(secret.error), /secreto/);
});

test('a proposal expires: a late approval cannot apply a stale readback', async () => {
  const store = new SqliteStore(':memory:');
  let now = new Date('2026-11-04T12:00:00Z');
  const adapter = new BusinessKnowledgeToolAdapter({ store: portOf(store), now: () => now });
  await run(adapter, 'change.propose', { utterance: 'Cambia el IVA al 21 %', proposalKey: '111111111111111111111111' });
  now = new Date('2026-11-04T12:45:00Z');
  const late = await run(adapter, 'change.apply', { proposalKey: '111111111111111111111111' }, permit);
  assert.equal(late.ok, false);
  assert.match(String(late.error), /caducar|pendiente/);
});

test('publishing sends only the PUBLIC snapshot; applied is claimed only when consumers report the same checksum', async () => {
  const store = new SqliteStore(':memory:');
  const calls: Array<{ url: string; method?: string; headers: Record<string, string>; body?: any }> = [];
  let consumerRevision = 0;
  let consumerChecksum = '';
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method, headers: init?.headers as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.startsWith('https://status.example.com/')) {
      return new Response(JSON.stringify({ businessKnowledge: { revision: consumerRevision, checksum: consumerChecksum } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const adapter = new BusinessKnowledgeToolAdapter({
    store: portOf(store),
    fetchImpl,
    publish: { url: 'https://catalog.example.com/ingest', tokenProvider: async () => 'publish-token' },
    statusUrls: { 'melanie-web': 'https://status.example.com/melanie' },
  });

  await say(adapter, 'Añade el producto nuevo IBA que cuesta 49 euros al mes', '222222222222222222222222');
  await run(adapter, 'change.propose', { proposalKey: '333333333333333333333333', changes: [{ op: 'upsert', entry: { kind: 'policy', title: 'Márgenes', body: 'Margen mínimo 30 %', visibility: 'internal' } }] });
  assert.equal((await run(adapter, 'change.apply', { proposalKey: '333333333333333333333333' }, permit)).ok, true);

  const unauthorized = await run(adapter, 'snapshot.publish', {});
  assert.equal(unauthorized.ok, false);

  const published = await run(adapter, 'snapshot.publish', {}, permit);
  assert.equal(published.ok, true, published.error);
  assert.equal(published.output?.syncState, 'published');
  const sent = calls.find((c) => c.url === 'https://catalog.example.com/ingest');
  assert.equal(sent?.headers.authorization, 'Bearer publish-token');
  assert.equal(sent?.headers['idempotency-key'], published.output?.checksum);
  assert.equal(sent?.body.snapshot.audience, 'public');
  assert.equal(sent?.body.snapshot.policies.length, 0, 'lo interno nunca sale');
  assert.ok(!JSON.stringify(sent?.body).includes('Margen mínimo'));
  assert.match(sent?.body.contextText, /no órdenes/);

  // El consumidor aún no cargó nada.
  let sync = await run(adapter, 'sync.check', {});
  assert.equal(sync.output?.allApplied, false);
  // Carga la revisión anterior → desactualizado.
  consumerRevision = 1; consumerChecksum = 'old';
  sync = await run(adapter, 'sync.check', {});
  assert.equal((sync.output?.consumers as any[])[0].state, 'stale');
  // Informa la misma revisión y checksum → aplicado.
  consumerRevision = Number(published.output?.revision); consumerChecksum = String(published.output?.checksum);
  sync = await run(adapter, 'sync.check', {});
  assert.equal(sync.output?.allApplied, true);
  assert.equal(store.listBusinessKnowledgeConsumerReports()[0]?.consumer, 'melanie-web');
});

test('publish and status URLs must be https without embedded credentials', () => {
  const store = new SqliteStore(':memory:');
  assert.throws(() => new BusinessKnowledgeToolAdapter({ store: portOf(store), publish: { url: 'http://x.example.com', tokenProvider: async () => 't' } }), /https/);
  assert.throws(() => new BusinessKnowledgeToolAdapter({ store: portOf(store), publish: { url: 'https://user:pw@x.example.com', tokenProvider: async () => 't' } }), /credentials/);
  assert.throws(() => new BusinessKnowledgeToolAdapter({ store: portOf(store), statusUrls: { a: 'http://x.example.com' } }), /https/);
});
