# JANUS — Estado vigente

Fecha: 2026-09-30

## AHORA

**M1/M2 — Super-Agent Decision Loop + Flow Automation Engine + Continuidad + Ejecución observable**

Integrar la nueva capa de Super-Agent en la ruta productiva completa: continuidad vigente -> Decision Blueprint -> Work Graph -> Agent Swarm -> Model/Tool Gateway -> guardrails/aprobación -> ejecución -> Delivery Gate -> Decision Receipt -> outcome -> calibración/drift -> propuesta de mejora.

La mejora autónoma es controlada: Janus puede detectar, aprender y proponer, pero no modificar silenciosamente producción. La nueva capa de automatización convierte workflows deterministas y agentic workflows en una misma arquitectura Janus.

## HECHO

- **Administrative Authority Control Plane (ADR-005)**:
  - Founder/Director autenticado como máxima autoridad humana de Janus;
  - identidad mediante principal interno estable, sin usar datos biográficos como secreto;
  - documentos/web/emails/modelos/agentes/herramientas tratados como DATA sin autoridad administrativa;
  - autenticación obligatoria para instrucciones privilegiadas;
  - confirmación explícita para operaciones root destructivas o cambios de autoridad;
  - decisiones de autoridad con hash SHA-256 auditable;
  - secretos reservados a Keychain/secure store.
  - TaskRunner evalúa autoridad antes de toda acción privilegiada;
  - `authority.evaluated` deja decisión, causa y hash en el event/audit stream;
  - Tool Gateway bloquea mutaciones sin idempotency key y permiso de autoridad auditado;
  - planes compilados y Automation Engine heredan la misma frontera de autoridad;
  - runtime expone estado fail-closed: lecturas permitidas, mutaciones no autenticadas bloqueadas;
  - autoridad válida y aprobación humana permanecen como controles separados.
  - **Autenticación local fuerte (ADR-006)**:
    - challenge-response ECDSA P-256 de un solo uso;
    - claves privadas fuera de Janus; SQLite guarda solo claves públicas y metadatos no secretos;
    - sesiones bearer efímeras, almacenadas solo como hash SHA-256 en memoria;
    - bootstrap de Founder con mismatch fail-closed;
    - delegación/revocación de administradores exclusiva del Founder;
    - revocación invalida inmediatamente sesiones del administrador;
    - endpoints de auth restringidos a loopback o proxy HTTPS explícitamente confiado;
    - comandos autenticados inyectan principal verificado al TaskRunner;
    - voz privilegiada permanece bloqueada hasta disponer de transporte de voz autenticado.

- Janus Core independiente de proveedor con Model, Voice y Tool Gateways.
- TaskRunner durable con continuar-por-defecto, pausa, reanudación, cancelación, bloqueo y aprobaciones.
- Eventos observables + PWA mobile-first.
- SQLite para runs/events y recuperación de ejecuciones interrumpidas.
- Voz full-duplex: PCM/WebSocket, STT Whisper adapter, TTS Qwen adapter, barge-in y respuesta hablada segura.
- E2E full-duplex + runtime smoke + CI.
- GitHub y Google Workspace read adapters.
- Model planner validado por Janus Core.
- Intelligence Kernel foundations:
  - Work Graph;
  - Model Router;
  - cobertura documental completa;
  - Citation Ledger;
  - durable-job partitioning;
  - improvement index.
- **Continuity Engine**:
  - replay cronológico;
  - ESTABLE / VIGENTE / TEMPORAL / HISTÓRICO;
  - instrucciones activas;
  - punto de reanudación;
  - historial preservado al sustituir estado.
- **Error Ledger**:
  - ERROR -> CAUSA -> IMPACTO -> LECCIÓN -> REGLA PREVENTIVA -> SOLUCIONES -> CAMBIO -> VERIFICACIÓN;
  - fingerprint por error;
  - reincidencia eleva prioridad normal -> high -> critical;
  - segunda reincidencia obliga a revisar por qué falló la protección previa.
- Cronología y lecciones de error persistidas en SQLite.
- Runtime carga continuidad antes del model planning.
- Cada nueva orden runtime registra el trabajo cronológicamente.
- `GET /api/continuity` devuelve snapshot reconstruido.
- Archivo local de conversaciones Janus en SQLite: sesiones + mensajes + replay cronológico.
- Clasificación automática conservadora de instrucciones explícitas y errores reportados.
- Errores reportados sin diagnóstico reaparecen como `unresolvedErrors` en futuras planificaciones.
- **Delivery Gate** fail-closed conectado al TaskRunner con dimensiones obligatorias:
  - coherencia;
  - estructural;
  - visual;
  - arquitectónica;
  - ortográfica;
  - síntesis.
