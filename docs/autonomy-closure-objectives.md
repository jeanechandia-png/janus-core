# Autonomía continua, cierre obligatorio y objetivos múltiples (2026-10-21)

Origen: «Super Meta-Prompt de desarrollo incremental» del Founder. Regla: **sumar, nunca restar**. Este documento mapea cada requisito contra el código real.

| Req. | Estado | Evidencia |
| --- | --- | --- |
| 1 Continuidad / fuente de verdad central | **YA EXISTÍA** (no se duplicó) | `continuity.ts` (cronología + Error Ledger + `resumeFrom`), `project-context.ts` (checkpoints con checksum), `operator-coordination.ts` (handoffs), SQLite local como fuente de verdad; el runtime inyecta la continuidad en el planner antes de actuar (`apps/runtime/server.ts`). |
| 2 Bucle autónomo y umbral de interrupción | **AÑADIDO** | `packages/core/src/autonomy-policy.ts`: `evaluateAutonomy`, `runAutonomousPipeline` (Diagnóstico→Conclusiones→Plan→Ejecución). Un diagnóstico con hallazgos y sin plan se marca `passiveDiagnosisViolation`. |
| 3 Orquestador y conexión multiplataforma | **YA EXISTÍA** | `packages/orchestrator/src/agent-swarm.ts`, `operator-coordination.ts`, adaptadores en `packages/adapters/src/*` (docs/integrations.md). |
| 4 Activos reutilizables y objetivos múltiples | **AÑADIDO** (parte) | `packages/core/src/content-objectives.ts`: `checkContentObjectives` (valor al cliente, InfinitySeed Group, producto principal, socio en rotación), `selectRotatingPartner`, `buildObjectivePromptBlock`, `packageSaasAsset` (manifiesto versionado con checksum). La biblioteca LEGO ya existía (`reusable-library.ts`). |
| 5 Cierre y resumen ejecutivo | **AÑADIDO** | `packages/core/src/closure-report.ts`; hook `persistClosureReport` en `finishRun` (cronología local, idempotente, nunca bloquea el run); `GET /api/runs/:runId/closure`. |

## Decisión de diseño que el Founder debe conocer
El requisito 2 limita las interrupciones a tres casos (cambio estructural de arquitectura/BD, eliminación definitiva de un módulo principal, cambio de imagen de marca). Las escrituras externas y los gastos de créditos **siguen** pasando por la cola de Aprobaciones del Founder (ADR/política de acciones sensibles, ya vigente). Para no contradecir «no detenerse», esos pasos se **aparcan** y la ejecución continúa con lo independiente (`queue_approval`). No se relajó ninguna aprobación existente.

## Alcance honesto
- HECHO VERIFICADO: módulos, pruebas unitarias, hook de cierre y endpoint probados de punta a punta en `tests/runtime-smoke.mjs` (con control negativo: sin el hook, la aserción falla).
- PENDIENTE: conectar `runAutonomousPipeline` al planner/TaskRunner (hoy es una pieza reutilizable probada, no el camino por defecto); conectar `checkContentObjectives` a los flujos de reels/marketing (#36) y a las puertas de entrega; las listas de socios y marcadores (`RotatingPartner`) deben definirse por el Founder.
- Sin cambios de esquema de base de datos ni de la capa visual.
