# Founder Social Source & Mailbox Readiness

Status: VIGENTE architecture (updated 2026-10-23). External account authorization remains PENDING: nothing here has been connected to a real Meta, Threads or Google account.

## Objective

Preserve the Founder's own accounts (social networks and mailboxes) as durable Janus source data, and give Janus a **read-only, continuously plannable** view of them under the Founder's supervision. Reading and preparing drafts are allowed; publishing, replying, sending, deleting, archiving, forwarding, messaging, campaigns and spend are **disabled** and would be a separate approval-gated capability.

Founder instruction (2026-10-23): Janus must be able to control and continuously follow these accounts, and have access to the mailboxes "bajo mi supervisión". This document records how far that is true today and what is missing. The Founder decides whether "control" later includes acting (see *Decisions for the Founder*).

## Implemented (HECHO)

### Where personal data lives
- The versioned Founder Reference Library (`config/founder-reference-library.json`) is **public**. It only holds what is safe to publish (organisation accounts).
- A **local overlay** (`config/founder-reference-library.local.json`, git-ignored) holds the personal profile and the mailboxes. `mergeFounderReferenceLibraries` fuses both at load: same owner required, ids/subjects may not collide, newest `updatedAt` wins. A test asserts that no mailbox address appears in tracked files.
- A reference tagged `mail` stores a mail **address**, validated as such. Every other reference still requires an HTTPS URL. (Defect fixed 2026-10-23: the parser previously rejected mailboxes outright, which would have stopped the runtime from loading the overlay.)

### Social accounts (read-only)
- Platforms: Facebook, Instagram, **Threads** (new). Each source carries a scope (`personal` / `business` / unknown) and a cleaned URL.
- Facebook share links stay *unresolved* until an authoritative canonical target is recorded; Graph IDs cannot be bound before that.
- `planSocialWatch` states, account by account and without calling anyone, what can be read now and what is missing (`ready`, `needs_canonical_target`, `needs_graph_binding`, `needs_auth`, `needs_metrics`, `adapter_missing`, `manual_only`). A personal Facebook profile is `manual_only` (see *Verified facts*).
- `runSocialWatch` reads through the Tool Gateway, flattens insights, compares with the previous snapshot and raises alerts (default: −30 % drop, +100 % rise, −5 % followers; ignores bases under 20). Snapshots are **injected**: persistence in SQLite is not built yet.
- `ThreadsInsightsAdapter`: `threads.account.profile`, `threads.account.insights`; read-only; token never appears in output, errors or progress events.
- `GET /api/founder/social-sources` (Founder + biometric) returns registry, status and the watch plan; it performs no external request. Binding (`POST …/bind`) needs a fresh biometric proof, explicit confirmation and evidence.

### Mailboxes (read + approved drafts)
- `buildFounderMailAccountRegistry` normalises addresses, collapses duplicates (the same mailbox given twice is one), derives `scope` (`personal` / `business` / `family`) from tags and flags `minor` accounts.
- Provider is `google` **only** for `gmail.com` / `googlemail.com`. Any own domain is `unknown` and stays in `needs_provider_confirmation` until the Founder confirms it is Google Workspace.
- Policy (`FounderMailPolicy`): supervision = Founder; read allowed; drafts require Founder approval; send, delete, archive/label, forward and auto-reply = **false**; cross-scope sharing = Founder only; minors = read-only, no drafts.
- One credential per mailbox through the `CredentialBroker`: service `google-workspace:<id>` → `GOOGLE_ACCESS_TOKEN__<ID>`; `google-workspace-write:<id>` → `GOOGLE_WRITE_ACCESS_TOKEN__<ID>`.
- Google adapters accept `input.account`, but only ids registered in `allowedAccounts`; unknown or unauthenticated accounts are refused **before** any network call. The write adapter refuses minors. Without `account`, behaviour is unchanged.
- `GET /api/founder/mail-accounts` (Founder + biometric) returns registry, policy and an access plan; `automaticExternalCalls: false`.
- `npm run integrations:check` lists, per mailbox, which variable *names* are missing. It never prints an address or a value.

