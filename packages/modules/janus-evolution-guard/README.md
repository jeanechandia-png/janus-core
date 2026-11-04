# JANUS Evolution Guard · LEGO reutilizable

## Propósito
Módulo puro, local-first, independiente de IA, APIs, proveedores y credenciales. Anticipa obsolescencia, conserva las lecciones de incidentes y bloquea mejoras que puedan romper JANUS.

## Funciones
- `premortem(observations, at, options)`: 12 riesgos con evidencia y caducidad; desconocido nunca equivale a aprobado. Horizonte inicial 24 meses configurable.
- `postmortem(incident)`: error → causa → impacto → lección → prevención → alternativas → cambio → verificación. Reincidencia crítica y revisión de la protección.
- `proposeUpgrade(input)`: propuesta auditable con retorno seguro, sin ejecutar nada.
- `assessReleaseGate(checks)`: no se puede publicar sin regresión, seguridad, offline, auditoría independiente, rollback y aprobación.

## Consumidor JANUS CORE
`apps/runtime/server.ts` importa el módulo y expone al Founder tres endpoints autenticados: `GET /api/evolution`, `POST /api/evolution/evidence`, `POST /api/evolution/postmortem`. Usa el SQLite ya existente en `packages/core/src/sqlite-store.ts` y `ErrorLedger` del Core: ningún dato sensible dentro del módulo. Una observación que se envía manualmente queda **sin verificar** hasta que una fuente independiente la valide.

## Contrato de seguridad
- No ejecuta descargas ni upgrades, tampoco despliegues silenciosos.
- No envía telemetría.
- Los cambios permanecen en modo propuesta hasta aprobación.
- La falta de pruebas, las pruebas caducadas o las pruebas no independientes no se marcan en verde.

**Pruebas:** `node --import tsx --test tests/evolution-guard.test.ts`; suite completa: `npm run typecheck && npm test`.

Documentación ampliada: `docs/evolution-guard.md`.
