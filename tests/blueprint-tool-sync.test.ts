import assert from 'node:assert/strict';
import test from 'node:test';
import { applyToolCatalogSync, diffToolCatalog } from '../packages/core/src/blueprint-tool-sync.js';
import { createRuntimeDecisionBlueprint } from '../packages/core/src/runtime-decision-trace.js';
import { resolveActiveRuntimeBlueprint, type RuntimeBlueprintGovernanceStore, type RuntimeImprovementProposal } from '../packages/core/src/runtime-blueprint-governance.js';
import type { DecisionBlueprint } from '../packages/core/src/decision-blueprint.js';

class MemoryStore implements RuntimeBlueprintGovernanceStore {
  blueprints: DecisionBlueprint[] = [];
  proposals: RuntimeImprovementProposal[] = [];
  getDecisionBlueprint(id: string, revision?: number) {
    const list = this.blueprints.filter((b) => b.id === id && (revision === undefined || b.revision === revision));
    return list.at(-1) ?? null;
  }
  listDecisionBlueprints(id?: string) { return this.blueprints.filter((b) => !id || b.id === id); }
  upsertDecisionBlueprint(b: DecisionBlueprint) { this.blueprints = this.blueprints.filter((x) => !(x.id === b.id && x.revision === b.revision)).concat(structuredClone(b)); }
  listImprovementProposals() { return this.proposals; }
  upsertImprovementProposal(p: RuntimeImprovementProposal) { this.proposals = this.proposals.filter((x) => x.id !== p.id).concat(structuredClone(p)); }
}

const OLD = { github: ['file.read', 'repo.get'], netlify: ['site.published_deploy'] };
const NEW = { ...OLD, netlify: ['deploys.list', 'site.published_deploy'], asana: ['task.create', 'tasks.list'] };

test('existing installs: new integrations are visible as a diff but NOT allowed until the Founder applies the sync', () => {
  const store = new MemoryStore();
  const active = resolveActiveRuntimeBlueprint(store, createRuntimeDecisionBlueprint({ createdAt: '2026-09-30T18:30:00.000Z', toolCatalog: OLD }));
  const diff = diffToolCatalog(active, NEW);
  assert.equal(diff.upToDate, false);
  assert.deepEqual(diff.additions, [{ tool: 'asana', actions: ['task.create', 'tasks.list'] }, { tool: 'netlify', actions: ['deploys.list'] }]);
  assert.deepEqual(diff.unregistered, []);
  assert.equal(active.tools.some((tool) => tool.tool === 'asana'), false);
});

test('Founder sync creates the next revision through governance: only additions, guardrails kept, history preserved, audited proposal', () => {
  const store = new MemoryStore();
  const active = resolveActiveRuntimeBlueprint(store, createRuntimeDecisionBlueprint({ createdAt: '2026-09-30T18:30:00.000Z', toolCatalog: OLD }));
  assert.throws(() => applyToolCatalogSync({ store, current: active, registeredTools: NEW, expectedRevision: 99 }), /changed meanwhile/);
  const result = applyToolCatalogSync({ store, current: active, registeredTools: NEW, expectedRevision: active.revision, createdAt: '2026-10-14T06:00:00.000Z' });
  assert.equal(result.active.revision, active.revision + 1);
  assert.equal(result.active.status, 'active');
  assert.equal(store.getDecisionBlueprint(active.id, active.revision)!.status, 'historical');
  assert.deepEqual(result.active.tools.find((t) => t.tool === 'asana')!.actions, ['task.create', 'tasks.list']);
  assert.deepEqual(result.active.tools.find((t) => t.tool === 'github')!.actions, ['file.read', 'repo.get']);
  assert.ok(result.active.tools.every((t) => t.revalidateBeforeExternalWrite === true));
  assert.deepEqual(result.active.guardrails, active.guardrails);
  assert.equal(result.proposal.status, 'applied');
  assert.deepEqual(result.proposal.suggestedChanges, ['allow asana: task.create, tasks.list', 'allow netlify: deploys.list']);
  assert.equal(diffToolCatalog(result.active, NEW).upToDate, true);
  assert.throws(() => applyToolCatalogSync({ store, current: result.active, registeredTools: NEW, expectedRevision: result.active.revision }), /already up to date/);
});

test('a Blueprint that references a tool no longer registered is reported, never silently reduced', () => {
  const store = new MemoryStore();
  const active = resolveActiveRuntimeBlueprint(store, createRuntimeDecisionBlueprint({ createdAt: '2026-09-30T18:30:00.000Z', toolCatalog: { ...OLD, legacy: ['old.action'] } }));
  const diff = diffToolCatalog(active, NEW);
  assert.deepEqual(diff.unregistered, [{ tool: 'legacy', actions: ['old.action'] }]);
  assert.throws(() => applyToolCatalogSync({ store, current: active, registeredTools: NEW, expectedRevision: active.revision }), /unregistered actions \(legacy:old\.action\)/);
  assert.equal(store.listDecisionBlueprints().length, 1);
});
