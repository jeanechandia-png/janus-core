import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeImprovement } from '../packages/core/src/outcome-learning.js';
import {
  applyApprovedRuntimeBlueprint,
  approveRuntimeImprovementProposal,
  buildRuntimeBlueprintCandidate,
  rejectRuntimeImprovementProposal,
  resolveActiveRuntimeBlueprint,
  rollbackRuntimeBlueprint,
  verifyRuntimeBlueprintCandidate,
} from '../packages/core/src/runtime-blueprint-governance.js';
import { createRuntimeDecisionBlueprint } from '../packages/core/src/runtime-decision-trace.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

const registeredTools = {
  github: ['repo.get', 'contents.list', 'file.read'],
};

function seedBlueprint() {
  return createRuntimeDecisionBlueprint({
    createdAt: '2026-09-30T20:30:00.000Z',
    toolCatalog: registeredTools,
  });
}

function seedProposal(store: SqliteStore, id = 'proposal_1') {
  const proposal = proposeImprovement({
    id,
    blueprintId: 'janus-runtime-execution',
    fromRevision: 1,
    rationale: 'Verified negative runtime drift',
    evidenceRefs: ['learning:obs_1'],
    suggestedChanges: ['Prefer lower latency when quality is equivalent'],
    createdAt: '2026-09-30T20:31:00.000Z',
  });
  store.upsertImprovementProposal(proposal);
  return proposal;
}

test('requires one active Blueprint and preserves historical revisions across apply and rollback', () => {
  const store = new SqliteStore(':memory:');
  try {
    const current = resolveActiveRuntimeBlueprint(store, seedBlueprint());
    assert.equal(current.revision, 1);
    assert.equal(current.status, 'active');

    seedProposal(store);
    const candidate = buildRuntimeBlueprintCandidate({
      store,
      current,
      content: {
        objective: current.objective,
        modelPolicy: {
          ...current.modelPolicy,
          preferLowLatency: true,
        },
        agents: current.agents,
        tools: current.tools,
        guardrails: current.guardrails,
        successMetrics: current.successMetrics,
      },
      createdAt: '2026-09-30T20:32:00.000Z',
    });

    const verification = verifyRuntimeBlueprintCandidate({
      current,
      candidate,
      registeredTools,
    });
    assert.equal(verification.ok, true);
    assert.ok(verification.diff.changedFields.includes('modelPolicy'));

    const approved = approveRuntimeImprovementProposal({
      store,
      proposalId: 'proposal_1',
      current,
      candidate,
      registeredTools,
    });
    assert.equal(approved.proposal.status, 'approved');
    assert.equal(
      'proposedRevision' in approved.proposal
        ? approved.proposal.proposedRevision
        : undefined,
      2,
    );
    assert.equal(store.getDecisionBlueprint(current.id, 2)?.status, 'draft');

    const replayCandidate = buildRuntimeBlueprintCandidate({
      store,
      current,
      content: {
        objective: current.objective,
        modelPolicy: {
          ...current.modelPolicy,
          preferLowLatency: true,
        },
        agents: current.agents,
        tools: current.tools,
        guardrails: current.guardrails,
        successMetrics: current.successMetrics,
      },
      createdAt: '2026-09-30T20:32:30.000Z',
    });
    const replayApproval = approveRuntimeImprovementProposal({
      store,
      proposalId: 'proposal_1',
      current,
      candidate: replayCandidate,
      registeredTools,
    });
    assert.equal(replayApproval.candidate.revision, 2);
    assert.equal(store.getDecisionBlueprint(current.id, 3), null);

    const applied = applyApprovedRuntimeBlueprint({
      store,
      proposalId: 'proposal_1',
      current,
      registeredTools,
    });
    assert.equal(applied.proposal.status, 'applied');
    assert.equal(applied.previous.status, 'historical');
    assert.equal(applied.active.revision, 2);
    assert.equal(applied.active.status, 'active');
    assert.equal(
      resolveActiveRuntimeBlueprint(store, seedBlueprint()).revision,
      2,
    );

    const rollback = rollbackRuntimeBlueprint({
      store,
      current: applied.active,
      targetRevision: 1,
      registeredTools,
      createdAt: '2026-09-30T20:33:00.000Z',
    });
    assert.equal(rollback.sourceRevision, 1);
    assert.equal(rollback.previous.revision, 2);
    assert.equal(rollback.previous.status, 'historical');
    assert.equal(rollback.active.revision, 3);
    assert.equal(rollback.active.status, 'active');
    assert.equal(rollback.active.modelPolicy.preferLowLatency, undefined);
    assert.equal(
      resolveActiveRuntimeBlueprint(store, seedBlueprint()).revision,
      3,
    );
    assert.throws(
      () => applyApprovedRuntimeBlueprint({
        store,
        proposalId: 'proposal_1',
        current: rollback.active,
        registeredTools,
      }),
      /superseded/i,
    );
  } finally {
    store.close();
  }
});

test('fails closed on security regressions and supports idempotent rejection', () => {
  const store = new SqliteStore(':memory:');
  try {
    const current = resolveActiveRuntimeBlueprint(store, seedBlueprint());
    seedProposal(store, 'proposal_reject');

    const unsafeCandidate = buildRuntimeBlueprintCandidate({
      store,
      current,
      content: {
        objective: current.objective,
        modelPolicy: current.modelPolicy,
        agents: current.agents,
        tools: current.tools.map((tool) => ({
          ...tool,
          revalidateBeforeExternalWrite: false,
        })),
        guardrails: current.guardrails.filter(
          (guardrail) => guardrail.id !== 'privileged-authority',
        ),
        successMetrics: current.successMetrics,
      },
      createdAt: '2026-09-30T20:34:00.000Z',
    });

    const verification = verifyRuntimeBlueprintCandidate({
      current,
      candidate: unsafeCandidate,
      registeredTools,
    });
    assert.equal(verification.ok, false);
    assert.ok(
      verification.errors.some((error) => error.includes('privileged-authority')),
    );
    assert.ok(
      verification.errors.some((error) => error.includes('revalidate')),
    );

    assert.throws(
      () => approveRuntimeImprovementProposal({
        store,
        proposalId: 'proposal_reject',
        current,
        candidate: unsafeCandidate,
        registeredTools,
      }),
      /failed regression verification/i,
    );

    const rejected = rejectRuntimeImprovementProposal({
      store,
      proposalId: 'proposal_reject',
    });
    assert.equal(rejected.status, 'rejected');
    assert.equal(
      rejectRuntimeImprovementProposal({
        store,
        proposalId: 'proposal_reject',
      }).status,
      'rejected',
    );
  } finally {
    store.close();
  }
});
