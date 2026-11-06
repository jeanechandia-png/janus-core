# START HERE — Janus

Last repository baseline verified: main 7ddfe245f15ec53438c2db98dbb7b137420ebcf9 (2026-11-06 audit; subsequent commits require revalidation)
Owner: InfinitySeed Group
Canonical operating identity: `jean.echandia@gmail.com`

## Checkout security gate (2026-11-06)

Before any code change, run `npm run continuity:guard` on a named working branch in **this repository**. For a stacked PR, run `npm run continuity:guard -- --base=<actual-parent-branch>` after identifying its current parent from GitHub. Exit code 2 means **stop changes**: wrong repo, detached/direct-main checkout, stale branch or unknown remote state. `--offline` permits local work only; do not push, merge or deploy until an online revalidation passes. The preflight does **not** merge other agents' work and is not proof of product completeness.

See `docs/CONTINUITY_AUDIT_2026-11-06.md` for the initial audited divergence registry (snapshot, not real-time).

## Protocolo universal y control del piloto (2026-11-06)

Antes de afirmar que JANUS está preparado para el piloto, consulta `docs/UNIVERSAL_CONTINUITY_PROTOCOL.md`, la última transferencia `docs/AGENT_HANDOFF.md` y el registro `docs/PILOT_READINESS.json`.
Ejecuta `npm run pilot:validate` (integridad estructural del registro), `npm run pilot:gate` (pendientes y bloqueos) y, al proponer publicación, `npm run pilot:gate -- --require-review-ready`. Incluso `REVIEW_REQUIRED` exige verificación independiente de dispositivos, seguridad, E2E y despliegue; no significa aprobado ni publicado.
Las comprobaciones `NOT_RUN` no se promueven mediante afirmaciones de otros agentes sin resultados rastreables. Las ramas visuales/voz #75/#65/#68 siguen separadas: revisar su línea base antes de integrar.

## Agent entry protocol (mandatory, any agent: Claude, ChatGPT, Codex…)
1. Run `npm run continuity` and `npm run continuity:guard` with the active stack parent via `--base=...` when appropriate; stop on a failed gate.
2. Read **current** `docs/PROJECT_STATE.md` and `docs/AGENT_HANDOFF.md`, then `docs/PROJECT_MAP.md`, historical `docs/STATE.md` and `docs/operating-norms.md`.
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
