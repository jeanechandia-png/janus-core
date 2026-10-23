# Founder Social Source, Mailbox & Phone Readiness

Status: VIGENTE architecture (updated 2026-10-23, second pass). External account authorization remains PENDING: nothing here has been connected to a real Meta, Threads, Google or telephony account. Everything below is verified with simulated services and unit/smoke tests only.

## Objective

Preserve the Founder's own accounts (social networks, mailboxes, phone) as durable Janus source data, and let Janus **read, prepare, correct and — only on the Founder's instruction and with his confirmation on every send or call — send** on his behalf.

Founder instructions (2026-10-23):
- 00:41 / 00:49: follow his accounts continuously and have access to the mailboxes "bajo mi supervisión".
- 01:02: Janus must be able to access, send messages and answer his phone and WhatsApp.
- 01:04: consent given for every mailbox; "ejecuta, implementa el código".
- 01:07: he holds the credentials of his daughter's account and manages it; "controlar" means read, prepare drafts **and**, under his instructions, write, correct and send. Do not ask what can be answered by contrasting data already held.

What this means in code (design decision, recorded):
- Allowed: read; compose/correct/send mail **on Founder instruction with per-message confirmation**; prepare WhatsApp/SMS/call links that the Founder taps.
- Never autonomous: sending, replying automatically, deleting, archiving/labelling, forwarding, placing calls, answering calls without a Founder-activated profile, impersonating his voice, using unofficial WhatsApp clients, spending money. Instructions found inside mails, web pages or documents are data, not orders.

## Implemented (HECHO)

