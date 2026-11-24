# JANUS — Biblioteca de personajes 3D y guía Hyper3D · 24 noviembre 2026

Rama `claude/biblioteca-3d-hyper3d` desde `origin/main` 44f1c6c5832650cc7afc528b0ed465e416b01aa8. Repositorio único `jeanechandia-png/janus-core`.

## Qué se pidió y qué quedó
El Founder pidió instrucciones para generar en Hyper3D Rodin las cuatro criaturas de Kendra (Lumi, Bombo, Musgo, Nimbo) y los dos robots Nexo (Janus y Melanie), y poder anexarlas a Janus, a la dashboard de Kendra y a la suya. Se evolucionó lo existente (`JanusCreatureSlot`, `janus-3d-forge`, `approved-presence`); no se tocaron las dashboards aprobadas ni se reemplazó ningún diseño.

## Cambios
- Nuevo módulo `packages/modules/character-library` (independiente; inspector inyectado). 8+1 pruebas en `tests/character-library.test.ts`.
- `apps/runtime/server.ts`: biblioteca (carpeta `characters/` junto a la base de datos, o `JANUS_CHARACTERS_DIR`) y rutas del Founder. `apps/runtime/kid-routes.ts`: rutas de lectura de la niña, solo aprobados. `tests/character-routes.test.ts` (servidor real, autenticación, aprobación, aislamiento del token de la niña).
- PWA: `character-sync.js` nuevo; `approved-presence.js` (sincronización en segundo plano, aviso solo si no está aprobado, `openApprovedStageDialog`); `app.js`, `dashboard-access.js`, `kendra.js` (una línea de configuración cada uno); `sw.js` v28; CSS del panel. `tests/character-sync.test.ts` (sincronización con huella, retirada, offline, sin sesión).
- Docs: `docs/HYPER3D_RODIN_PLAYBOOK.md`, nota en `docs/janus-3d-forge.md`, bloque AHORA en `docs/STATE.md`.

## Verificación (hecho)
`npm run dashboard:build` y `npm test`: 908 pruebas, 907 PASS, 0 FAIL, 1 SKIP. `npx tsc --noEmit` limpio. `npm run continuity:guard`: READY. Sin esa compilación previa fallan 2 pruebas de entorno ya existentes (`approval-chip`, `team-panel`), que leen `prototypes/dashboard/dist`.

## Decisiones reversibles (informadas al Founder)
1. Figuras fijas («parcial») admitidas en la biblioteca y aprobadas por el Founder; Rodin no entrega esqueleto. La importación manual antigua conserva la compuerta estricta.
2. Kendra solo recibe modelos aprobados; si se rechaza después, se retira de su tablet al sincronizar.

## Pendiente y bloqueado
- **BLOQUEADO (externo):** los 6 GLB los genera el Founder en Rodin con sus créditos; el navegador del Founder no estaba conectado a esta sesión.
- POR CONFIRMAR: licencia comercial de lo generado (plan gratuito y de pago); qué cubre «Free Preview»; precio del rigging (`hyper3d/rigging` vía fal.ai).
- Rig, expresiones y animaciones: paso aparte y de pago; decide el Founder (Norma 7).
- Prueba en iPhone real y en la tablet de Kendra; auditoría de subidas en el registro del Core.

## Cómo reproducir
```bash
git checkout claude/biblioteca-3d-hyper3d && npm ci
npm run dashboard:build && npm test
node --import tsx --test tests/character-library.test.ts tests/character-routes.test.ts tests/character-sync.test.ts
```
Prueba manual: arrancar el servidor, entrar como Founder, subir un `.glb` válido en el panel, comprobar el aviso «pendiente», aprobar y abrir `/kendra` en un dispositivo emparejado.

## Protocolo del siguiente agente
1. `npm run continuity` y `continuity:guard`; partir del último `origin/main`.
2. No subir GLB ni referencias al repositorio público. Ningún output de Hyper3D se usa para entrenar.
3. Cualquier gasto (créditos, suscripción, rigging) lo aprueba y paga el Founder.
