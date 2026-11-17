# JANUS Super-Agent Capability Map

Status: VIGENTE capability target.

This document converts observed market capabilities into Janus-native, provider-independent modules.

| Capability | Janus module | Execution principle |
| --- | --- | --- |
| Parallel specialist agents | Adaptive Agent Swarm | Spawn/reuse specialists from Work Graph, bounded concurrency |
| Multi-model selection | Model Router | Route by capability, locality, latency, cost and availability |
| Vision/camera analysis | Vision Adapter family | Local-first image/video/document understanding with provenance |
| Voice assistant | Voice Gateway | Full-duplex, interruptible, observable voice execution |
| Document analysis | Document Coverage + Citation Ledger | Whole-document coverage before synthesis |
| Office production | Office Agent family | DOCX/XLSX/PPTX/PDF creation with validation gates |
| Research | Intelligence/Research Agent | Current sources, citations, uncertainty and verification |
| Coding/building | Builder Agent | Plan -> code -> test -> validate -> deploy with approvals |
| Learning/tutoring | Learning Agent | Explain, assess, adapt difficulty, preserve learning context |
| Cross-device continuity | Continuity Layer | Core state local; sync is transport/backup, not authority |
| Workflow autonomy | TaskRunner + Durable Jobs | Pause/resume/retry/checkpoint/idempotency |
| Self-improvement | Outcome Learning Loop | Outcome -> calibration -> drift -> proposal -> approval |
| Auditability | Decision Receipt Chain | Tamper-evident decision provenance |
| Guardrails | Blueprint Guardrails + Delivery Gate | Fail-closed policy and human approval for risky changes |
| Proactive assistant | Monitor/Scheduler target | Watch state, drift, deadlines, costs and unresolved errors |
| Domain specialization | Blueprint profiles | Versioned domain profiles rather than hard-coded verticals |

## Priority

### P0
- persist Blueprints, receipts, outcomes and improvement proposals;
- connect receipt generation to model/tool/verification decisions;
- connect verified task outcomes to calibration/drift;
- require approval before applying improvement proposals;
- expose active Blueprint and drift state in runtime/PWA.

### P1
- Vision Adapter and multimodal ingestion;
- Office Agent;
- Research Agent;
- Builder Agent;
- proactive Monitor/Scheduler;
- real model inventory and outcome-aware Model Router.

### P2
- cross-device sync transport;
- domain Blueprint library;
- optional large-scale swarm scheduling across multiple machines;
- IoT/home/device bridges where useful.

## Referente técnico no comercial — Fable 5.2 (17-11-2026)

Solicitud del Founder: reproducir y mejorar funciones observables de Claude Fable 5.2 en **JANUS CORE** para uso interno no comercial de esta investigación/capacidad; no crear una segunda aplicación ni copiar pesos, entrenamiento, prompt oculto o propiedad intelectual de terceros. El carácter no comercial no supone permiso para reutilizar tecnología propietaria.

**Fuentes públicas de referencia:** [modelo oficial](https://platform.claude.com/docs/en/models/fable-5-2/overview), [notas técnicas](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2).

**Implementación actual:** ampliación de `FlowAgentAdapter` con revisiones acotadas, verificador independiente, ejecución local preferente y traspaso auditable. Debe mantenerse sustituible el Model Gateway, sin fijar Fable como proveedor. No anunciar paridad de calidad, ventana de contexto de un millón de tokens ni clonación neuronal: requieren modelo propio, benchmarks e infraestructura que todavía no se han acreditado.

**Pruebas para futuras versiones:** suites reproducibles con tareas largas, calidad antes/después de correcciones, fallos/reinicio, coste por solución, privacidad sin proveedor, permisos y publicación aprobada. Registrar métricas propias de JANUS; no usar salida de servicios ajenos para entrenar un modelo propio sin una base jurídica y contractual verificada.
