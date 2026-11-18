# START HERE — Janus

## CONTINUACIÓN VIGENTE — 18 noviembre 2026

**Ampliación posterior vigente:** revisar primero el bloque nuevo de STATE y `config/historical-contracts.json`: 538 contratos definidos (454 + N32 + B32 + SF20). Corregidos B25–B32 mal descritos y omisiones B01–B24/SF. Inventario documental no es implementación: completar correspondencia individual y código. La ausencia de chats íntegros limita cobertura exhaustiva, pero no bloquea implementar las fuentes accesibles. B26/B27 ya conectados al radar y probados; las otras 536 entradas no deben darse por ausentes ni terminadas por una coincidencia de familia.

Retomar la PR #83 y la rama **existente** `chatgpt/janus-voice-evolution-hardening-20261117` mientras esté abierta; comprobar su HEAD remoto. No crear una rama ni otro checkout para eludir la continuidad. Ejecutar `npm run instructions:audit`, leer `docs/INSTRUCTION_AUDIT.md` y el primer bloque actual de `docs/STATE.md`. Tablet, voces Jean/Melanie y auditoría de `proyecto_Janus` / `proyecto_Janus 2` son el mismo trabajo acumulativo. La revisión no acredita aún implementación de todos los contratos históricos ni instalación física; no afirmar que solo faltan robots/criaturas.

## ESTADO VIGENTE — 17 de noviembre de 2026
**Producto único:** `jeanechandia-png/janus-core`, evolución desde el SHA actual de `origin/main` (NO desde una PR histórica, prototipo aislado, ZIP ni copia de otro agente).
**PR #82 Claude + PR #81 Core/Kendra: fusionadas en main** (fusión de referencia `2fe56e06946a0747fef8074cf21c466ee70da7e3`). No todas las PR históricas están incorporadas: lista de pendientes, normas de verificación, voz y GLB en `docs/handoffs/2026-11-17-janus-main-unified.md`.
**Objetivo transversal vigente:** JANUS debe poder **por voz o texto y con archivos adjuntos** actualizar por sí mismo las criaturas y robots, dashboards, webs, landings y productos autorizados del ecosistema, sobre sus repositorios reales (sin duplicar el producto). Consultar `docs/VOICE_DRIVEN_PRODUCT_EVOLUTION_CONTRACT.md` y Norma 10 de `docs/operating-norms.md`. La recepción/planificación/publicación de extremo a extremo sigue POR VERIFICAR: no anunciarla como terminada.
**Preflight obligatorio antes de modificar:** sincronizar y proteger el trabajo local de otros agentes, revisar `npm run continuity`, crear una rama de trabajo dentro del MISMO repositorio desde el `origin/main` más reciente y ejecutar `npm run continuity:guard`. Este guard bloquea edición directa de main a propósito. Finalizar cada ciclo con pruebas, commit, reconciliación y handoff; nunca reconstruir lo validado.


Previous snapshot: 2026-10-21 (histórico; prevalece ESTADO VIGENTE)
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
