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
- `packages/automation/src/flow-runner.ts` (2026-10-23)
  - executes a workflow end to end: branches (`logic.if`/`switch`/`ai.classify`), retries with backoff, error branches, approval pause/resume, durable-ready waits, sub-workflows, dedupe, per-run deadline, idempotency key per node;
  - the run snapshot is plain JSON (serialisable to SQLite later); tools/models/agent/research are injected, never imported.
- `packages/automation/src/code-runner.ts` (2026-10-23)
  - sandboxed JavaScript code node (worker + empty `vm` context, time/memory/size limits); Python is declared unavailable.
- `packages/automation/src/node-catalog.ts` + `flow-templates.ts` (2026-10-23)
  - built-in node manifests whose availability reflects the real runtime; connector catalog counted from registered adapters; five starter templates with explicit `requires` and a `templateReadiness` check.
- `packages/adapters/src/http-request-adapter.ts` (2026-10-23)
  - HTTP/REST node via Founder-named endpoints only (`JANUS_HTTP_ENDPOINTS`), https only, credentials through the CredentialBroker, `request.send` privileged.
- `packages/orchestrator/src/cited-answer.ts` (2026-10-23)
  - search → numbered-citation synthesis → automatic verification; used by the `ai.research` node.

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

## Addendum 2026-10-23 — n8n-inspired runtime (decision record)

**Context.** The Founder asked to apply to Janus the features of n8n's public feature list (visual node editor, self-hosting, code customisation in JS/Python, AI integration, apps + HTTP/REST connectivity), taking only what is useful and implementing it as Janus's own capability.

**Verified fact.** n8n is distributed under the *Sustainable Use License* ("fair-code"); it is source-available, **not** OSI open source, and limits use to internal business / non-commercial purposes (n8n documentation, "Sustainable Use License"). Embedding or redistributing it inside Janus (which may be commercialised) would carry licence risk. **Decision:** keep the existing non-goal — no embedded n8n — and implement the *ideas* natively. n8n remains an optional external system reachable through the existing `n8n` adapter.

**Mapping (idea → Janus).**

| n8n feature | Janus decision |
| --- | --- |
| Visual node interface | Same `AutomationWorkflow` JSON; editor UI is a dashboard deliverable (two static options first, then interactive). |
| Self-hosted / data control | Already the architecture (local-first, SQLite). |
| Code node (JS/Python) | JS implemented (`CodeRunner`); Python **not available** until WASM/container isolation exists — it is registered `unavailable`, never simulated. |
| AI nodes | `ai.summarize/classify/extract/complete/research/agent`; external text is always fenced as untrusted DATA. |
| HTTP Request node | `http.request` over named, Founder-authorised endpoints; a flow can never supply a free URL. |
| 400+ app nodes | Janus counts only **real** Tool Gateway adapters (`connectorCatalog`), credential state never assumed. |

**Security decisions.**
- `http.request` method must match the action (`request.read` for GET/HEAD, `request.send` for writes) so the Tool Gateway privileged-action rule cannot be bypassed by relabelling.
- The `code` node is *not* a security boundary against hostile code (`vm` + worker); it is for code written or approved by the Founder. Strong isolation remains a pending item behind the same `CodeRunner` interface.
- A workflow's `executionTimeoutMs` is enforced per invocation; the in-flight external call cannot be cancelled and the node is marked failed.

**Expression contract (runner).** `{{ $input }}` is the output of the single upstream node (or an object keyed by node id when several feed in); `{{ $trigger }}` is always the original payload; `{{ $nodes.<id>.output }}` / `.error` read any finished node; `{{ $vars }}` are run variables. Node ids must match `^[A-Za-z0-9_-]+$` so expressions stay unambiguous.

**Known defects / pending.**
- `execution.ts: readyWorkflowNodes` can mark a node ready when its only upstream edges are error-only or all skipped; the runner uses its own readiness and does not depend on it. To be fixed or removed.
- Triggers `schedule`, `poll`, `webhook`, `event` are contract-only: the runtime has no scheduler or webhook receiver yet (nodes registered `unavailable`).
- Run snapshots and the dedupe store are in memory (`InMemoryRunStore`); persistence in SQLite is pending.
- Visual editor, Python runner, Agent Swarm binding for `ai.agent`, and delivery channels for template outputs are pending.
