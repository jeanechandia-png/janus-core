# START HERE — Janus

Last verified: 2026-10-21
Owner: InfinitySeed Group
Canonical operating identity: `jean.echandia@gmail.com`

## Agent entry protocol (mandatory, any agent: Claude, ChatGPT, Codex…)
1. Run `npm run continuity` (branch, LEGO modules, open-PR stack, ADR collisions, current handoff).
2. Read `docs/PROJECT_MAP.md`, `docs/STATE.md` and `docs/operating-norms.md`.
3. Continue from the previous agent's last commit. Never restart, copy or rebuild what exists.
4. Finish with branch/commit, tests, changes, pending items and a reproducible handoff in `docs/STATE.md`.

## Canonical location
- Repository: `jeanechandia-png/janus-core`
- Default branch: `main`
- This is Janus, a separate assistant architecture. It is NOT Infinity Business Assistant (IBA) and must not be used as an IBA tenant-data store or product fork.

## Cross-project navigation
Canonical InfinitySeed project registry: `jeanechandia-png/infinity-chatbox-platform/INFINITYSEED_PROJECT_REGISTRY.md` on `main`.

## Security / privacy rule
Repository visibility observed 2026-09-17: **public**.

Therefore:
- never commit passwords, API keys, service-role keys, tokens or private credentials;
- never commit personal/private user data or tenant/customer data;
- never copy IBA/ChatBox production secrets here;
- if Janus later requires private operational context, keep that data in an authorised private backend or change repository/access architecture first.

## Mandatory collaborator workflow
1. Verify you are authorised.
2. Read this file and the cross-project registry before work.
3. Verify the active branch/commit/issue or PR before edits.
4. Preserve existing validated functionality; add rather than silently remove.
5. Record exact commit/test/blocker/next-action evidence before ending the session.
