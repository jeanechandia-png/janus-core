# ADR-006 — Local Public-Key Authority Authentication

Status: VIGENTE  
Date: 2026-09-30

## Decision

JANUS authenticates privileged human authority with a local **ECDSA P-256 challenge-response** protocol.

The private key is never stored by JANUS. JANUS stores only the corresponding public key and non-secret principal metadata needed to verify signatures and enforce authority policy.

## Security model

1. The Founder/Director has the stable principal id `founder`.
2. The Founder public key is enrolled explicitly. A later mismatch fails closed; JANUS does not silently rotate founder authority.
3. Authentication uses a short-lived, one-use random challenge.
4. The client signs the exact challenge payload with an ECDSA P-256 private key held outside JANUS, ideally in OS secure storage, Secure Enclave, passkey/WebAuthn or an equivalent hardware-backed store.
5. JANUS verifies the signature with the enrolled public key.
6. Successful verification creates a short-lived bearer session.
7. Session tokens are never persisted. The runtime stores only SHA-256 hashes of active session tokens in process memory.
8. SQLite stores public credentials only:
   - principal id;
   - role;
   - display name when configured;
   - public key;
   - active/revoked state;
   - creation, delegation and revocation metadata.
9. Passwords, private keys, recovery secrets and raw session tokens are forbidden from SQLite, logs, prompts and source code.
10. Authentication endpoints are accepted only over loopback or an explicitly trusted HTTPS reverse proxy.

## Delegation

Only an authenticated Founder/Director session can create or revoke administrator credentials.

Administrators:
- receive their own public-key credential;
- may authenticate independently;
- can perform normal privileged administrative work allowed by the Authority Control Plane;
- cannot delegate/revoke administrators;
- cannot perform Founder-only root actions.

Revocation immediately invalidates all in-memory sessions belonging to the revoked administrator.

## Root actions

Actions such as root-key rotation, disabling audit or transferring authority remain Founder-only and still require explicit confirmation even after successful authentication.

Authentication proves **who is asking**. It does not remove independent approval, confirmation, idempotency, risk or policy checks.

## Runtime protocol

Endpoints:
- `GET /api/auth/status`
- `POST /api/auth/challenge`
- `POST /api/auth/verify`
- `POST /api/auth/logout`
- `POST /api/auth/admin/delegate`
- `POST /api/auth/admin/revoke`

Authenticated `POST /api/command` attaches a verified human principal to the TaskRunner authority context. Commands without an authenticated session may still perform permitted read-only work; privileged mutations remain fail-closed.

Voice-originated privileged actions remain blocked until the voice transport has its own authenticated-session binding. A transcript alone never grants administrative authority.

## Bootstrap

The initial Founder public key can be provided to the runtime through `JANUS_FOUNDER_PUBLIC_KEY_PEM`.

This value is a **public key, not a secret**. The matching private key must be generated and retained outside JANUS.

For remote authentication traffic, `JANUS_AUTH_TRUST_SECURE_PROXY=true` may be used only when JANUS is actually behind a trusted TLS-terminating reverse proxy that supplies `X-Forwarded-Proto: https`.

## Result

JANUS can authenticate and delegate human administrative authority without storing reusable authentication secrets, while preserving local-first operation, provider independence, auditable authorization and fail-closed behavior.
