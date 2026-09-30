# JANUS CORE

Local-first personal AI operating system for Jean.

## Current milestone

**M0 — Observable Voice Execution + Intelligence Kernel foundations**

Janus can listen, execute, expose verifiable activity and speak through replaceable local voice adapters. Voice is a first-class client of Janus Core, not a reduced chat mode. Janus is also evolving from a single-model loop into a provider-independent analytical system that decomposes complex work, routes subtasks, verifies document coverage, preserves provenance and runs durable jobs.

### Non-negotiable rules

1. **Janus Core is the authority.** Models and external services are replaceable adapters.
2. **Local-first.** SQLite/local storage owns state, memory, context, knowledge, lessons and task traces. Cloud services are adapters/sync, not the brain.
3. **Continue by default.** A task keeps advancing until completed, explicitly paused, blocked by a real dependency, or waiting for approval for a risky/irreversible action.
4. **Observable execution.** Never leave the user staring at a static screen while work is happening. Emit structured activity events for every meaningful step.
5. **Voice parity.** Anything allowed from text should be invokable from voice under the same permissions and approval rules.
6. **Provider independence.** Model Gateway, Voice Gateway and Tool Gateway isolate vendors.
7. **Safety + traceability.** External actions are permissioned, idempotent where possible, logged and revalidated after offline periods.
8. **Whole-work integrity.** Complex analysis must expose its work graph, full-document tasks must prove coverage, and sourced synthesis must preserve claim-level provenance.

## Current architecture

```text
 iPhone / PWA
      │
      │ AudioWorklet -> PCM16 16 kHz mono
      ▼
 WebSocket Voice Transport
      │
      ▼
 ┌───────────────────────────────┐
 │          JANUS CORE           │
 │                               │
 │ Task/Run Engine               │
 │ Work Graph + Job contracts    │
 │ Event Stream + Audit Log      │
 │ SQLite durable state          │
 │ Approval / policy boundary    │
 └───────┬──────────┬────────────┘
         │          │
   ┌─────▼────┐ ┌───▼───────────────┐
   │ Voice    │ │ Model/Tool Gateway│
   │ Gateway  │ │ + Model Router    │
   └──┬────┬──┘ └───────────────────┘
      │    │
      │    └── TTS adapter -> local Qwen sidecar
      └─────── STT adapter -> local whisper.cpp server
```

Neither Whisper, Qwen nor any reasoning model is part of Janus Core. They can be replaced without changing durable Janus state or authority.

## Voice path

### Input

`iPhone microphone -> AudioWorklet -> PCM16 -> WebSocket -> Whisper adapter -> transcript -> VoiceSession -> TaskRunner`

### Output

`terminal run event -> safe spoken summary -> Qwen adapter -> typed PCM -> WebSocket -> AudioBuffer queue -> iPhone speaker`

Barge-in is local and immediate: when the user starts speaking, scheduled TTS playback is cut without cancelling the underlying Janus task.

Automatic spoken responses use only sanitized `artifact.updated.payload.preview` data. Raw tool payloads, file bodies, message snippets, tokens and error details are not automatically sent to TTS.

## Intelligence Kernel

The VIGENTE intelligence requirements are documented in `docs/intelligence-kernel.md`.

Current primitives include:

- structured dependency-aware Work Graphs for complex queries;
- provider-independent Model Router policy;
- whole-document coverage gates;
- citation/provenance ledger;
- partitioned durable-job contracts for work larger than one context window;
- evidence-based, user-controlled improvement index.

These primitives are intentionally independent of any model vendor. Runtime persistence is now durable in SQLite; concrete document parsers, model inventory, job scheduler and proactive notification wiring are the next implementation layer.

## Execution event contract

Active runs emit observable events such as:

- `run.heard`
- `run.started`
- `run.step.started`
- `tool.started`
- `tool.progress`
- `tool.completed`
- `artifact.updated`
- `run.blocked`
- `approval.required`
- `run.step.completed`
- `run.completed`
- `run.paused`
- `run.failed`

