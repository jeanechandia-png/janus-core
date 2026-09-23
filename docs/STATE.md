# JANUS — Estado vigente

Fecha: 2026-09-23

## AHORA

**M1/M2 — Super-Agent Decision Loop + Flow Automation Engine + Continuidad + Ejecución observable**

Integrar la nueva capa de Super-Agent en la ruta productiva completa: continuidad vigente -> Decision Blueprint -> Work Graph -> Agent Swarm -> Model/Tool Gateway -> guardrails/aprobación -> ejecución -> Delivery Gate -> Decision Receipt -> outcome -> calibración/drift -> propuesta de mejora.

La mejora autónoma es controlada: Janus puede detectar, aprender y proponer, pero no modificar silenciosamente producción. La nueva capa de automatización convierte workflows deterministas y agentic workflows en una misma arquitectura Janus.

## HECHO

- **Coding & Agentic Engineering Expertise (2026-09-23)**:
  - `coding` y `agentic_workflow` son tipos de trabajo nativos del Work Graph;
  - Agent Swarm asigna Builder especializado a coding y Workflow Architect a agentic workflows;
  - capacidades explícitas: arquitectura, debugging, testing, security/performance y, para workflows, multi-agent, tool use, MCP, memory/RAG, HITL, observability, recovery y evaluation;
  - política de actualización continua exige conocimiento vigente y prioriza fuentes primarias antes de decisiones sensibles a cambios tecnológicos;
  - verificación obligatoria por dominio y principios local-first/provider-independent quedan codificados como contrato ejecutable.


- **Administrative Authority Control Plane (ADR-005)**:
  - Founder/Director autenticado como máxima autoridad humana de Janus;
  - identidad mediante principal interno estable, sin usar datos biográficos como secreto;
  - documentos/web/emails/modelos/agentes/herramientas tratados como DATA sin autoridad administrativa;
  - autenticación obligatoria para instrucciones privilegiadas;
  - confirmación explícita para operaciones root destructivas o cambios de autoridad;
  - decisiones de autoridad con hash SHA-256 auditable;
  - secretos reservados a Keychain/secure store.

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
1. Conectar `expertisePolicy` al planner/runtime para insertar automáticamente investigación fresca cuando el conocimiento técnico esté vencido y bloquear entrega si faltan verificaciones obligatorias.
1. Conectar Authority Control Plane al runtime, TaskRunner, Tool Gateway y Automation Engine antes de acciones privilegiadas.
2. Implementar autenticación local fuerte del principal fundador y delegación/revocación de administradores en secure storage.
1. Conectar Decision Blueprint obligatorio a toda planificación productiva.
2. Generar Decision Receipt en cada decisión relevante: routing de modelo, selección de herramienta, aprobación, verificación y entrega.
3. Conectar outcomes verificados del Delivery Gate y TaskRunner al Outcome Learning Loop.
4. Conectar drift -> Improvement Proposal -> aprobación -> nueva revisión de Blueprint -> verificación/rollback.
5. Conectar Delivery Gate obligatoriamente a cada salida final/artifact boundary.
6. Crear reviewers productivos para las seis dimensiones, usando Model Router cuando convenga.
7. Persistir Work Graph/jobs/citations/improvement history restantes en SQLite.
8. Conectar Flow Automation Engine productivamente al TaskRunner/Tool Gateway/Model Router.
9. Persistir workflow definitions, revisions, node state y execution checkpoints en SQLite.
10. Implementar error branches, waits y approvals completos sobre runtime durable.
11. Añadir simulation/dry-run/replay antes de external writes.
12. Importadores/adapters para chats históricos externos sin convertirlos en autoridad.

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

Cerrar la integración P0 del Super-Agent e integrar el nuevo Expertise Policy al planner/runtime:

**trigger/input -> continuidad -> Workflow revision + Blueprint -> planificación -> workflow graph/swarm -> ejecución -> approvals/retries/error paths -> Delivery Gate -> receipt -> outcome -> drift/calibración -> propuesta -> aprobación -> nueva revisión -> checkpoint cronológico.**

## Regla de continuidad

Este documento representa el VIGENTE de esta rama. Git y la cronología local preservan el HISTÓRICO. Antes de ejecutar trabajo nuevo, Janus sincroniza código/pruebas + cronología + Error Ledger + Blueprints + outcomes + estado vigente. Si existe contradicción, PRESENTE gobierna ejecución y PASADO se conserva para aprendizaje y previsión.