- ADR-002 documenta continuidad y Quality Gates.
- **Super-Agent foundations (ADR-003)**:
  - Decision Blueprints versionados y diffables;
  - Adaptive Agent Swarm con especialistas dinámicos y concurrencia acotada;
  - Decision Receipt Chain SHA-256 para trazabilidad tamper-evident;
  - Outcome Learning Loop con calibración y Brier score;
  - detección de drift sobre resultados observados;
  - Improvement Proposals que siempre requieren aprobación humana;
  - persistencia SQLite de Blueprints, receipts, outcomes y propuestas;
  - capability map para Vision, Voice, Office, Research, Builder, Learning y cross-device continuity.
- Pruebas unitarias para Blueprints, receipts, learning/drift, swarm y persistencia.
- **Decision Blueprint + Decision Receipt en la ruta productiva**:
  - cada run selecciona un Blueprint activo, versionado e inmutable;
  - el Blueprint productivo declara agentes, herramientas, guardrails y métricas de éxito;
  - cambios de política/capacidades requieren una nueva revisión en lugar de mutar una revisión histórica;
  - cada ejecución genera una cadena SHA-256 de Decision Receipts persistida en SQLite;
  - receipts actuales cubren selección de Blueprint, planner, validación de plan, disponibilidad de capacidades, selección de herramienta, autoridad, aprobación y Delivery Gate;
  - `GET /api/runs/:runId/decisions` expone Blueprint + receipts + verificación criptográfica de la cadena;
  - el model planner recibe el Blueprint vigente como contexto, pero Janus Core conserva la autoridad de validación y ejecución.
- **Outcome Learning productivo sobre ejecuciones verificadas**:
  - planes ejecutables reciben un `execution_prediction` explícito; la versión inicial usa prior neutral 0.5 hasta disponer de historial calibrado;
  - `completed` solo entra como éxito cuando existe predicción previa y evidencia de Delivery Gate aprobado;
  - fallos posteriores a una predicción ejecutable entran como failure; bloqueos por dependencia/autoridad/aprobación, cancelaciones y fallbacks sin adaptador quedan fuera de calibración;
  - Learning Observations se persisten en SQLite y conservan el hash del receipt de predicción como evidencia;
  - calibración/Brier y detección de drift se recalculan sobre outcomes verificables;
  - drift negativo puede generar una Improvement Proposal, pero nunca la aplica: `requiresHumanApproval=true`;
  - propuestas abiertas por la misma revisión evitan duplicados;
  - `GET /api/learning` expone observaciones, calibración, drift y propuestas; `/health` publica el resumen operativo.
- **Gobernanza humana de revisiones del Runtime Blueprint**:
  - runtime resuelve exactamente una revisión `active`; cero o múltiples activas fallan cerrado;
  - cada run queda fijado a la revisión con la que comenzó, incluso si otra revisión se activa mientras sigue ejecutándose;
  - Model Planner y validación usan únicamente herramientas/acciones permitidas por la revisión fijada y disponibles en Capability Registry;
  - calibración, drift y propuestas se separan por revisión para no mezclar políticas distintas;
  - endpoints de approve/reject/apply/rollback exigen sesión autenticada Founder/Director;
  - approve crea una revisión `draft` y ejecuta regression verification antes de persistirla;
  - regression verification impide retirar guardrails obligatorios, desactivar revalidación de external writes, introducir tools/actions no registrados o eliminar roles/métricas runtime obligatorios;
  - apply requiere confirmación explícita, convierte la revisión anterior en `historical` y la draft verificada en `active`;
  - rollback nunca reactiva una revisión antigua en sitio: crea una revisión nueva basada en el histórico elegido, preservando secuencia append-only;
  - proposal aprobado queda ligado a su `proposedRevision` exacta; replay es idempotente y no puede reaplicar una revisión ya superseded;
  - decisiones de gobernanza dejan registro cronológico con principal autenticado y revisiones afectadas.
- **Execution Confidence calibrada y auditable**:
  - cada `execution_prediction` consulta únicamente outcomes verificables de la misma revisión de Blueprint;
  - con menos de 20 observaciones se conserva un prior neutral explícito de 0.5;
  - con evidencia suficiente se usa una estimación Bayesiana conservadora con prior Beta(2,2);
  - la confianza queda acotada a 0.10–0.90 para evitar certeza extrema a partir de muestras finitas;
  - cuando existe drift, la estimación usa la ventana reciente para no tratar historia obsoleta como representativa;
  - cada receipt registra modo, sample count, evidence count, media observada, Brier, drift y límites;
  - esta confianza es informativa: no modifica autoridad, riesgo, aprobación ni políticas y no activa cambios silenciosos.
