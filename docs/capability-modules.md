# Janus Capability Modules

Status: VIGENTE
Date: 2026-09-23

## Principle

Reusable capabilities created for Janus should be designed so they can also be packaged as provider-independent product modules without making downstream products depend on JANUS CORE.

Janus remains the reference implementation and native consumer. Product modules expose stable contracts through adapters/SDKs.

## Identity & Presence module

The first reusable module is Identity & Presence.

Product-facing capabilities:
- Face verification 1:1
- Liveness / anti-spoof
- Trusted-device binding
- Short-lived assurance sessions
- Re-authentication for protected areas/actions
- Sensitive Vault access policies
- Administrative dashboard protection
- Root/critical action MFA
- Audit trail

## IBA integration target

IBA may consume Identity & Presence as an optional commercial module.

Initial use cases:
1. Protect the administrative dashboard with strong presence.
2. Protect a Sensitive Vault for confidential records/settings.
3. Require re-authentication for selected critical actions.
4. Maintain an auditable security trail without exposing biometric templates to IBA.

IBA must consume an interface/SDK contract. Biometric templates remain in secure local/platform storage and must not be copied into IBA databases.

## Packaging

Working commercial packaging:
- IBA Core: conventional authentication.
- IBA Secure Access: face verification + liveness + protected admin access.
- IBA Secure Vault: sensitive zones + re-authentication policies.
- Enterprise Security: multiple administrators, policy controls, trusted devices and centralized audit.

Names and prices are provisional until market and willingness-to-pay validation.

## Reuse rule

For each substantial Janus capability, evaluate:
- native Janus use;
- reusable Capability Module;
- product-specific adapter;
- independent SDK/API potential;
- privacy/security boundary;
- commercial packaging and measurable customer value.

Candidate future modules include Voice, Vision, Document Intelligence, Automation, Agent Swarm, Research, Memory and anomaly detection.
