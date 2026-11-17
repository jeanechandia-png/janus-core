# Mapa del proyecto Janus (punto de entrada para cualquier agente)

Snapshot: 2026-10-21. Regenera lo variable con `npm run continuity` (módulos, PR abiertos como pila, colisiones de ADR, handoff vigente).

## Regla de oro
**Continúa donde lo dejó el agente anterior. No crees copias, no reinicies, no rehagas lo que existe.** Antes de escribir código: (1) `npm run continuity`; (2) lee `START_HERE.md` y `docs/STATE.md`; (3) busca en este mapa si la capacidad ya existe; (4) si existe, extiéndela.

## Dónde vive cada cosa
| Qué | Dónde |
|---|---|
| Código (fuente única) | GitHub `jeanechandia-png/janus-core` (público: nunca secretos ni datos personales) |
| Estado vigente y handoffs | `docs/STATE.md`, y el Project «proyecto_janus» de claude.ai (`claude/janus-estado-*.md`) |
| Normas operativas del Founder | `docs/operating-norms.md` + `config/founder-reference-library.json` (políticas `founder-policy:*`) |
| Decisiones de arquitectura | `docs/ADR-*.md` (comprueba el siguiente número libre con `npm run continuity`) |
| Secretos | Entorno / gestor de secretos; plantilla en `.env.example` |
| Memoria local | SQLite del runtime; Drive solo sincroniza/respalda |
| Registro entre proyectos de InfinitySeed | `jeanechandia-png/infinity-chatbox-platform/INFINITYSEED_PROJECT_REGISTRY.md` |

## Qué existe (no lo dupliques)
**Módulos LEGO** (`packages/modules/*`, cada uno con `module.json`; Janus los consume solo por adaptadores en `packages/adapters/`):
`seneca-wisdom`, `marcus-aurelius-wisdom`, `janus-school`, `speaker-id`, `face-id`.

**Núcleo reutilizable** (`packages/core/src/`): `delivery-gate` + `quality-reviewers` + `delivery-pipeline` (filtros → repaso → vista previa → Founder → paquete), `identity-presence` (ADR-008), `speaker-policy` + `identity-fusion` (perfil restringido del hogar), `founder-reference-library`, `continuity-scan`.

**Herramientas de Janus** (Tool Gateway): GitHub, Google Workspace, Asana, Vercel (+release), Netlify (+release), Supabase (+write), Hostinger (+release), n8n, Perplexity, Runway, Kling, Meta/YouTube insights, `seneca`, `marcus-aurelius`, `janus-school`, `likeness` (voz clonada del Founder y voz de Kendra en espera; ADR-012).

**Sin duplicar con ramas de otros agentes** (abiertas, no fusionadas): (PR #39, consentimiento de imagen y clonación de voz, ADR-009/010, ya integrada en la rama `claude/likeness-voice-clone-standby`), PR #36 (panel del Founder y reels de Meta), PR #35/#13 (confianza de ejecución), rama `candidate/voice-identity-module` (verificación de voz 1:1).

## Cómo trabajar sin romper la pila de PR
1. Parte de la rama más reciente de la pila que contenga lo que necesitas (`npm run continuity` la dibuja); si apilas, abre el PR contra esa rama.
2. Un nombre de rama que diga qué haces (`claude/…`, `codex/…`, `chatgpt/…`).
3. Añade, no quitas: la sección visual aprobada de la PWA no se altera sin autorización de Jean.
4. Cierra con: rama/commit, pruebas (`npm run typecheck && npm test`), cambios, pendientes y handoff reproducible en `docs/STATE.md`.
5. Marca cada afirmación como HECHO VERIFICADO / INFERENCIA / RECOMENDACIÓN / POR CONFIRMAR.