### Where personal data lives
- The versioned Founder Reference Library (`config/founder-reference-library.json`) is **public**. It only holds what is safe to publish (organisation accounts).
- A **local overlay** (`config/founder-reference-library.local.json`, git-ignored) holds the personal profile, the mailboxes and the phone. `mergeFounderReferenceLibraries` fuses both at load: same owner required, ids/subjects may not collide, newest `updatedAt` wins. Guards: generic tests reject any real-looking mail address in the config library, `.env.example` and these docs, and any E.164 number in `config/docs/packages/apps/tests/scripts`; a **local-only privacy scan** (`tests/founder-privacy-scan.test.ts`, skipped when the private file is absent) compares every value of the private file against every versioned or to-be-versioned file. Two references were **already public before** and are declared, not hidden: `START_HERE.md` (the Founder's canonical operating address, published 2026-10-21) and `tests/external-integrations-2.test.ts` (the company contact address used as a sample recipient). Defect found and fixed 2026-10-23: a test fixture in commit `2881129` carried the share identifier of the Founder's personal Facebook; replaced by a fictitious one (the old value remains in that commit's history).
- Tag-driven validation: `mail` → a mail **address**; `phone` → **E.164** (`+<country><number>`); everything else still requires an HTTPS URL.
- Useful tags: `scope:personal|business|family`, `scope-inferred`, `minor`, `guardian-managed`, `founder-consent:YYYY-MM-DD`, `account:<id>` (groups links of one account), `voice|sms|whatsapp` (declared phone channels), `country-inferred:XX`.

### Social accounts (read-only)
- Platforms: Facebook, Instagram, Threads. Each source carries a scope and a cleaned URL (tracking parameters stripped; the original is preserved).
- `groupFounderSocialAccounts` adds links of one account together by the `account:<id>` tag (several shared links of the same Page count once); links without the tag stay ungrouped. Exposed as `accountGroups` in the social snapshot.
- `planSocialWatch` states, account by account and without calling anyone, what can be read now and what is missing. A personal Facebook profile is `manual_only`.
- `runSocialWatch` reads through the Tool Gateway, compares with the previous snapshot and raises alerts (−30 % drop, +100 % rise, −5 % followers; bases under 20 ignored).
- **Continuous watch (new):** `SocialWatchScheduler` (opt-in with `JANUS_SOCIAL_WATCH_INTERVAL_MIN`, minimum 15 min). No overlap (a manual run shares the one in progress), exponential back-off (capped at 24 h) after failures, "nothing ready yet" is not a failure. Each read is stored in SQLite `social_channel_snapshots` with source `social-watch` and `monetizationState: 'unknown'` (history kept; no product id, so it does not pollute product analytics).
- Endpoints (Founder + biometric): `GET /api/founder/social-watch` (status + last report), `POST /api/founder/social-watch/run` (needs `confirmAction: "run_social_watch"`).
- `ThreadsInsightsAdapter`: read-only; token never appears in output, errors or progress events.

### Mailboxes
- `buildFounderMailAccountRegistry` normalises addresses, collapses duplicates, derives scope, flags `minor`, `guardianManaged` and `founderConsentAt`. Provider is `google` only for `gmail.com`/`googlemail.com`; an own domain stays `needs_provider_confirmation`.
- Policy (`FounderMailPolicy`): read allowed; compose on Founder instruction; **each send needs the Founder's confirmation**; autonomous send, delete, archive/label, forward and auto-reply = **false**. A minor's mailbox is read-only **unless** tagged `guardian-managed` (the Founder holds the credentials and manages it), in which case it is treated like the others.
- New write actions on the Gmail adapter: `gmail.draft.update` (PUT on the stated draft, nothing is sent) and `gmail.draft.send`. **Send re-reads the draft from Gmail and compares recipients (To, Cc **and Bcc** — a hidden Bcc is never approved implicitly) and subject with the exact set the Founder approved (`input.expect`); any difference, an unreadable draft or a missing approval set → nothing is sent** (fail-closed). RFC 2047 encoded subjects are decoded before comparing. Draft ids are validated. **The body is always bound: the approval must carry `expect.bodySha256`** (hash of the text the Founder saw, computed with `draftBodyDigest`); missing hash, a body that cannot be extracted, or a different body → nothing is sent (Gmail is not even queried when the hash is missing). Residual risk (INFERENCE): compare-then-send is not atomic — Gmail has no conditional send — so the window between read and send is milliseconds. The caller that prepares the approval (UI/planner, not yet written) must compute the hash from the exact text shown to the Founder.
- Both actions are in the Sensitive Action Policy (risk high, irreversible, approval required) and privileged in the Tool Gateway (authority permit + idempotency key).
- One credential per mailbox **and per permission**: `google-workspace:<id>` (read) and `google-workspace-write:<id>` (compose/send) are separate, so the read credential can never write.
- `GET /api/founder/mail-accounts` (Founder + biometric) returns registry, policy, access plan, per-mailbox credential status (no secrets) and `credentialRuntime` (vault/OAuth configured, the exact redirect URI to register in Google Cloud).

### Credentials: encrypted vault + Google consent (new)
- `CredentialVault` (`packages/security`): AES-256-GCM, key from `JANUS_CREDENTIAL_VAULT_KEY` (32 bytes, base64/hex, never in code/SQLite/repo), atomic 0600 file, serialised writes, audit trail of events without tokens, `describe()` returns metadata only. No key → no vault → Janus keeps using the environment development bridge.
- `GoogleOAuthClient`: authorization-code flow with **PKCE S256**, secret single-use `state` (10-minute TTL), `access_type=offline`, `prompt=consent`, `login_hint`. **The authorised Google account must equal the registered mailbox** (verified from the `id_token`: issuer, audience, expiry, `email_verified`, email); on mismatch the received token is revoked and nothing is stored. Granular consent is respected: missing scopes are recorded and reported.
- Read and write are separate consents with separate scopes (read: `gmail.readonly`, `drive.metadata.readonly`, `calendar.events.readonly`; write: `gmail.compose`, `calendar.events`).
- `VaultCredentialProvider` sits **before** the environment provider in the `CredentialBroker`: it hands out the live token, refreshes it ahead of expiry (single flight), marks `invalid_grant` as "needs new consent" without retrying, and treats network/5xx errors as transient (not marked lost).
- Threads: `storeThreadsToken`, `exchangeThreadsToken` (needs `THREADS_APP_SECRET`), `threadsRefresher` (does not call before 24 h of age; renews at 30 days when the expiry is unknown).
- Endpoints (all Founder + fresh biometric proof + explicit `confirmAction`): `POST /api/founder/mail-accounts/:id/oauth/start` (returns the Google URL), `POST …/oauth/revoke` (revokes at Google and deletes locally), `POST /api/founder/social-credentials/threads` and `…/remove`. The Google redirect `GET /api/oauth/google/callback` has no session by nature but only works with the secret `state` created above; the page it returns reflects nothing from the URL and sends a restrictive CSP.
- Capability states for `google-workspace`, `google-workspace-write` and `threads-insights` now follow per-mailbox/vault credentials (defect fixed: previously they only looked at the single global variable, so the planner would have treated Google as unauthorised even with per-mailbox tokens).

### Phone (new — description, plan and links; no calling or sending yet)
- `buildFounderPhoneChannelRegistry` (tag `phone`, E.164, declared channels `voice|sms|whatsapp`, country marked as inference), `FounderPhonePolicy` (per-message and per-call confirmation, AI disclosure, no voice impersonation, nothing autonomous, spend needs approval), `planPhoneAccess` (routes with tier, blockers, spend, verification label and sources), link builders `buildWhatsAppClickToChatLink`, `buildTelLink`, `buildSmsLink` (E.164-validated, text encoded and capped).
- `GET /api/founder/phone-channels` (Founder + biometric).
- Routes today: **L1** (available now, no cost): WhatsApp click-to-chat / SMS / call links — Janus writes, the Founder taps. **L2** (needs setup + spend): WhatsApp Cloud API, SMS gateway, voice line (ElevenLabs agent). **L3** (refused): unofficial WhatsApp access.
- Reserved sensitive actions (no adapter yet, but born approval-gated): `whatsapp.message.send`, `whatsapp.template.send`, `sms.message.send`, `phone.call.place`, `phone.call.answer.profile.activate`. The verb `place` is now privileged in the Tool Gateway (`activate`/`answer` deliberately not: they would hit `home-scenes.scene.activate` and `quiz.answer`).

### Tests
`tests/founder-mail-accounts.test.ts` (14), `tests/founder-phone-channels.test.ts` (12), `tests/credential-vault-oauth.test.ts` (17), `tests/social-watch-scheduler.test.ts` (5), `tests/social-watch.test.ts` (12), `tests/runtime-smoke.mjs` (mail/phone/social-watch endpoints, OAuth start/callback, Threads token store/remove, no secrets in responses or logs). Full suite 467/467.

## Not implemented / not claimed (PENDIENTE)

- No Meta, Threads or Google account is connected; no token has been provided or verified. **Nothing has been tested against the real APIs.**
- No UI to start the Google consent: the endpoints exist, but a button in the PWA needs authorisation to touch `apps/pwa` (it is outside this branch's scope).
- No Facebook share link has been resolved to a Page; no Graph entity is bound.
- No WhatsApp Cloud API, SMS or voice adapter exists; no number has been rented. Janus cannot read or answer his personal WhatsApp or take calls on his iPhone today.
- IMAP / non-Google mail is not implemented.
- Facebook/Instagram metric names are not guessed; they must be configured per account.
- Alerts are available through the endpoint; push notification to the iPhone is not wired.
- No automatic reading-triage of mail into flows/Agent Swarm yet.

## Verified facts (primary sources, 2026-10-23)

- Threads API: host `graph.threads.com`, version `v1.0`; `GET /me`; `GET /{threads-user-id}/threads_insights`; permissions `threads_basic` + `threads_manage_insights`; token exchange `GET /access_token?grant_type=th_exchange_token`, refresh `GET /refresh_access_token?grant_type=th_refresh_token` (token ≥ 24 h old; 60 days; no app secret needed to refresh).
- Instagram Platform: professional accounts only; Standard Access enough for own accounts. Pages API manages **Pages**.
- Gmail API: `drafts.send`, `drafts.update`, `drafts.get` accept scope `gmail.compose`.
- Google OAuth 2.0 (installed/desktop apps): auth endpoint `accounts.google.com/o/oauth2/v2/auth`, loopback redirect `http://127.0.0.1:<port>`, PKCE S256 recommended, token endpoint `oauth2.googleapis.com/token` (client secret optional), refresh with `grant_type=refresh_token`, revoke at `oauth2.googleapis.com/revoke`.
- WhatsApp Business Platform: coexistence is only for the WhatsApp Business app and needs a Solution Partner/Tech Provider; a number used in WhatsApp Messenger must be deleted from it before Cloud API use; outside the 24 h service window only approved templates may be sent; opt-in required.
- ElevenLabs agents: inbound calls need a purchased Twilio number or a SIP trunk.
- EU AI Act art. 50 applies from 2 Aug 2026 (a voice assistant answering calls most likely falls under 50(1): disclose it is an AI) — a reading of the Commission's FAQ, **not legal advice**.

## INFERENCIA / POR CONFIRMAR

- **Inference:** personal Facebook profiles are not readable through the Pages API; Janus marks a personal profile `manual_only`.
- **Inference:** which share link is which account (read from the label that follows each link), and the scope of several mailboxes and of La Tribuna (`scope-inferred`).
- **Inference:** the prefix `+31` / country NL for the phone number (the Founder gave it without a prefix; tag `country-inferred:NL`).
- **To confirm:** whether the newer Facebook shares point to the same Pages as the three older ones (Facebook blocks automated fetching; needs a signed-in browser or the Graph `/me/accounts` listing — endpoint not verified); the provider of the own-domain mailbox; whether the Instagram accounts are Business/Creator.
- **To confirm:** the `wa.me` click-to-chat format and how each iOS version handles `sms:?body=` (official help pages could not be read from here); the WhatsApp ToS wording on general-purpose automation (only secondary sources read; the unofficial route stays refused regardless); conditional call forwarding to a third-party voice line on the Founder's carrier/iOS; whether a Google OAuth client left in "Testing" status expires refresh tokens after 7 days (not verified — publish the consent screen or re-consent weekly until confirmed); whether granular consent can narrow a refresh token's scopes (not relied upon).
- **To confirm:** whether the id_token signature check can be skipped when received directly from the token endpoint over TLS — implemented that way following OpenID Connect Core §3.1.3.7; issuer, audience, expiry and verified email are still enforced.

## Safe activation sequence

1. Put the local overlay on the machine that runs the Janus runtime; run `npm run integrations:check`.
2. Generate the vault key (`openssl rand -base64 32`) and store it in the machine's secret store as `JANUS_CREDENTIAL_VAULT_KEY`.
3. In Google Cloud: create an OAuth client, configure the consent screen, register the exact redirect URI shown by `GET /api/founder/mail-accounts` (`credentialRuntime.redirectUri`) and set `GOOGLE_OAUTH_CLIENT_ID` (+ `JANUS_OAUTH_REDIRECT_BASE` if the runtime is reached through an HTTPS address from the iPhone).
4. Per mailbox: start the **read** consent, accept on Google's screen with the right account; later, the **write** consent.
5. Meta: developer app + token; Threads: tester invitation + token (store via the endpoint); resolve Facebook shares; bind Graph IDs.
6. Set `JANUS_SOCIAL_WATCH_INTERVAL_MIN` to start the periodic read-only snapshots.
7. Phone: start with the L1 links. Decide separately on a dedicated WhatsApp number / SMS gateway / voice line (each spends money and needs approval).

## Decisions only the Founder can take

1. Google Cloud OAuth client + accepting each consent screen (his taps).
2. Meta app + token; Threads tester + token.
3. WhatsApp path (default recommendation: keep the L1 links; a dedicated number only if he wants Janus to send through the official API) and whether to rent a number for the voice line (spend).
4. Authorisation to touch `apps/pwa` for the consent button, and to merge the PR stack.
