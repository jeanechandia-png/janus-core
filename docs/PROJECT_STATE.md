# JANUS — PROJECT_STATE (vigente para esta rama)

**Fecha:** 2026-11-06 (Europe/Amsterdam)  
**Responsable del registro:** ChatGPT, continuidad operativa InfinitySeed Group  
**Objetivo empresarial:** asistente personal y profesional independiente, reusable, local-first, seguro y progresivamente autónomo.  
**Objetivo técnico P1:** entregar las dashboards de Jean y Kendra y los flujos principales listos para un piloto comprobado.

## AHORA
Se trabaja sobre la **rama apilada** `chatgpt/janus-pilot-readiness-gate-20261106`, derivada de la rama del control de continuidad PR #76 (`d5155beb778a0aab92ebdd9e354970f073fc261f`).  
Repositorio canónico: https://github.com/jeanechandia-png/janus-core  
`main` confirmado en el momento de recuperación: `7ddfe245f15ec53438c2db98dbb7b137420ebcf9` (revalidar; no asumir inmutable).  
PR de este trabajo: https://github.com/jeanechandia-png/janus-core/pull/78

## HECHO
- Nuevo módulo de evaluación del piloto de 14 filtros + 8 criterios y CLI local sin proveedores externos.
- Registro de evidencia `docs/PILOT_READINESS.json` con `NOT_RUN` para las pruebas pendientes (sin verdades inventadas).
- Pruebas para omisiones, privacidad, E2E, incongruencia de SHA y falsa evidencia PASS.
- `npm test` incluye estas pruebas; GitHub Actions valida el registro.
- Protocolo universal condensado y handoff enlazados desde `START_HERE.md` y `docs/PROJECT_MAP.md`.
- **GitHub Actions PASS** en la primera revisión de código `f8c011fcb035ef3d40e063f447871e5092853cca` y en la revisión con enlaces de entrada `898fd35e880e5ea59cf7efa91ff20b83a1374971` (Typecheck, PWA syntax, Node Tests, pilot record validation, runtime smoke).

## PENDIENTE
- **P1 integración real:** reconciliar la pila visual/infantil `#43→#53→#63→#67→#69→#70→#71→#75` con ramas paralelas de identidad, idioma y voz. No hacer merge automático ni sustituir activos aprobados.
- **P1 aceptación:** probar las dos dashboards con perfiles separados, controles funcionales, voz compartida, cámara/permisos, persistencia, privacidad y Safari/iPhone real; documentar cada evidencia.
- **P1 despliegue:** verificar versión efectivamente publicada, SHA, URL y acceso de usuarios autorizados antes de declarar listo.
- **P2 visual/voz:** completar GLB interactivos aprobados y voz realmente caricaturesca sin timbre humano; las aproximaciones Web Speech y figuras 2D no cierran este criterio.

## BLOQUEADO
No se puede acreditar el piloto completo sin comprobar la pila integrada en dispositivo real y contar con la aprobación correspondiente. Estado de producción no verificado en esta ejecución.

## PRÓXIMO
Revisar PR y dependencias en GitHub, comparar diffs con base actual, establecer rama de integración con autorización cuando proceda; ejecutar `npm run pilot:gate` para listar evidencias faltantes. `REVIEW_REQUIRED` es solicitud de revisión, **nunca publicación automática**.

## TRAZABILIDAD
- Registro: `docs/PILOT_READINESS.json`.
- Informe de ramas: `docs/CONTINUITY_AUDIT_2026-11-06.md`.
- Último handoff: `docs/AGENT_HANDOFF.md`.
- Política: `docs/UNIVERSAL_CONTINUITY_PROTOCOL.md`.
- La versión anterior de `docs/STATE.md` se conserva completa como histórico y base de conocimiento; no fue sustituida ni borrada.