### Tests
`tests/social-watch.test.ts` (12), `tests/founder-mail-accounts.test.ts` (9: registry, policy, parser, chronology wording, access plan, public-repo leak guard, multi-account read/write adapters), and `tests/runtime-smoke.mjs` (anonymous/without-biometric/with-biometric access to the mail endpoint, Threads capability state `needs_auth`, no secrets in the response).

## Not implemented / not claimed (PENDIENTE)

- No Meta, Threads or Google account is connected; no token has been provided or verified. A configured token is treated as configured, not as a verified connection.
- No Facebook share link has been resolved to a Page; no Graph entity is bound.
- **No continuous monitoring runs.** There is no scheduler or process that executes `runSocialWatch`; snapshots are not stored in SQLite.
- No OAuth flow or refresh-token store: credentials come from environment variables (development bridge). Threads tokens last 60 days and must be refreshed; Google access tokens expire in about an hour. A secure provider with refresh is required before this is usable day to day.
- IMAP / non-Google mail is not implemented.
- Facebook/Instagram metric names are not guessed; they must be configured per account.
- No publish, reply, send, delete, archive, forward, message, campaign or spend capability exists.

## Verified facts (primary sources, 2026-10-23)

- Threads API: host `graph.threads.com`, version `v1.0`; `GET /me`; `GET /{threads-user-id}/threads_insights`; permissions `threads_basic` + `threads_manage_insights`; user metrics `views, likes, replies, reposts, quotes, clicks, followers_count, follower_demographics`; token as `access_token`; long-lived tokens 60 days and refreshable; insights read the authenticated user's own account.
- Instagram Platform: professional (Business/Creator) accounts only; Standard Access is enough for accounts you own; Instagram Login needs no Facebook Page, Facebook Login does.
- Pages API manages **Pages**.

## INFERENCIA / POR CONFIRMAR

- **Inference:** personal Facebook profiles are not readable through the Pages API (the documentation does not mention profiles). Janus therefore marks a personal profile `manual_only`. If an item is in fact a Page, change its scope.
- **Inference:** which Facebook share link corresponds to which account was read from the label that *follows* each link in the Founder's message.
- **Inference:** the scope of several mailboxes and of La Tribuna (tagged `scope-inferred`).
- **To confirm:** whether the newer Facebook shares duplicate the three already preserved; the provider of the own-domain mailbox; how a minor's mailbox can be authorised (a supervised/Family Link account may not allow third-party OAuth — not verified); whether the Instagram accounts are Business/Creator.

## Safe activation sequence

1. Place the local overlay on the machine that runs the Janus runtime and run `npm run integrations:check`.
2. Resolve each Facebook share against an authoritative identity while preserving the original URL, then record it with evidence (biometric-gated).
3. Authorise least-privilege read access per account (Meta app with Standard Access for own accounts; Threads tester invitation + token; Google OAuth consent per mailbox with read-only scopes, drafts separately). Never persist tokens in SQLite, source control or the reference library.
4. Bind verified Graph IDs; revalidate before every productive read.
5. Only then schedule read-only snapshots (persisted in SQLite with provenance and timestamps) and enable alerts.

## Decisions for the Founder

1. Which Facebook share is which account, and are the newer ones the same pages as the older three?
2. The scope of La Tribuna, the AI-project mailbox and the personal mailbox.
3. The provider of the own-domain mailbox.
4. How the minor's mailbox should be handled (and whether it should be monitored at all).
5. Whether "control" must eventually include acting (reply, publish, send). That would be a separate capability with per-action approval and its own audit trail; this document does not grant it.

Mutation capabilities, if ever needed, must be designed as a separate approval-gated capability and must not inherit authorization from this read-only registry.
