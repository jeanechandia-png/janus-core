# JANUS Intelligence Kernel

Status: VIGENTE architecture requirement.

This layer extends Janus beyond a single-model chat loop. JANUS CORE remains the authority; models are replaceable workers selected per subtask.

## 1. Structured analytical decomposition

Complex requests become a validated Work Graph rather than one oversized prompt.

Each node declares:

- objective
- expected output
- dependencies
- kind: research / analysis / tool / synthesis / verification

Independent nodes may run in parallel. Synthesis runs only after required dependencies and verification gates are complete.

## 2. Provider-independent model routing

A Model Router selects among configured adapters using task requirements, not brand preference.

Routing inputs include:

- required capabilities: reasoning, coding, vision, long context, tool use, structured output
- minimum context/output capacity
- local-only or local-preferred execution
- latency preference
- cost preference
- current availability

Hard requirements are filtered before soft preferences. JANUS CORE owns the routing decision and records the selected model/provider for traceability.

## 3. Whole-document processing

Retrieval snippets may help discover relevant material, but they are not considered equivalent to processing a complete document.

For tasks that require full-document understanding:

1. ingest the complete document into ordered units;
2. process every required unit, partitioning across multiple model calls if needed;
3. keep per-unit coverage state;
4. refuse final synthesis if coverage is incomplete;
5. preserve source/unit locators for citations.

This permits documents larger than a single model context window without silently dropping sections.

## 4. Citation and provenance ledger

Factual synthesis should maintain a ledger of:

- source identity and type
- URI/file/tool/database reference where applicable
- retrieval time/checksum when useful
- claim -> source anchors
- page/section/unit locator where available

Janus must distinguish sourced facts, inference, recommendation and items still requiring confirmation. A final answer can expose only the citation representation appropriate to the client while preserving richer local provenance internally.

## 5. Durable large LLM jobs

Large work is partitioned into durable jobs rather than relying on one model call or one process lifetime.

Required properties:

- partitioning
- bounded concurrency
- checkpoints
- retry accounting
- pause/resume/cancel
- durable status
- progress reporting
- aggregation/finalization only after required partitions complete

The engineering target is work that can exceed any single model context window and survive process/device restarts. Janus should not make unverifiable claims about being larger than every external product; capacity is measured by completed durable workloads.

## 6. Evidence-based improvement index

Janus maintains a user-controlled improvement index derived from observable signals such as verified task success, lessons learned, reduced repeated errors, tool autonomy and communication effectiveness.

The index must NOT infer mental health, personality disorders, trauma, protected characteristics or other sensitive traits. It is an operational learning instrument, not a psychological score.

Meaningful changes may produce proactive updates when enabled by user preferences. Every update should include evidence references and the observed delta, and previous index states remain historical rather than being overwritten.

## Architecture

```text
User / Voice / UI
       |
       v
 JANUS CORE
       |
       +--> Work Graph ---------> Durable Job Engine
       |        |                        |
       |        +--> Model Router -------+
       |                 |
       |                 +--> local model adapter
       |                 +--> remote model adapter A
       |                 +--> remote model adapter B
       |
       +--> Document Coverage Gate
       +--> Citation / Provenance Ledger
       +--> Verification
       +--> Improvement Index
```

## Current implementation primitives

- `packages/orchestrator/src/work-graph.ts`
- `packages/orchestrator/src/model-router.ts`
- `packages/core/src/document-coverage.ts`
- `packages/core/src/citation-ledger.ts`
- `packages/core/src/job-engine.ts`
- `packages/core/src/improvement-index.ts`

These are policy/contract primitives. Runtime persistence, document parsers, concrete model inventory, scheduling and proactive notification wiring remain separate implementation phases.
