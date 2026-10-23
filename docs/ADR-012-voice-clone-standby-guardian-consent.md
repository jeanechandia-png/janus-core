# ADR-012 — Voice clone: Founder ready, Kendra on standby (guardian consent)

Date: 2026-10-23 · Status: accepted (Founder instruction, 2026-10-23) · Owner: Founder
Builds on ADR-009 (likeness consent, voice clone) and ADR-008 (synthetic likeness is never presence).

## Decision

1. **The Founder's voice is cloned first**, with his recording and his approval. Face: for now only *recognition* (household identification + the Face ID bridge of ADR-007/008); cloning his face/avatar is out of this phase.
2. **Kendra's voice stays on STANDBY.** Nothing starts, and nothing is created, until the Founder asks («Janus, vamos a clonar la voz de Kendra»). Janus runs the whole process itself through the `likeness` tool.
3. **A minor is never her own grantor.** `createGuardianLikenessConsent` requires: a distinct parent/guardian, the child's recorded assent, **voice only**, uses limited to `janus_private_assistant` (plus the internal lab), product `janus` only, and at most 180 days (renewable by the guardian). `decideLikenessUse` re-checks those limits, so a tampered record cannot widen them.
4. **Every enrolment is a sensitive action** (sensitive-action policy): Janus asks for the Founder's explicit approval each time. For Kendra the approval card states that he declares being her father/legal guardian and that she agrees; the planner only carries those two declarations when he actually said them, and the tool refuses without them.
5. **Who can ask:** only the owner profile. `likeness` is not in `HOUSEHOLD_SAFE_TOOLS`, so a child or a restricted/unknown speaker can never reach it (voice/face recognition is convenience, never authorisation).

## The `likeness` tool (thin adapter, `packages/adapters/src/likeness-tool-adapter.ts`)

Actions: `status`, `founder.voice.guide`, `founder.voice.enroll`*, `kendra.voice.guide`, `kendra.voice.enroll`*, `voice.revoke`, `founder.face.guide`. (* = approval forced.)

Flow: the person reads a fixed Spanish script (`voice-clone-scripts.ts`, so the exact transcript is known) in «Notas de voz» → the file lands in the host inbox (`JANUS_VOICE_INBOX`, default `data/voice-inbox`) → Janus converts the phone audio to mono 16-bit WAV with the local `ffmpeg`, checks quality (8–180 s, ≥ 16 kHz), optionally checks with the local STT that the script was really read (word error rate ≤ 30 %), creates the consent (hash of the recording), keeps a normalised copy in `voices/private/` and writes the `voice_clone` entry into `config/voices.local.json` for the Qwen3-TTS sidecar.

Safety properties (all covered by `tests/likeness-tool.test.ts`):
- Only files inside the inbox are read (no traversal, absolute paths, symlinks or other file types).
- Kendra's recording must always be named; a lone unnamed file in the shared inbox is never assumed to be hers.
- Re-recording supersedes the previous consent (one active consent per person). `voice.revoke` withdraws the consent, removes the engine entry and deletes the private copy; the person's original in the inbox is never touched.
- Reference audio, paths and the birth date never appear in tool outputs; nothing personal is committed (the repository is public).
- Every synthetic output must carry the AI disclosure (ADR-009 rule 6). A clone never authenticates anyone.

## States (visible in `/health` → `voiceClone` and in `status`)

`not_started` / `standby` → `recorded_waiting_for_host` (recorded and authorised, but no machine with the model yet) → `enrolled` → `revoked`.

## Honest limits (POR CONFIRMAR)

- No audio of the Founder exists in this environment and there is **no host with Qwen3-TTS yet**: the flow is built and tested with synthetic audio and real `ffmpeg`, but a clone has not been produced and its quality/latency is unmeasured. With `JANUS_TTS_CLONE_MODEL_PATH` unset, Janus keeps the authorised recording and finishes the enrolment later without recording again.
- How the phone's recording reaches the host inbox today (Files/iCloud/Drive sync/AirDrop) is unverified; the tablet node (`docs/tablet-node.md`) is not known to run Qwen3-TTS.
- Hosted cloning (ElevenLabs) stays dormant: the budget norm says spending goes last (`docs/dormant-capabilities.md`).
- The STT check hook (`transcribe`) is implemented and tested with a fake; it is not yet wired to the local whisper.cpp server.
- The TTS path does not yet call `decideLikenessUse` per synthesis; the engine entry carries `allowed_uses`/`restricted` so the gateway can enforce it when a clone voice becomes active. Until then no clone voice is active.
- Face ID as a Founder key still needs the physical iPhone test (ADR-008). InsightFace weights licence: unverified.
