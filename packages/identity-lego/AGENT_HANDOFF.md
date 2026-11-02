# JANUS identity LEGO — agent handoff
Date: 2026-11-02
Repository: jeanechandia-png/janus-core
Branch: feat/identity-lego-voice-face-20261102
Baseline: main, latest observed commit 9b38f41fd284e5923102d0faa783c81c4eac532e
Goal: Jean/Kendra voice cloning and facial recognition as replaceable local-first modules.
Implemented on branch: provider-independent contracts, consent guard for synthesis, voice/face recognition interfaces, non-authoritative identity proofs, unit test source.
Not implemented: actual provider binding, local biometric enrollment/storage, API integration, capture UI, real media validation, production deployment.
Verification: GitHub commits required; CI/test execution not yet established. Do not claim operational recognition or cloning.
Next exact action: inspect existing Qwen voice clone sidecar and iOS Face ID bridge; bind actual local adapters to contracts without modifying existing founder authorization semantics. Implement explicit enrollment/revocation, encrypted local storage and tests with consented test media.
Security: no raw child biometric data in Git; no external provider calls without explicit authorization. Biometric matching alone is not tool authorization.
Acceptance: typecheck, unit and E2E tests, permission separation, revocation and regression tests, verified handoff commit.
