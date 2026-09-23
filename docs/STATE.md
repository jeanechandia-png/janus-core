# JANUS — Estado vigente

Fecha: 2026-09-23

## AHORA

**M1/M2 — Super-Agent Decision Loop + Continuidad + Ejecución observable**

Integrar la nueva capa de Super-Agent en la ruta productiva completa: continuidad vigente -> Decision Blueprint -> Work Graph -> Agent Swarm -> Model/Tool Gateway -> guardrails/aprobación -> ejecución -> Delivery Gate -> Decision Receipt -> outcome -> calibración/drift -> propuesta de mejora.

La mejora autónoma es controlada: Janus puede detectar, aprender y proponer, pero no modificar silenciosamente producción.

## HECHO

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

## PENDIENTE

### P0
1. Conectar Decision Blueprint obligatorio a toda planificación productiva.
2. Generar Decision Receipt en cada decisión relevante: routing de modelo, selección de herramienta, aprobación, verificación y entrega.
3. Conectar outcomes verificados del Delivery Gate y TaskRunner al Outcome Learning Loop.
4. Conectar drift -> Improvement Proposal -> aprobación -> nueva revisión de Blueprint -> verificación/rollback.
5. Conectar Delivery Gate obligatoriamente a cada salida final/artifact boundary.
6. Crear reviewers productivos para las seis dimensiones, usando Model Router cuando convenga.
7. Persistir Work Graph/jobs/citations/improvement history restantes en SQLite.
8. Importadores/adapters para chats históricos externos sin convertirlos en autoridad.

### P1
- Vision Adapter multimodal: cámara, imagen, vídeo y documentos.
- Office Agent: DOCX/XLSX/PPTX/PDF con validación.
- Research Agent: investigación actual, evidencia y Citation Ledger.
- Builder Agent: plan -> código -> test -> validación -> deploy con aprobación.
- Learning Agent: tutoría adaptativa y ejercicios.
- Proactive Monitor/Scheduler para drift, costos, deadlines, tareas bloqueadas y errores no resueltos.
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

Cerrar la integración P0 del Super-Agent:

**continuidad -> Blueprint -> planificación -> swarm -> ejecución -> Delivery Gate -> receipt -> outcome -> drift/calibración -> propuesta -> aprobación -> revisión de Blueprint -> checkpoint cronológico.**

## Regla de continuidad

Este documento representa el VIGENTE de esta rama. Git y la cronología local preservan el HISTÓRICO. Antes de ejecutar trabajo nuevo, Janus sincroniza código/pruebas + cronología + Error Ledger + Blueprints + outcomes + estado vigente. Si existe contradicción, PRESENTE gobierna ejecución y PASADO se conserva para aprendizaje y previsión.
