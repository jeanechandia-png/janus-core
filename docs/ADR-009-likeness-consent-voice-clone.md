# ADR-009 — Likeness consent, voice clone and digital likeness

Date: 2026-10-20 · Status: accepted as candidate (owner instruction) · Owner: Founder

## Decision

Janus clones the Founder's own voice and builds his digital likeness (face/avatar) through two reusable LEGO modules:

- `packages/core/src/likeness-consent.ts` — one decision point for any voice/face/avatar synthesis of a person.
- `packages/voice/src/voice-clone-enrollment.ts` — turns an approved local recording into a `voice_clone` entry for the local Qwen3-TTS sidecar (see `docs/voice-local-runtime.md`).

Both are product-neutral: ChatBox «Personal Voice Clone», IBA Voice AI, School and Connect can import them without touching Janus.

## Rules

1. Only the person grants consent for their own likeness (`grantedBy === principalId`).
2. Consent is scoped (modalities, uses, products), expiring and revocable; revocation blocks every future use.
3. Reference material stays local and is referenced by SHA-256; remote URLs are refused; nothing is committed (repo is public).
4. A voice reference needs its exact transcript and passes quality gates (≥ 8 s, ≤ 180 s, ≥ 16 kHz, ≥ 16-bit).
5. Enrollment only accepts the exact recording approved in the consent record.
6. Every synthetic output carries an AI-generated disclosure.
7. Synthetic voice or face is never presence evidence (ADR-008): a clone cannot authenticate anyone.

## Facial recognition

Face verification of the Founder already exists as ADR-008 Identity & Presence (1:1, liveness, secure-store templates) with the iOS Face ID bridge (`platform/ios/JanusFounderFaceSigner.swift`). Remaining gate: physical iPhone test (Xcode → device → airplane mode → restart). This ADR adds only the *synthesis* side (avatar/likeness), kept separate from authentication.

## What is still needed to actually clone

- A clean 30–90 s recording of the Founder (WAV, quiet room, natural speech) plus its exact transcript, stored locally outside Git.
- A host able to run Qwen3-TTS Base (the 24/7 machine of the business plan) — or, temporarily, a hosted provider adapter behind the same consent gate.
- For the avatar: approved face reference images (secure store) and a video provider adapter (Kling/Runway adapters exist) behind `decideLikenessUse`.
