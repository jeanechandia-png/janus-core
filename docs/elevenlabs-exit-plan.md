# ElevenLabs exit plan — use it, learn from it, then replace it

Date: 2026-10-20 · Owner instruction: get everything useful out of ElevenLabs, build our own equivalents, then cancel the subscription.

## Rule

Do not cancel while anything live depends on it. Today the voice advisor «Melanie» runs on ElevenLabs on three public sites (infinityseed.group, infinitychatbox.nl, infinitybusinessassistant.nl). Cancelling before the replacement is live switches her off on all three.

## Already exported (private repo `infinity-chatbox-platform`, `packages/isg-voice/export/2026-10-20/`)

Full agent configuration, system prompt and every knowledge-base text. Product truths are mirrored in `packages/isg-voice/knowledge/` and guarded by tests.

## Feature map — what we use and our own replacement

| ElevenLabs feature we use | Janus / InfinitySeed replacement | Status |
| --- | --- | --- |
| Speech-to-text (Scribe realtime) | whisper.cpp adapter (`whisper-cpp-stt-adapter.ts`) | Built; needs host |
| Text-to-speech (v3 conversational, expressive) | Qwen3-TTS sidecar (`sidecars/qwen3_tts_server.py`) | Built; needs host |
| Voice clone (Founder) | Qwen3-TTS Base + `voice-clone-enrollment.ts` + `likeness-consent.ts` | Built (ADR-009); needs recording + host |
| Conversational agent (turn-taking, barge-in) | Janus full-duplex voice engine (`packages/voice/src/duplex-engine.ts`) | Built |
| LLM behind the agent | Janus Model Gateway (provider-agnostic) | Built |
| Knowledge bases | Product truths in code + Janus reusable library | Built |
| Web widget | `packages/isg-voice` LEGO piece — swap the widget loader for a Janus WebSocket client | To do |
| Pronunciation (IPA phonemes) | Lexicon applied before TTS | To do |
| Allowlist, call limits, retention | Janus gateway policies | To do |
| Automated agent tests | Janus test suite + Delivery Gate | Partly built |

## Steps

1. Record the Founder reference audio and clone the voice (ADR-009) while ElevenLabs is still available for comparison.
2. Stand up the 24/7 host (business-plan investment) with whisper.cpp + Qwen3-TTS; measure latency against today's ~2.4 s.
3. Add a Janus voice endpoint for the public sites and point `packages/isg-voice` to it behind a feature flag, site by site.
4. Run both in parallel for at least two weeks; compare quality, latency and cost.
5. Only then cancel the ElevenLabs subscription.
