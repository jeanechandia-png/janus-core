# JANUS EVOLUTION GUARD — Premortem y Postmortem permanente

**Decisión del Founder (2026-11-04):** evitar que JANUS se vuelva obsoleto en años. Está diseñado para evolucionar sin perder memoria, autonomía, privacidad, verificación ni control humano.

## Qué ejecuta el módulo

- **Premortem (horizonte inicial 24 meses, configurable):** 12 mecanismos plausibles de obsolescencia — sustitución de modelos y voz, uso offline, restauración SQLite, portabilidad, dependencias y permisos, contratos externos, presupuesto, regresiones, dispositivos y valor real — evaluados con evidencia medible, fuente y fecha.
- **Postmortem por incidente:** ERROR → CAUSA → IMPACTO → LECCIÓN → REGLA PREVENTIVA → SOLUCIONES → CAMBIO → VERIFICACIÓN. La reincidencia obliga a revisar por qué falló el control previo y eleva la severidad.
- **Ciclo de mejora:** OBSERVAR → COMPARAR → PROPONER → PROBAR EN PARALELO → REVISAR → APROBAR → PUBLICAR → MEDIR → conservar/rollback. El último bloque de decisión siempre es del Founder.
- **Cero verdades inventadas:** cualquier evaluación sin prueba, expirada o no verificada es `unknown` y se presenta como tal, nunca como aprobada.

## Contrato LEGO

`premortem(observations, timestamp)` → `{ status, findings, priority, counts, requiresApprovalForChanges }`.

`postmortem(incident)` → `{ recurrenceCount, severity, requiresProtectionReview, resolved, action }`.

`proposeUpgrade(input)` crea una **propuesta**, no instala nada.

`assessReleaseGate({ regressionPass, securityPass, offlinePass, independentReviewPass, rollbackReady, founderApproved })` solo permite promover cuando **todos** los checks son verdaderos.

## Integración con Janus Core

El módulo no posee red, dinero, secretos ni memoria propia. El runtime de JANUS CORE deberá registrar cada observación y postmortem en SQLite, con hash, fuente y estado de evidencia, y utilizar el ApprovalQueue existente. Cuando no hay Internet, las observaciones locales siguen disponibles; las comprobaciones externas se revalidan al reconectar, sin ejecutar acciones externas pendientes automáticamente.

Cadencia recomendada como **política versionada**, no como servicio contratado: señales locales con cada build, revisión de proveedores y vulnerabilidades semanal, simulación de sustitución de proveedor mensual, prueba de restauración trimestral, análisis de valor cada trimestre y revisión estratégica de 24 meses continuamente actualizada. La cadencia y ventanas de evidencia del código son configurables; cada observación tiene timestamp.

## Runtime operativo (endpoints protegidos)

La rama integra el módulo con el SQLite existente, sin inventar un almacén paralelo:

- `GET /api/evolution` — Founder autenticado; muestra 12 riesgos, evidencia, vencimiento y reincidencias. Sin evidencias verificadas no presenta salud falsa.
- `POST /api/evolution/evidence` — aporta una observación local con referencia y sello temporal. Se guarda como **no verificada** hasta pasar revisión independiente; nunca convierte automáticamente el resultado en verde.
- `POST /api/evolution/postmortem` — guarda causa/impacto/lección/control/cambio/verificación + evidencias; `fingerprint` en `error_lessons` y registro cronológico en SQLite. El mismo ID repetido es idempotente; otra incidencia con igual huella aumenta prioridad.
- `/health` anuncia la capacidad. Todas las escrituras requieren sesión del Founder y ninguna ejecuta herramientas externas.

**Pendiente explícito:** alimentar automáticamente las 12 pruebas desde CI, comprobaciones oficiales y el dispositivo físico; programar una cadencia local con revalidación después de offline y revisar los resultados en un panel. Los endpoints están conectados al runtime, pero no se ha desplegado ni verificado en el Samsung/iPhone real.