- **Persistencia Intelligence Kernel restante**:
  - Work Graph snapshots con progreso de nodos;
  - durable jobs y particiones/checkpoints;
  - Citation Ledgers por run;
  - historial append-only del Improvement Index por scope;
  - recuperación SQLite validada con prueba de round-trip.
- **Flow Automation Engine foundations (ADR-004)**:
  - workflows versionados como grafos de nodos/conexiones;
  - nodos deterministas y agentic dentro del mismo workflow;
  - triggers manual / schedule / webhook / event / poll;
  - Node Registry extensible y versionado para integraciones;
  - expresiones low-code seguras por rutas de contexto, sin eval arbitrario en Core;
  - políticas por nodo: riesgo, reversibilidad, aprobación, timeout, retry/backoff y error handling;
  - referencias de credenciales sin secretos embebidos;
  - primitives de concurrencia y ejecución reanudable;
  - compilación Workflow -> Work Graph + Tool Plan;
  - diff de revisiones y base para rollback;
  - capability map de automatización con subflows, code isolation, dry-run/replay y visual editor como siguientes fases.
- Pruebas unitarias para schema/validation, expressions, execution/concurrency, compiler y Node Registry.

## PENDIENTE

### P0
1. Integrar Model Router multi-model real y registrar en Decision Receipts routing, métricas observadas y confianza calibrada; el model planner actual usa un único adapter configurado.
2. Crear reviewers productivos para las seis dimensiones, usando Model Router cuando convenga.
3. Conectar Flow Automation Engine productivamente al TaskRunner/Tool Gateway/Model Router.
4. Persistir workflow definitions, revisions, node state y execution checkpoints en SQLite.
5. Implementar error branches, waits y approvals completos sobre runtime durable.
6. Añadir simulation/dry-run/replay antes de external writes.
7. Importadores/adapters para chats históricos externos sin convertirlos en autoridad.

### P1
- Vision Adapter multimodal: cámara, imagen, vídeo y documentos.
- Office Agent: DOCX/XLSX/PPTX/PDF con validación.
- Research Agent: investigación actual, evidencia y Citation Ledger.
- Builder Agent: plan -> código -> test -> validación -> deploy con aprobación.
- Learning Agent: tutoría adaptativa y ejercicios.
- Visual Workflow Editor mobile-first/desktop con canvas de nodos, conexiones, inspección y ejecución paso a paso.
- Biblioteca de Janus Skills/Subflows reutilizables y templates versionados.
- Custom Code nodes en runner aislado/hardened.
- Webhook server + scheduler + event bus + polling adapters productivos.
- Proactive Monitor/Scheduler para drift, costos, deadlines, workflows bloqueados y errores no resueltos.
- Renderizar en PWA: contexto recuperado, Blueprint activo, agentes, receipts, drift, Quality Gates y punto de reanudación.
- Integrar model inventory real con Model Router y métricas observadas de calidad/costo/latencia.
- Ingestión documental completa con coverage checkpoints.
- Scheduler/recovery de jobs LLM largos.

### P2
- Sincronización multidispositivo manteniendo Janus Core como autoridad local.
- Biblioteca de Blueprints por dominio/negocio.
- Ejecución de swarm distribuido en múltiples máquinas cuando sea necesario.
- Apple ecosystem bridge.
- Vercel/Hostinger/browser y demás Tool Adapters.
- Home/device/IoT control donde aporte valor.

## BLOQUEADO

- La ejecución de voz local física 24/7 requiere un host local adecuado con modelos instalados.
- Vision/Office/Builder productivos requieren adapters concretos y validación E2E.
- Recuperar automáticamente chats históricos de proveedores externos requiere sus adapters/exportaciones disponibles; mientras tanto Janus conserva de forma nativa las sesiones de su propio runtime.

## PRÓXIMO

Integrar Model Router multi-model real:

**inventario local/remoto -> capacidades + disponibilidad -> routing por requisitos -> costo/latencia/calidad observados -> Decision Receipt -> outcome -> métricas del modelo.**

El routing debe preferir local cuando cumpla requisitos y degradar de forma explícita, sin convertir ningún proveedor en autoridad o dependencia estructural.

## Regla de continuidad

Este documento representa el VIGENTE de esta rama. Git y la cronología local preservan el HISTÓRICO. Antes de ejecutar trabajo nuevo, Janus sincroniza código/pruebas + cronología + Error Ledger + Blueprints + outcomes + estado vigente. Si existe contradicción, PRESENTE gobierna ejecución y PASADO se conserva para aprendizaje y previsión.
