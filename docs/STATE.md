# JANUS — Estado vigente

Fecha: 2026-09-22

## AHORA

**M0/M1 — Observable Voice Execution + Intelligence Kernel + Continuidad Cronológica**

Integrar el Intelligence Kernel y la nueva capa de continuidad en la ruta productiva completa: una sesión nueva debe reconstruir automáticamente cronología, instrucciones vigentes, errores/lecciones y el último punto válido antes de planificar; toda entrega debe pasar Quality Gates obligatorios.

## HECHO

- Janus Core independiente de proveedor con Model, Voice y Tool Gateways.
- TaskRunner durable con continuar-por-defecto, pausa, reanudación, cancelación, bloqueo y aprobaciones.
- Eventos observables + PWA mobile-first.
- SQLite para runs/events y recuperación de ejecuciones interrumpidas.
- Voz full-duplex: PCM/WebSocket, STT Whisper adapter, TTS Qwen adapter, barge-in y respuesta hablada segura.
- E2E full-duplex + runtime smoke + CI verde.
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

## PENDIENTE

### P0
1. Conectar Delivery Gate obligatoriamente a cada salida final/artifact boundary.
2. Crear reviewers productivos para las seis dimensiones, usando Model Router cuando convenga.
3. Persistir Work Graph/jobs/citations/improvement history en SQLite.
4. Importadores/adapters para chats históricos externos (ChatGPT/Claude/etc.) sin convertirlos en autoridad.
5. Clasificar imports externos en instrucción / decisión / tarea / error / lección manteniendo fuente y fecha.
6. Promover errores reportados desde `diagnosisRequired` al Error Ledger estructurado cuando CAUSA/IMPACTO/LECCIÓN/CAMBIO/VERIFICACIÓN estén confirmados.

### P1
- Renderizar en PWA: "recuperando contexto", sesiones recorridas, punto de reanudación y Quality Gates.
- Integrar model inventory real con Model Router.
- Ingestión documental completa con coverage checkpoints.
- Scheduler/recovery de jobs LLM largos.

### P2
- Apple ecosystem bridge.
- Vercel/Hostinger/browser y demás Tool Adapters.
- Home/device control donde aporte valor.

## BLOQUEADO

- La ejecución de voz local física 24/7 requiere un host local adecuado con modelos instalados.
- Recuperar automáticamente chats históricos de proveedores externos requiere sus adapters/exportaciones disponibles; mientras tanto Janus puede conservar de forma nativa todas las sesiones que ocurran dentro de su propio runtime.

## PRÓXIMO

Cerrar P0 de continuidad:

**archivo local de sesiones -> import/replay cronológico -> Error Ledger -> contexto vigente -> planificación -> ejecución -> Delivery Gate -> entrega -> nuevo checkpoint cronológico.**

## Regla de continuidad

Este documento representa el VIGENTE. Git y la cronología local preservan el HISTÓRICO. Antes de ejecutar trabajo nuevo, Janus sincroniza código/pruebas + cronología + Error Ledger + estado vigente. Si existe contradicción, PRESENTE gobierna ejecución y PASADO se conserva para aprendizaje y previsión.
