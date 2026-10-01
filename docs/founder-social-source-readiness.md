# Founder Social Source Readiness

Status: VIGENTE architecture; external account authorization remains PENDING.

## Objective

Preserve Founder-provided social references as durable Janus source data while preparing a provider-neutral, read-only Meta analytics path that cannot silently escalate into publishing, messaging, campaign management or spend.

## Implemented

- The versioned Founder Reference Library remains the source of truth for the exact URLs supplied by the Founder.
- The Founder Social Source Registry derives only safe locator hints from those preserved URLs:
  - Instagram public handles.
  - Facebook share tokens.
- Facebook share URLs remain marked as unresolved until an authoritative canonical page/profile target is available.
- Meta Graph entity IDs are intentionally unset until an authenticated, revalidated account binding supplies them.
- The registry policy is read-only. Publishing, direct messaging, campaign management and spend are explicitly disabled.
- Credentials remain outside source/config data and must come through the secure credential provider.
- `GET /api/founder/social-sources` requires Founder biometric authority and performs no external request.
- Runtime status distinguishes standby, missing authentication, and configured-but-unverified credentials. A configured token is not treated as a verified account connection.
- Founder reference chronology IDs include a content hash so changed records cannot collide if a timestamp is accidentally reused.

## Not yet implemented / not claimed

- No Meta/Facebook/Instagram OAuth account has been connected or verified.
- No Facebook share URL has been resolved to a canonical page/profile identifier.
- No Meta Graph entity ID has been bound to any preserved reference.
- No live social metrics have been ingested.
- No publishing, messaging, ads, campaign or spend capability is enabled.
- No scheduled social polling is active.

## Safe activation sequence

1. Resolve each Facebook share reference against an authoritative Meta identity while preserving the original URL.
2. Authorize least-privilege read access through the credential broker; never persist access tokens in SQLite, source control or the Founder Reference Library.
3. Bind verified Graph entity IDs to their matching preserved references and revalidate the binding before every productive read.
4. Only after read-path verification, schedule read-only snapshots into the Operations Hub with provenance and timestamps.

Mutation capabilities, if ever needed, must be designed as a separate approval-gated capability and must not inherit authorization from this read-only registry.