The UI renders observable work only; it never exposes private model chain-of-thought.

## Status

### HECHO

- Janus Core repository and provider-independent gateway boundaries.
- Task state machine with pause/resume/cancel/block semantics.
- Structured event protocol and mobile-first PWA activity console.
- SQLite persistence and interrupted-run recovery.
- Capability registry and Core-side plan validation.
- GitHub and Google Workspace read adapters.
- Replaceable Model Gateway.
- Voice session authority in Core.
- Full-duplex PCM WebSocket transport.
- iPhone AudioWorklet capture and PCM resampling.
- Local VAD/endpointing and barge-in.
- Local whisper.cpp STT adapter with loopback-only default.
- Typed TTS contract and local Qwen3-TTS HTTP adapter.
- Janus-owned Qwen sidecar supporting custom voice, voice design and voice clone modes.
- Mobile PCM playback queue and immediate interruption.
- Safe automatic spoken completion summaries.
- End-to-end integration test: PCM -> STT -> task -> safe summary -> TTS -> PCM over WebSocket.
- Intelligence Kernel foundation contracts: Work Graph, Model Router, whole-document coverage, citation ledger, durable job partitioning and improvement index.
- SQLite persistence for Work Graph snapshots, durable jobs, Citation Ledgers and append-only Improvement Index history.
- Chronological continuity engine with current/history resolution, resume pointer, unresolved-error carryover and Error Ledger.
- Janus-owned local conversation archive in SQLite with chronological replay.
- Automatic extraction of explicit durable user instructions and reported errors into continuity records.
- Delivery Gate enforced before artifact delivery with offline baseline reviewers for coherence, structure, visual presentation, architecture, orthography and synthesis.
- Administrative Authority Control Plane enforced in TaskRunner and Tool Gateway: privileged mutations fail closed without authenticated authority, idempotency and required approval/confirmation.
- Strong local authority authentication via ECDSA P-256 challenge-response; private keys remain outside Janus, public credentials/revocation metadata live in SQLite, and bearer sessions are memory-only.
- Productive Decision Blueprint enforcement: every run selects an active immutable Blueprint describing agents, tool policy, guardrails and success metrics.
- Tamper-evident runtime Decision Receipt chains persisted in SQLite for planning, plan/capability verification, tool selection, authority, approval and Delivery Gate decisions; `GET /api/runs/:runId/decisions` verifies the chain.
- Verified runtime Outcome Learning: executable runs record a prediction receipt, verified success/failure becomes a SQLite learning observation, blockers/fallbacks stay out of calibration, Brier/drift are recalculated and negative drift may only propose a human-approved improvement.
- `GET /api/learning` exposes current observations, calibration, drift, Blueprint history and pending improvement proposals without silently applying changes.
- Founder-only Blueprint governance: approve/reject proposals, verify a new draft revision against mandatory security/runtime invariants, explicitly apply it, or rollback by creating a new append-only revision from historical policy.
- In-flight runs remain pinned to their starting Blueprint revision; learning/calibration is revision-scoped and historical run audits resolve the Blueprint actually used.
- Evidence-based execution prediction: Janus retains a neutral 0.5 prior until at least 12 verified outcomes exist for the same Blueprint revision, then uses shrinkage-calibrated evidence bounded away from false certainty.
- Productive multi-operator coordination: authenticated `operator` identities, explicit private/shared/project/system scopes, revocable grants, assignments and SQLite handoffs.
- Assignment never implies private-data access: scope permissions are revalidated for the assignee before linked execution.
- Linked operator runs automatically leave an evidence-linked executive handoff and a `coordination_handoff` Decision Receipt so another authorized operator can continue.
- Operator revocation invalidates sessions and active coordination grants; Janus Core may coordinate local state globally without inheriting Founder authority for privileged external writes.
- Reusable LEGO Library: versioned symbols/photos/logos/icons/buttons/fonts/design tokens/themes/components/modules/templates/workflows/prompts with dependency resolution and SHA-256 integrity.
- Durable project workspaces with multiple threads, project-scoped chronology, resource references and automatic context checkpoints.
- A fresh project thread bootstraps from prior project instructions/decisions/resume state automatically; project-linked runs persist a new checkpoint at completion.
- Project planning receives only that project's continuity plus its resources/latest checkpoint instead of relying on one overloaded chat window.
- CI gates: strict TypeScript, PWA syntax, Qwen sidecar syntax, tests and runtime smoke.

