# ElevenLabs TTS — optional adapter for JANUS Voice Gateway

**Status:** source integration prepared; no production deployment or live speech test yet.
**Owner:** JANUS CORE. Local Qwen3 TTS remains the default and offline path.
**Evidence:** ElevenLabs voice named Jean, voice ID `raw1BVb72Zr3mbid15Oj`, already exists in the authenticated workspace (verified 2026-11-06). Do not recreate it.

## Behavior

The existing `CompositeVoiceGateway` continues to use local Whisper STT. Only the TTS implementation is replaceable. The current optional ElevenLabs adapter uses `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=pcm_24000` and emits the existing typed PCM16/24 kHz mono protocol. No frontend/API changes, no app design changes, no modification to Melanie.

Select a single voice in **server-controlled** configuration. Browser-supplied voice IDs cannot switch the external identity. External requests incur potential provider costs, so the default remains Qwen3; **no automatic paid fallback** and no automatic retry on error. Speech text is capped at 1,000 characters per call by default.

## Runtime setup (only after explicit approval of external speech)

Inject the API credential into the Janus server process from the host's secure credential store (Keychain/secret manager). **Do not commit it, paste it in chat, store in SQLite, put it in config JSON or persist it in .env files.**

```sh
# Host process environment (supply key via secure injector, never inline)
JANUS_TTS_PROVIDER=elevenlabs
JANUS_ELEVENLABS_VOICE_ID=raw1BVb72Zr3mbid15Oj
JANUS_ELEVENLABS_MODEL_ID=eleven_multilingual_v2
JANUS_ELEVENLABS_MAX_CHARS=1000
JANUS_STT_BASE_URL=http://127.0.0.1:8080
# ELEVENLABS_API_KEY comes ONLY from secure runtime injection.
npm start
```

The existing `npm run voice:start` supervisor is still **local-stack-only** and still expects Qwen. For external TTS, bring up the authorized local Whisper sidecar and start Janus runtime separately; do not misrepresent `voice:start` as having been modified.

Check `GET /health`: voice.streaming.tts should say `elevenlabs-tts-adapter` and `available` only if both local STT and the ElevenLabs server-side credential/voice ID are configured. This is **configuration readiness**, not an authenticated provider round-trip or end-to-end test.

To return to local/offline mode, set `JANUS_TTS_PROVIDER=qwen3` and configure the existing `JANUS_TTS_BASE_URL`. Offline Janus must remain useful without ElevenLabs.

## Subscription / credits

`npm run elevenlabs:check` performs a **read-only** GET to the official `/v1/user/subscription` API, using the same secure runtime credential injection. It prints a reduced, non-secret summary of tier, status, usage, limits and invoice flag; no billing mutations or TTS generation. It must be run on an authorized host with an API key. Until run successfully, **payment status and balance remain unverified**. The ElevenLabs app connector exposed here does not provide the subscription/credits endpoint.

Official API:
- https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- https://elevenlabs.io/docs/overview/capabilities/text-to-speech
- https://elevenlabs.io/docs/api-reference/user/subscription/get

## Pending acceptance

- Read-only confirmation of active Creator tier, credits and overage policy via authorized subscription API.
- Confirm secure credential injection without exposing the secret.
- Test Janus → ElevenLabs → WebSocket → iPhone playback with **one short authorized sample** and record actual usage/latency.
- Compare Jean's current clone with any proposed improvement. Kendra cloning/voice choice remains separate and must not be inferred from Jean's identity.
- Test the Qwen offline route end to end. Never mark actual deployment complete from source code changes alone.
