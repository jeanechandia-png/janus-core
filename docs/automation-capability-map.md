# JANUS Automation Capability Map

Status: VIGENTE target architecture.

| Workflow capability | Janus implementation | Improvement over a conventional automation graph |
| --- | --- | --- |
| Visual node workflows | Automation Workflow schema + future mobile/desktop editor | Same graph can mix deterministic and agentic nodes |
| Triggers | Manual / schedule / webhook / event / poll | Offline queue semantics + reconnect revalidation |
| Integrations | Versioned Automation Node Registry + Tool Gateway | Providers are replaceable adapters |
| Expressions | Safe Janus expression engine | No arbitrary core eval; code isolated separately |
| Branching / flow logic | Versioned graph connections and branch labels | Guardrails and provenance at node level |
| Retry / backoff | Per-node retry policy | Outcome history can suggest better retry policy |
| Error workflows | Explicit error branches + Error Ledger target | Repeated failures feed preventive learning |
| Human approval | Per-node approval invariant + TaskRunner | Approval policy follows risk/reversibility |
| Wait / resumability | Wait-node contract + durable TaskRunner target | Survives process/device restart |
| Sub-workflows | Subflow node contract | Can become reusable Janus Skills |
| Custom code | Code-node contract | Runs in hardened task runner, not core process |
| AI agents | Agentic workflow nodes | Model Router + Agent Swarm + verification |
| Multi-agent flows | Agent Swarm | Dynamic specialists rather than fixed agents |
| Workflow versions | Revision/diff model | PRESENTE/HISTÓRICO continuity rules |
| Credentials | Credential references only | Keychain/secure store; no secrets in SQLite/workflow JSON |
| Execution history | TaskRunner events + SQLite | Decision Receipt chain and provenance |
| Queue/concurrency | maxConcurrency + durable job primitives | Local/distributed execution can be added without changing schema |
| Templates | Future Blueprint/Skill library | Templates become measurable reusable operational knowledge |
| Testing | Dry-run/simulation target | Can replay prior inputs before external writes |
| Monitoring | Runtime/PWA target | Drift, cost, latency, quality and unresolved-error monitoring |
| Source control | Git-compatible portable definitions | Human-readable diffs + Blueprint/workflow rollback |

## Product direction

The Janus automation layer is not intended to be a clone of another workflow product. It becomes the **execution nervous system** of Janus:

- deterministic workflows for repeatable business rules;
- agentic nodes for judgment and research;
- multimodal nodes for voice, images, files and video;
- local-first storage and execution;
- secure Tool Gateway integrations;
- observable outcomes and self-improvement proposals;
- mobile-first creation and control.

A finished Janus workflow should therefore behave like an automation, an agent, and a reusable skill at the same time.

## Estado de implementación (2026-10-23)

Leyenda: **HECHO** = código + pruebas en la rama `claude/flow-engine-n8n-parity`; **PARCIAL** = contrato o motor sin la pieza externa; **PENDIENTE** = no existe.

| Capacidad | Estado | Evidencia / límite |
| --- | --- | --- |
| Esquema y validación de flujos | HECHO | `tests/automation-*.test.ts` |
| Expresiones seguras | HECHO | `expression-engine.ts` |
| Ejecución de extremo a extremo | HECHO | `tests/flow-runner.test.ts` (16) |
| Ramas / condiciones / selector | HECHO | runner + `ai.classify` enruta por etiqueta |
| Reintentos con retroceso | HECHO | runner |
| Ramas de error / continuar | HECHO | runner |
| Aprobación humana (pausa y reanudación) | HECHO en el motor · PARCIAL en producción | falta enlazar con las aprobaciones del Founder en el runtime |
| Esperas reanudables | HECHO en el motor · PARCIAL | instantánea JSON; falta guardarla en SQLite |
| Subflujos | HECHO | runner |
| Desduplicación / idempotencia | HECHO | clave por nodo `flow:<id>:<rev>:<run>:<nodo>`; almacén en memoria |
| Tiempo máximo por flujo | HECHO | `executionTimeoutMs` (no cancela la llamada externa en curso) |
| Código JavaScript | HECHO con límite | `vm` + worker; **no** es frontera de seguridad ante código hostil |
| Código Python | PENDIENTE | requiere Pyodide/WASM o contenedor; registrado `unavailable` |
| Nodos de IA | HECHO | resumir, clasificar, extraer, libre; el texto externo va acotado como DATO |
| Investigación con fuentes citadas | HECHO en el motor | `cited-answer.ts` (11 pruebas); falta buscador real (API key) y UI |
| Agente (Agent Swarm) en un nodo | PARCIAL | gancho inyectable; sin enlace real al Swarm |
| HTTP / REST | HECHO | `http-request-adapter.ts` (13 pruebas); requiere `JANUS_HTTP_ENDPOINTS` |
| Catálogo de conectores honesto | HECHO | `connectorCatalog`; el estado de credenciales no se presume |
| Plantillas | HECHO (5, borradores) | `flow-templates.ts`; la de domótica queda bloqueada y lo dice |
| Disparadores programados / webhook / evento | PENDIENTE | contratos sí; el runtime no tiene planificador ni receptor |
| Editor visual | PENDIENTE | dos opciones estáticas para elegir antes de construirlo |
| Historial persistente / diff de versiones | PENDIENTE | |
