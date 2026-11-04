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

**No alcanzado todavía:** no hay monitor autónomo conectado a producción, consulta automática a fuentes oficiales ni ejecución del ciclo con equipo real. Las funciones son puras y probables offline, pero todavía deben ser integradas al runtime y sus tests.
