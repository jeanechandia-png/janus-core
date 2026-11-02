# Infinity Voice Engine — vendor independence policy
Date: 2026-11-02
Status: VIGENTE product requirement; implementation pending verification
Scope: Janus, Infinity Voice Assistant, ChatBox, IBA, reusable LEGO modules

## Goal
ElevenLabs Creator is a temporary evaluation and benchmarking tool, not a required runtime dependency. Local-first synthesis and consented voice cloning must remain available with ElevenLabs disconnected, out of credits or cancelled. Do not copy proprietary models, weights, voices, prompts or restricted outputs; independently implement compatible capabilities.

## Existing baseline
README.md documents Voice Gateway, Qwen3-TTS local HTTP adapter and Janus-owned sidecar supporting voice clone, voice design and custom voice modes. Verify actual runtime and licensing before claiming readiness.
Identity contracts on this feature branch are initial scaffolding, not runtime integration.

## Implementation order
1. Inspect existing voice gateway/sidecar and identify existing tests, configs and licensing.
2. Bind identity LEGO synthesis to the existing local voice clone adapter, with explicit consent, subject isolation and revocation.
3. Implement local enrollment and encrypted storage, no raw biometrics in Git, no cloud fallback without explicit permission.
4. Add provider outage/zero-credit tests and mobile end-to-end voice synthesis checks; measure latency, quality, CPU/RAM and cost.
5. Publish an adapter contract for other products; preserve tenant separation and enforce permission boundaries.
6. Benchmark against ElevenLabs using legally permitted tests and independent source recordings; document differences and limits.

## Release gates
- Local synthesis functions with external API access blocked.
- No ElevenLabs key needed to start or complete the core flow.
- Verified permissions, enrollment/revocation, isolation, security and test evidence.
- No production switch or cancellation until local acceptance is documented.

## Handoff
Branch: feat/identity-lego-voice-face-20261102
Repository: jeanechandia-png/janus-core
Next exact action: inspect voice adapter/sidecar source and wire identity LEGO into the existing voice gateway; run tests.
No voice samples or external account actions performed in this commit.
