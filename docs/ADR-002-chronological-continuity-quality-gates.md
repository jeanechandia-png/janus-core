# ADR-002 — Chronological Continuity, Error Memory and Delivery Quality Gates

Status: ACCEPTED
Date: 2026-09-22

## Context

Janus must not restart conceptually when a conversation becomes too large or a new chat/session is opened. Provider context windows are temporary transport constraints; they must never define Janus memory or project state.

A new session must recover the project chronologically, distinguish current information from history, retain lessons from errors, and resume from the latest valid point. Outputs must also pass automatic quality review before delivery.

## Decision

### 1. Chronology is authoritative for reconstruction

All durable project/session knowledge is stored as timestamped records. Reconstruction proceeds oldest -> newest.

When a newer record replaces an older record for the same subject:

- the newer record becomes VIGENTE;
- the prior record remains HISTORICAL;
- history is never silently deleted.

Stable, current, temporary and historical status are explicit data, not inferred from recency alone.

### 2. Session bootstrap happens before planning

Before Janus plans new work it loads:

1. chronological records;
2. current instructions;
3. current task/state/decision used as the resume point;
4. the error/lesson ledger;
5. active preventive rules.

Only after this bootstrap may Model Router or Tool Gateway work begin.

External chat systems are adapters. Janus-owned local chronology remains the authority. Importers for historical ChatGPT/Claude/etc. conversations may populate the chronology, but provider chat history is not the permanent brain.

### 3. Errors are durable knowledge

Errors follow:

ERROR -> CAUSE -> IMPACT -> LESSON -> PREVENTIVE RULE -> SOLUTIONS -> CHANGE -> VERIFICATION

Each logical error has a stable fingerprint. Repetition increments recurrence count:

- occurrence 1: normal priority;
- occurrence 2: high priority and mandatory review of why the previous protection failed;
- occurrence 3+: critical priority.

A verified fix does not erase the error. It remains available to future planning as historical learning.

### 4. Continue from the latest valid point

The continuity snapshot identifies the latest current task/state/decision as the resume point.

A new session does not ask "where were we?" when the answer can be derived from local chronology.

### 5. Delivery Gate is mandatory

Before an artifact is released, Janus must obtain passing reviews for:

- coherence;
- structural quality;
- visual quality/presentation where applicable;
- architectural consistency;
- orthographic/language quality;
- synthesis/conciseness.

Missing a required reviewer is itself a blocking failure. The gate fails closed.

Review implementations may be deterministic, model-assisted or tool-assisted, but reviewers are replaceable adapters. A single LLM does not get authority to waive the gate.

### 6. Observable quality, not hidden reasoning

Janus may expose that an artifact is being checked, which gates passed/failed and what corrections were made. It must not expose private chain-of-thought.

## Current implementation

Implemented:

- `packages/core/src/continuity.ts`
  - chronological replay;
  - current vs historical resolution;
  - resume pointer;
  - active instructions;
  - ErrorLedger with recurrence escalation.
- `packages/core/src/delivery-gate.ts`
  - required quality dimensions;
  - fail-closed reviewer orchestration.
- SQLite persistence for chronology records and error lessons.
- Runtime planning context loads continuity before model planning.
- Every new runtime command records the active-work chronology.
- `GET /api/continuity` exposes the reconstructed safe continuity snapshot.
- Automated tests cover ordering, supersession, recurrence escalation, SQLite durability and delivery-gate completeness.

Pending integration:

- concrete archive adapters/importers for older external provider chats;
- automatic classification of imported messages into instruction/decision/task/error/lesson records;
- production reviewers for every Delivery Gate dimension;
- mandatory Delivery Gate invocation at every final user-facing artifact boundary;
- UI rendering of continuity restoration and quality-gate progress.

## Preventive rule

A future Janus session must treat code + tests + local chronology + current state documents as VIGENTE evidence. It must not trust an old summary merely because it is easy to retrieve.
