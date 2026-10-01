# ADR-007 — Founder biometric authority and operations security

Status: Accepted  
Date: 2026-10-01

## Context

JANUS CORE already authenticates privileged human authority with local ECDSA P-256 challenge/response and keeps private credentials outside Janus. The Founder/Director additionally requires a second, face-gated control for a narrower class of actions that no administrator, operator, model, document, web source or external service may substitute for.

The preferred design is not to turn Janus into a biometric database. Biometric material is high-value security data and should remain under the platform biometric subsystem whenever that satisfies the requirement. The Founder has explicitly authorized local biometric storage if Janus later needs it for a more effective authentication path.

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

The preferred production path remains platform-owned Face ID: JANUS CORE receives a cryptographic assertion, not Apple's Face ID template or platform biometric database. Apple/platform biometric templates are not expected to be exportable to Janus.

Founder authorization additionally permits a Janus-specific local biometric matcher if it becomes operationally necessary. In that fallback/design extension:

- raw enrollment captures should be transient and deleted after template derivation unless a separately documented technical need requires retention;
- prefer a derived face embedding/template rather than raw photos/video;
- any retained template must be encrypted locally with keys outside SQLite/source control, revocable and rotatable;
- biometric material must not be committed to Git, sent to model providers, or synchronized to cloud backup by default;
- the stored consent record is policy metadata only and contains no biometric material.

The expected preferred production device flow is:

1. the device owns a P-256 private key protected by platform secure hardware and current-biometry policy;
2. Core stores/knows only the corresponding public key;
3. Core issues a random, short-lived, action-scoped challenge;
4. the platform prompts for Face ID before allowing the private key operation;
5. the device signs the challenge;
6. Core verifies the signature and mints a one-time in-memory proof ticket.

The Core now implements durable public-key storage, challenge issuance, proof verification and one-time proof consumption. Native iOS source under `platform/ios/` implements Secure Enclave P-256 key generation and Face ID-gated signing using `privateKeyUsage + biometryCurrentSet`. The source is not equivalent to a completed deployment: physical Face ID prompting is not considered live until the bridge is packaged, installed and verified on the actual Founder device.

### 3. Enrollment, re-enrollment and invalidation

The native bridge uses the platform “current enrolled biometry” access-control policy so a Face ID enrollment change invalidates the protected key.

Enrollment is intentionally two-layered:

1. Core issues a short-lived enrollment challenge bound to the candidate key ID and SHA-256 fingerprint of its normalized P-256 public key.
2. The candidate private key must sign that challenge before Core records the public key.

This proves possession of the candidate private key but does not by itself provide remote hardware attestation. To reduce bootstrap risk, initial API enrollment is disabled by default and requires an operator-controlled temporary runtime switch: `JANUS_ALLOW_BIOMETRIC_BOOTSTRAP=true`. Once at least one Founder face key exists, enrolling another key additionally requires a fresh proof from an already-enrolled Founder face key scoped to `security.biometric.enroll`.

Biometric key IDs are append-only. A revoked key ID cannot be silently reused. Server-side revocation requires `security.biometric.revoke`, explicit confirmation, and Janus refuses to revoke the last active Founder face key through the API. Local Secure Enclave deletion occurs separately only after server-side revocation succeeds.

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
- the preferred Face ID path still avoids a Janus biometric database, while Founder-authorized local derived templates remain available as a controlled fallback if technically necessary;
- proofs are replay-resistant, short-lived and scoped;
- security remains local-first and provider-independent;
- operations/analytics can expand without granting customer assistants unrestricted internal access.

Costs and limitations:

- native signer source is implemented, but packaging/installing it and proving the physical Face ID flow on the actual device is still required for end-to-end acceptance;
- losing/re-enrolling the biometric set requires explicit key recovery/re-enrollment;
- any future Janus-specific biometric template store requires encrypted-at-rest implementation, revocation/rotation and verification before it can be treated as live;
- external product/account data remains unavailable until its authoritative source and least-privilege credential are configured;
- read-only analytics are intentionally separate from campaign publishing or financial mutations.

## Verification

Automated tests cover:

- successful face-gated signature proof;
- new-key enrollment proof-of-possession and replay rejection;
- append-only biometric key rotation semantics;
- durable SQLite storage of public biometric-key metadata only;
- static native bridge contract checks for Secure Enclave, `biometryCurrentSet`, Face ID-only gating and ECDSA/SHA-256;
- rejection of non-face biometric registration under the Founder policy;
- replay rejection;
- wrong-signer rejection;
- administrator refusal on Founder biometric scopes;
- TaskRunner fail-closed behavior for sensitive read operations;
- runtime operator delegation refusal without face proof and success with a fresh action-scoped proof;
- local product finance/health/social persistence and aggregation;
- read-only Meta/YouTube adapter behavior.
