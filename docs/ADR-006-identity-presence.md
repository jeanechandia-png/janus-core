# ADR-006 — Janus Identity & Presence

Status: VIGENTE  
Date: 2026-09-23

## Decision

Janus adds a local-first Identity & Presence layer in front of the Administrative Authority Control Plane.

Facial recognition is an authentication factor, not identity authority. A face match alone never grants root authority.

## Authentication chain

```text
camera / sensor
  -> local biometric adapter
  -> face template match
  -> liveness / anti-spoof evidence
  -> trusted-device evidence
  -> short-lived Presence Session
  -> Authority Control Plane
  -> privileged action
```

Root-destructive or authority-changing actions require an additional independent factor such as a PIN or recovery key.

## Privacy and security invariants

- Raw enrollment photos are not authentication secrets and should be discarded after enrollment unless the administrator explicitly chooses encrypted archival storage.
- Biometric templates are referenced from Keychain, Secure Enclave, TPM or an equivalent secure store; they are never stored in SQLite, source code, workflow JSON, logs or prompts.
- Matching should run locally whenever the device permits it.
- Liveness/anti-spoofing is required for strong face authentication.
- Face recognition is 1:1 verification against an enrolled administrator template, not open-ended identification of strangers.
- Sessions are short-lived and auditable.
- Models/adapters are replaceable; JANUS CORE defines assurance policy.
- Voice biometrics may later be an additional signal but never the sole root factor.
- Recovery must remain possible without biometrics through a separately protected recovery mechanism.

## Assurance levels

- none: no verified factor.
- basic: at least one verified factor.
- strong: trusted device + face match + liveness.
- root: strong + an independent additional factor.

## Product target

Future adapters may use platform biometrics when available or Janus-owned local models. The core must remain provider-independent and continue to enforce the same assurance contract.
