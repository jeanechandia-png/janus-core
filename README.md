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

These primitives are intentionally independent of any model vendor. Runtime persistence, concrete document parsers, model inventory, job scheduler and proactive notification wiring are the next implementation layer.

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
- Chronological continuity engine with current/history resolution, resume pointer, unresolved-error carryover and Error Ledger.
- Janus-owned local conversation archive in SQLite with chronological replay.
- Automatic extraction of explicit durable user instructions and reported errors into continuity records.
- Delivery Gate enforced before artifact delivery with offline baseline reviewers for coherence, structure, visual presentation, architecture, orthography and synthesis.
- CI gates: strict TypeScript, PWA syntax, Qwen sidecar syntax, tests and runtime smoke.

### AHORA

- Persist Work Graph, job partitions, citation ledger and improvement-index history in SQLite.
- Add model inventory/configuration so Model Router can choose among actual local and remote adapters.
- Build complete-document ingestion/parsers with coverage checkpoints before synthesis.
- Add external conversation import adapters and structured error-diagnosis promotion into Error Ledger.
- Add deeper model-assisted Quality Gate reviewers while preserving the offline baseline.
- Materialize the local voice runtime on the actual Janus host when hardware is available.

See `docs/intelligence-kernel.md`, `docs/voice-local-runtime.md` and `.env.voice.example`.

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

The CI suite includes an end-to-end full-duplex smoke that starts local simulated STT/TTS services plus the real Janus runtime and verifies the complete voice path. Intelligence Kernel unit tests verify hard-requirement model routing, Work Graph dependencies, whole-document coverage refusal, citation provenance validation, partitioned-job progress and evidence-based improvement updates.

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
