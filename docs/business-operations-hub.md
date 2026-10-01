# Business Operations Hub

## Purpose

JANUS CORE needs one local-first operational view across Infinity Group products without turning any external vendor into the source of truth.

The Operations Hub is a generic product layer. Tribuna Virtual, Infinity School, Infinity Connect, ChatBox, IBA and future products can be registered as VIGENTE records when their real data sources are known. Product names/endpoints are not baked into Core logic.

## Local state

SQLite stores four evidence families:

1. **Product record** — identity, lifecycle state, support surface and authoritative source references.
2. **Ledger entry** — income, expense, refund, fee or tax, always with product, currency, timestamp, source and verification state.
3. **Health snapshot** — current/degraded/down/unknown runtime state plus sourced metrics.
4. **Channel/monetization snapshots** — Facebook, Instagram, YouTube or other channel metrics and platform-reported eligibility requirements.

Money is stored in integer minor units. Balances are calculated independently per currency. Janus never adds EUR and USD into one unsupported “total.”

## Runtime API

Authenticated internal reads:

- `GET /api/operations`
- `GET /api/operations/products/:id`

Founder-controlled ingestion/configuration:

- `POST /api/operations/products`
- `POST /api/operations/ledger`
- `POST /api/operations/health`
- `POST /api/operations/social`
- `POST /api/operations/monetization-requirements`

These endpoints persist supplied verified evidence. They do not invent external values.

## Social analytics adapters

### Meta

`meta-insights` is read-only in this phase:

- `facebook.page.insights`
- `instagram.account.insights`

`META_GRAPH_API_VERSION` must be supplied explicitly instead of silently pinning a transient “latest” assumption. `META_ACCESS_TOKEN` is resolved through the credential boundary and is never written to SQLite by this adapter.

### YouTube

`youtube-insights` is read-only:

- `channel.statistics`
- `analytics.query`

`YOUTUBE_ACCESS_TOKEN` is resolved through the credential boundary. Monetary metrics require the appropriate Google OAuth authorization; Janus does not treat an unavailable metric as zero.

## Customer support relationship

The shared assistant profile now includes:

- grounded 24/7 support behavior while the product runtime is online;
- product-scope knowledge routing;
- unresolved-question capture;
- human handoff;
- explicit prohibition on exposing internal accounting, credentials, private analytics or Founder-only context.

The verified Assistant Config Publisher can publish the shared bundle to a target repository and verify the bytes. A product is not marked `applied` until it reports the matching bundle checksum.

## Campaign/monetization evolution

The current layer is intentionally observational. It can collect verified evidence needed to plan campaigns: follower/subscriber counts, views, engagement, revenue metrics and platform eligibility requirements.

A later mutation layer may add content publishing or ads, but must be separate and must include:

- least-privilege permissions;
- idempotency keys;
- spend ceilings where money is involved;
- explicit approval policy;
- source revalidation before action;
- Decision Receipt/audit trace;
- rollback/cancel behavior where the platform supports it.

No monetization threshold is hardcoded into Core. Platform requirements change and must be re-read from an authoritative source.

## Deployment dependencies

Not yet connected automatically:

- Tribuna Virtual runtime/DB/billing endpoint;
- Infinity School runtime/accounting source;
- Infinity Connect runtime/accounting source;
- actual Meta account authorization;
- actual YouTube channel authorization;
- recurring ingestion schedule.

Until those are connected, the Operations Hub is implemented and persistent but external values remain absent rather than simulated.
