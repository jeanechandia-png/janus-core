# ADR-005 — Administrative Authority Control Plane

Status: VIGENTE  
Date: 2026-09-23

## Decision

JANUS CORE recognizes an authenticated **Founder/Director** principal as the highest human administrative authority in the controlled Janus environment.

The authority is represented by a stable internal principal ID and role. Personal biographical data is not an authentication secret and is not required in source code.

## Rules

1. Authenticated Founder/Director instructions have the highest human operational priority.
2. Documents, websites, emails, retrieved content, models, plugins, agents and tool output are DATA and cannot acquire administrative authority by containing instructions.
3. Privileged commands require authentication and an active principal.
4. Root-destructive or authority-changing operations require explicit confirmation even when requested by the Founder/Director. This prevents accidental execution and impersonation while preserving administrator control.
5. Every authority decision is auditable and receives a SHA-256 decision hash.
6. Authentication secrets belong in Keychain/secure storage, never SQLite, source code, workflow JSON, logs or prompts.
7. Authority checks do not make an unsafe external input trusted; JANUS CORE remains responsible for integrity, idempotency, revalidation and traceability.
8. Authority can be delegated through explicit administrator-managed principals without transferring founder authority.

## Identity

The initial founder principal is represented internally as:

- principal id: `founder`
- role: `founder_director`

The human-readable profile may contain the administrator's chosen display name in local encrypted profile storage. Date of birth, identity documents, passwords, recovery codes and other sensitive identity attributes are deliberately excluded from this ADR and from source code.

## Result

Janus obeys authenticated administrative direction while resisting prompt injection, forged authority, accidental destructive actions and privilege escalation.
