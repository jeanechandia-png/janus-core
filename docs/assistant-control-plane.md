# Assistant Control Plane + Continue-by-Alternatives

Janus owns a central control plane for shared assistant behavior. Product assistants are surfaces of a shared profile, not independent copies.

## Goal

A shared improvement should be authored once and inherited everywhere that follows the current profile revision.

Current seeded surfaces:

- `landing.infinity-group` — Infinity Group main landing assistant.
- `landing.infinity-chatbox` — Infinity ChatBox landing assistant.
- `landing.iba` — Infinity Business Assistant (IBA) landing assistant.

All three follow profile `infinity-landing-assistant` with `tracking=current` by default.

## Inheritance model

```text
Infinity shared landing assistant profile
            │
            ├── Infinity Group landing
            ├── Infinity ChatBox landing
            └── IBA landing
```

The shared profile owns:

- objective;
- shared behavior instructions;
- security/authority guardrails;
- shared capabilities;
- references to reusable LEGO Library modules.

Each surface owns only its presentation and delivery boundary:

- brand name;
- greeting/disclosure/language/accent token;
- capabilities it deliberately disables;
- delivery targets;
- active/paused state;
- optional temporary revision pin.

A surface cannot add a capability that the shared profile does not own. It can only remove capabilities.

## Versioning

Assistant profiles are append-only revisions.

When revision N+1 becomes `current`:

1. revision N becomes `historical`;
2. surfaces tracking `current` resolve N+1 automatically;
3. no per-surface edit is required;
4. surfaces explicitly `pinned` stay on their pinned compatible revision;
5. the update leaves a governance chronology record.

This is the assistant equivalent of the LEGO Library rule: engineering is centralized and reused.

## Reusable module integration

A profile may reference items from the Janus Reusable LEGO Library.

Example:

```text
module.assistant.shared-core@1
  ├── button.hyperreal.glow@1
  └── icon.translator.medallion@1

infinity-landing-assistant@2
  └── module.assistant.shared-core@1

landing.infinity-group  -> inherits profile@2
landing.infinity-chatbox -> inherits profile@2
landing.iba              -> inherits profile@2
```

Required module references are validated before a new profile revision can become current.

## Runtime APIs

Read/control:

- `GET /api/assistant-control`
- `GET /api/assistant-control/surfaces/:surfaceId/config`

Founder-only mutation:

- `POST /api/assistant-control/profiles/:profileId/revisions`
- `POST /api/assistant-control/surfaces/:surfaceId`
- `POST /api/assistant-control/surfaces/:surfaceId/publish`
- `POST /api/assistant-control/deliveries/:deliveryId/ack`

Publisher/readback:

- `GET /api/assistant-control/surfaces/:surfaceId/bundle`
- `GET /api/assistant-control/deliveries`

The resolved config includes a checksum and exact inherited profile revision.

## Delivery boundary

Janus now has a productive repository publisher for resolved assistant bundles. The three production websites are still not all consuming the bundle automatically, so repository publication and live application remain distinct states.

Current verified product topology:

- Infinity ChatBox and IBA share the canonical `infinity-chatbox-platform` code lineage.
- The Infinity Group corporate website is a separate repository.
- ChatBox currently has platform assistant policy in its own runtime.
- IBA currently has landing/demo assistant behavior in the shared product repository.

Therefore the next productive delivery layer is **publish/sync**, not duplicate editing:

```text
Janus Assistant Control Plane
  -> deterministic sanitized config bundle
  -> GitHub Tool Gateway publisher
  -> explicit branch HEAD revalidation
  -> idempotent repository write
  -> read-back verification by commit checksum
  -> status: published_verified
  -> product consumes exact config revision
  -> product health/telemetry acknowledges bundle checksum
  -> status: applied
```

Do not expose the local Janus runtime publicly merely to make landings fetch configuration. Janus should publish sanitized signed/versioned configuration snapshots through a replaceable gateway. Secrets remain outside the bundle.

Before publishing to a product target, Janus must re-resolve its current validated branch/deployment lineage instead of hardcoding temporary branches.

## Continue-by-Alternatives

Provider/tool failure must not become project paralysis.

Janus uses the protocol:

```text
PROBLEM
-> RISK
-> CAUSE
-> 2-4 REAL OPTIONS
-> EVIDENCE
-> RECOMMENDATION
-> NEXT ACTION
```

A non-mandatory dependency can be parked while independent work continues.

Examples:

- model provider unavailable -> another registered model;
- model provider unavailable -> local/offline path;
- provider-only step -> park it and continue independent project work;
- reasoning unnecessary -> use deterministic registered tool/workflow.

Mandatory stops remain mandatory:

- missing human approval;
- missing legal/security authority;
- irreversible high-risk action without confirmation;
- missing data that would make the result materially false.

Blocked runtime paths now persist a `blocker_resolution` Decision Receipt. For coordinated work, that resolution also appears in the operator handoff so Julio or any future operator receives alternatives instead of a dead-end error.

## Current boundary

The policy, inheritance and repository publishing path are productive inside Janus Core. Publishing requires Founder authentication, explicit `confirmAction`, an explicit target branch, GitHub write authentication, authority audit hash and idempotency key.

A successful publish is marked `published_verified` only after Janus reads the bundle back from the resulting commit and verifies its checksum. It is **not** marked `applied` until a separate acknowledgement reports the same bundle checksum.

The remaining integration is product-side consumption and trustworthy acknowledgement/telemetry. Until each landing actually loads the published bundle and reports it, Janus must not claim that a repository-published revision is live.
