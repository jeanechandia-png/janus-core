# ADR-003 — Super-Agent Decision Loop, Blueprints and Outcome Learning

Status: VIGENTE  
Date: 2026-09-23

## Context

Janus already has provider-independent gateways, Work Graph decomposition, durable jobs, chronological continuity, Error Ledger and fail-closed quality gates. The next step is to make agentic behavior reusable, measurable, self-improving and auditable without transferring authority to any model or external platform.

External products were studied as references only. The adopted ideas are generalized architectural patterns: versioned decision configurations, multi-agent execution, outcome feedback, confidence calibration, drift detection, provenance receipts and operator-controlled improvement.

## Decision

JANUS CORE remains the authority. Janus adds five first-class primitives:

1. **Decision Blueprint** — versioned, diffable configuration for agents, model requirements, tools, guardrails and success metrics.
2. **Adaptive Agent Swarm** — dynamically allocates specialist workers to Work Graph nodes with bounded concurrency; no fixed permanent swarm.
3. **Decision Receipt Chain** — SHA-256 tamper-evident receipts record blueprint revision, selected worker, confidence, inputs and outcome summary.
4. **Outcome Learning Loop** — verified outcomes are scored, calibration is measured and drift is detected over time.
5. **Improvement Proposal** — Janus may propose a blueprint change, but production changes require human approval and remain rollbackable.

## Safety and autonomy rules

- Self-improvement means **propose -> review -> approve -> apply -> verify**, never silent self-modification.
- Models are workers, not authorities.
- Every external write remains subject to risk, approval, idempotency and revalidation.
- Offline queued external actions are revalidated before execution after reconnect.
- Sensitive data stays local where possible; secrets never enter SQLite.
- Past blueprint revisions remain historical and can be compared or restored.

## Super-Agent capability families

The architecture is intended to support these capability families as replaceable adapters or specialist agents:

- research and evidence synthesis;
- multimodal vision and camera understanding;
- voice/full-duplex interaction;
- office/document/spreadsheet/presentation production;
- code/build/test/deploy workflows;
- personal operations and scheduling;
- business/market/competitive intelligence;
- learning/tutoring;
- data analysis and anomaly detection;
- cross-device continuity.

These capabilities are not hard-coded to a provider. Availability is discovered through the Capability Registry and gateways.

## Execution model

```text
Input / Event
    |
    v
Continuity + Current State
    |
    v
Decision Blueprint
    |
    v
Work Graph
    |
    +--> Adaptive Agent Swarm
    |       +--> model workers
    |       +--> tool workers
    |       +--> verifier workers
    |
    v
Guardrails + Approval
    |
    v
Execution
    |
    v
Delivery Gate
    |
    v
Decision Receipt
    |
    v
Observed Outcome
    |
    +--> calibration
    +--> drift detection
    +--> improvement proposal
              |
              v
         human approval
              |
              v
       new Blueprint revision
```

## Implementation

- `packages/core/src/decision-blueprint.ts`
- `packages/core/src/decision-receipt.ts`
- `packages/core/src/outcome-learning.ts`
- `packages/orchestrator/src/agent-swarm.ts`
- tests covering blueprint diffing, receipt integrity, drift detection and swarm readiness.

## Consequences

Janus gains an explicit path from execution to learning while preserving operator control. This also creates the foundation for proactive monitoring, industry-specific profiles and measurable model/tool routing improvements without vendor lock-in.
