# ADR-007 — Founder biometric authority and operations security

Status: Accepted  
Date: 2026-10-01

## Context

JANUS CORE already authenticates privileged human authority with local ECDSA P-256 challenge/response and keeps private credentials outside Janus. The Founder/Director additionally requires a second, face-gated control for a narrower class of actions that no administrator, operator, model, document, web source or external service may substitute for.

The requirement is not “store Jean's face in Janus.” Biometric templates are high-value secrets and must remain under the platform biometric subsystem whenever possible.

Janus also needs to coordinate customer-facing assistants, product operations, financial evidence and social-channel analytics without collapsing those scopes into one unrestricted superuser surface.

## Decision

### 1. Two independent gates

Sensitive Founder actions require both:

1. a valid JANUS authority session for the configured `founder_director`; and
2. a fresh action-scoped `platform-face` attestation.

The biometric proof is single-use and expires quickly. A proof for one operation cannot authorize another operation.

Initial face-only scopes include:

- `founder.private.*`
- `security.biometric.*`
- `security.authority.*`
- `security.secrets.*`
- `finance.credentials.*`
- `finance.export_unredacted`
- `delete_all`
- `rotate_root_keys`
- `disable_audit`
- `transfer_authority`

Root actions may additionally require explicit confirmation. Biometric proof does not replace confirmation.

### 2. Biometric data boundary

JANUS CORE must never receive or persist a raw face image, Face ID template or platform biometric database.

The expected production device flow is:

1. the device owns a P-256 private key protected by platform secure hardware and current-biometry policy;
2. Core stores/knows only the corresponding public key;
3. Core issues a random, short-lived, action-scoped challenge;
4. the platform prompts for Face ID before allowing the private key operation;
5. the device signs the challenge;
6. Core verifies the signature and mints a one-time in-memory proof ticket.

The current runtime implements steps 2, 3, 5 and 6 and fails closed when no configured face-bound public key/proof exists. The physical/native Face ID key-generation/signing bridge is a deployment dependency and must not be represented as already live.

### 3. Re-enrollment invalidation

The production device key is expected to use the equivalent of a “current enrolled biometry” access-control policy so a biometric enrollment change invalidates the protected key. Recovery/re-enrollment must create a new key under an explicit Founder-controlled procedure; it must not silently fall back to an administrator.

### 4. Authority delegation is face-gated

Creating or revoking administrator/operator authority is itself security-sensitive. Runtime endpoints for those changes consume a fresh Founder biometric proof scoped to the specific delegation/revocation action.

This prevents an authenticated delegated operator such as Julio from becoming Founder authority or modifying the authority graph.

### 5. Operations separation

Product operations are represented as evidence-backed local records:

- product registry/state;
- ledger entries by product and currency;
- runtime health snapshots;
- social-channel snapshots;
- monetization-requirement snapshots.

Currencies are never silently combined. Unknown or unverified values remain explicit. Platform eligibility thresholds are stored as sourced snapshots rather than hardcoded constants.

Meta and YouTube adapters are read-only in this phase. Publishing, ad spend, payments or other external mutations require separate capabilities, idempotency, approvals and audit.

### 6. Customer-facing isolation

The shared assistant control plane may inherit 24/7 customer-support behavior, but customer surfaces may not expose internal accounting, credentials, private analytics or Founder-only state. Product-specific knowledge routing and human handoff remain enforced boundaries.

## Consequences

Positive:

- compromise of an administrator session is insufficient for face-only Founder actions;
- Janus does not become a biometric database;
- proofs are replay-resistant, short-lived and scoped;
- security remains local-first and provider-independent;
- operations/analytics can expand without granting customer assistants unrestricted internal access.

Costs and limitations:

- a native/platform biometric signer is still required for end-to-end Face ID on the real device;
- losing/re-enrolling the biometric set requires explicit key recovery/re-enrollment;
- external product/account data remains unavailable until its authoritative source and least-privilege credential are configured;
- read-only analytics are intentionally separate from campaign publishing or financial mutations.

## Verification

Automated tests cover:

- successful face-gated signature proof;
- rejection of non-face biometric registration under the Founder policy;
- replay rejection;
- wrong-signer rejection;
- administrator refusal on Founder biometric scopes;
- TaskRunner fail-closed behavior for sensitive read operations;
- runtime operator delegation refusal without face proof and success with a fresh action-scoped proof;
- local product finance/health/social persistence and aggregation;
- read-only Meta/YouTube adapter behavior.
