# ADR-004 — Janus Flow Automation Engine

Status: VIGENTE  
Date: 2026-09-23

## Context

Janus must absorb the useful architectural patterns of mature workflow-automation platforms such as n8n without copying their product, code, branding, or license-bound implementation.

The goal is broader than a visual automation editor. Janus needs a local-first automation substrate that can execute deterministic workflows, agentic tasks, and hybrid workflows under the authority of JANUS CORE.

## Adopted patterns

Janus adopts these generalized patterns:

- workflows as graphs of versioned nodes and connections;
- trigger-driven execution: manual, schedule, webhook, event and polling;
- reusable action/integration nodes;
- low-code data expressions;
- subflows and composable workflows;
- branching, waits, approvals, retries and explicit error paths;
- execution history, observability and replay;
- portable workflow definitions and revision history;
- credential references rather than embedded secrets;
- bounded concurrency and queue-compatible execution;
- deterministic automation plus code where needed;
- extensible node registry for integrations;
- human-in-the-loop gates for consequential actions.

## Janus improvements

Janus deliberately extends these patterns:

1. **Hybrid deterministic + agentic graph**
   - each node declares whether it is deterministic or agentic;
   - deterministic nodes provide repeatability;
   - agentic nodes can use Model Router, Agent Swarm, verification and outcome learning.

2. **Local-first authority**
   - workflow definitions, state and execution history belong to Janus Core;
   - cloud services are adapters;
   - offline-safe work can continue locally;
   - external writes queued offline must be revalidated after reconnect.

3. **Safety by construction**
   - risk, reversibility and approval requirements live on every node;
   - high-risk or irreversible nodes cannot validate without approval;
   - secrets are references to Keychain/secure storage and never workflow payloads.

4. **Learning workflows**
   - Decision Receipts, outcomes and drift can identify weak nodes or routes;
   - Janus may propose a new workflow/Blueprint revision;
   - production changes require approval and remain rollbackable.

5. **Provider independence**
   - integration nodes target Janus Tool Gateway contracts;
   - AI nodes target Model Gateway requirements;
   - replacing a provider does not replace the workflow itself.

6. **Safer expressions**
   - initial expression engine resolves explicit Janus context paths;
   - no implicit arbitrary eval in the core expression layer;
   - advanced code belongs in isolated task runners.

7. **Observable execution**
   - workflows compile into the existing Work Graph / TaskRunner architecture;
   - node execution can emit progress, approvals, quality checks and artifacts.

## Current implementation

- `packages/automation/src/workflow.ts`
  - versioned workflow definitions;
  - deterministic/agentic nodes;
  - risk, approval, retry and error policies;
  - diffing and structural validation.
- `packages/automation/src/node-registry.ts`
  - versioned extensible node manifests and availability.
- `packages/automation/src/expression-engine.ts`
  - safe path-based low-code expressions.
- `packages/automation/src/trigger.ts`
  - manual, schedule, webhook, event and polling trigger contracts.
- `packages/automation/src/execution.ts`
  - node readiness, concurrency and retry backoff primitives.
- `packages/automation/src/compiler.ts`
  - compiles automation nodes into Janus Work Graph nodes and safe Tool Plan steps.

## Next integration

The next productive path is:

```text
Trigger
  -> Workflow revision
  -> expression/data resolution
  -> node readiness
  -> TaskRunner / Work Graph
  -> Tool Gateway / Model Router / Agent Swarm
  -> approval / wait / retry / error branch
  -> Delivery Gate
  -> Decision Receipt
  -> outcome learning
  -> versioned improvement proposal
```

## Non-goals

- Janus does not embed n8n source code.
- Janus does not require n8n to operate.
- Janus does not store provider secrets inside workflow JSON.
- Janus does not silently rewrite production workflows based on AI suggestions.