### AHORA

- Add local content-addressed storage for reusable binary assets/files, plus deduplication before creating a new library item.
- Add a usage graph from products/projects to exact reusable item revisions so updates can be impact-checked and upgraded safely.
- Add real model inventory/configuration so Model Router can choose among actual local and remote adapters and record observed routing quality/cost/latency in Decision Receipts.
- Extend multi-operator coordination with per-identity agenda/availability, calendar ingestion and next-operator selection without sharing private credentials.
- Add a mobile-first coordination view for current assignment, visible scope, latest handoff, blockers, next actions and resume point.
- Route productive Quality Gate reviewers through the Model Router while preserving the offline baseline.
- Feed per-model observed outcomes back into routing without letting adapters mutate Core policy.
- Build complete-document ingestion/parsers with coverage checkpoints before synthesis.
- Add external conversation import adapters and structured error-diagnosis promotion into Error Ledger.
- Add deeper model-assisted Quality Gate reviewers while preserving the offline baseline.
- Materialize the local voice runtime on the actual Janus host when hardware is available.

See `docs/intelligence-kernel.md`, `docs/operator-coordination.md`, `docs/lego-library-projects.md`, `docs/voice-local-runtime.md` and `.env.voice.example`.

### PENDIENTE

- Physical-host latency benchmark and hardware profile.
- Offline acceptance test on the actual host.
- Final voice IDs and model checksums recorded as the VIGENTE runtime profile.
- Durable scheduler/recovery for large LLM jobs beyond a process lifetime.
- External historical chat importers for ChatGPT/Claude/other providers, treated as data sources rather than authority.
- Client rendering of structured citations and provenance.
- User-controlled proactive delivery of meaningful improvement-index changes.
- Wider Tool Gateway coverage and remaining Janus capabilities.
- Apple ecosystem and home-device bridges where they add real value.

### BLOQUEADO

- Physical always-on local voice execution remains blocked until a suitable Janus host is available/configured with local models. This is a deployment/hardware dependency, not an architecture dependency.

## Verification

The CI suite includes an end-to-end full-duplex smoke that starts local simulated STT/TTS services plus the real Janus runtime and verifies the complete voice path. The runtime smoke also authenticates Founder/operator identities, verifies scoped operator handoff, creates reusable library items with dependencies, creates a project with resources, executes a project-linked run, opens a fresh thread and verifies that the new thread automatically receives the prior project instructions/resume point. Intelligence Kernel unit tests verify hard-requirement model routing, Work Graph dependencies, whole-document coverage refusal, citation provenance validation, partitioned-job progress and evidence-based improvement updates.

## Repository layout

```text
apps/pwa/                 Mobile-first Janus interface
apps/runtime/             Local Janus runtime HTTP/WebSocket process
packages/core/            Task/run state, durable jobs, document/citation/improvement primitives
packages/gateways/        Model, Voice and Tool contracts
packages/orchestrator/    Planning, Work Graph and model-routing policy
packages/voice/           Voice session, duplex engine and transport
packages/adapters/        Replaceable provider/tool/model/voice adapters
sidecars/                 Optional local provider processes outside Core
config/                   Tracked examples only; private local config is ignored
docs/                     Architecture, deployment and continuity decisions
tests/                    Unit, integration and end-to-end gates
```
