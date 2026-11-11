# ADR-012 — Arquitectura anti-obsolescencia: cuatro pilares sobre el Núcleo existente

**Fecha:** 11 de noviembre de 2026 · **Estado:** base implementada y probada; activación real pendiente del equipo donde corra JANUS.
**Origen:** instrucción de arquitectura del CEO («fase final de JANUS»).

## Principio

No se crea un orquestador nuevo. Cada pilar se apoya en una pieza que ya existía y la generaliza:

| Pilar | Archivo nuevo | Pieza existente que reutiliza |
|---|---|---|
| 1 Integración agnóstica | `packages/gateways/src/spec-connector.ts` | `ToolGateway` / `ToolAdapter`, bóveda de credenciales |
| 2 Automejora en sandbox | `packages/core/src/sandbox-runner.ts` | git, pruebas del repo, puerta de aprobación |
| 3 Memoria persistente | `packages/core/src/knowledge-memory.ts` | SQLite, `error_lessons`, instrucciones de proyecto, ámbitos |
| 4 Puerta humana (HITL) | `packages/core/src/operation-risk.ts` | `ApprovalQueue` (pausa, caducidad, auditoría), avisos Web Push |

Sin dependencias nuevas en `package.json`.

## 1. Integración agnóstica

- Un servicio entra por su **especificación**: OpenAPI 3 / Swagger 2 (JSON), introspección GraphQL o un servidor **MCP** por HTTP (`tools/list`, `tools/call`). `POST /api/integrations` la lee (documento pegado o URL https), la convierte en un catálogo de operaciones y lo guarda (`service_catalogs`).
- `buildRequest` arma la petición a partir del catálogo y de los argumentos: valida obligatorios, tipos y destino. No hay código por servicio.
- Seguridad: solo https, solo el host declarado por la especificación, sin redirecciones a otro origen, respuesta acotada. La credencial sale de la bóveda (`spec:<servicio>`), nunca del catálogo. Límite actual: autenticación Bearer.
- **Límite declarado:** elegir la operación a partir de una orden en lenguaje natural (por voz) todavía no está cableado al planificador; hoy se elige con `GET /api/integrations/:id/operations?q=` y se llama con `POST …/call`. YAML no se interpreta (usar la variante JSON).

## 2. Automejora con ejecución segura

- `ChangePipeline.propose`: clona el repositorio (solo lo versionado), aplica el cambio en el clon, ejecuta comprobaciones de una lista cerrada (`typecheck`, `test`, `dashboard-test`) en el sandbox y, solo si todo pasa, deja un commit en una rama `janus/change-…`. Guarda los registros como evidencia.
- `publish`: empuja esa rama (nunca `main`/`master`/`production`) y exige una aprobación HITL aunque la pida el CEO. Fusionar o desplegar es otro paso.
- Aislamiento, declarado en cada resultado: `DockerSandboxDriver` (contenedor sin red, solo lectura, sin privilegios, con límites) o `ProcessSandboxDriver` (proceso con entorno limpio: **no es una frontera de seguridad**; es lo disponible en la tablet Android, donde no hay Docker). E2B u otro servicio entra implementando `SandboxDriver`; no se incluye porque es de pago.
- **Apagado por defecto** (`JANUS_SELF_CHANGE=on`). Quién redacta el cambio (un modelo) no forma parte de esta base: la tubería recibe el cambio ya escrito.

## 3. Memoria persistente

- `KnowledgeMemory`: guarda reglas, correcciones, mapa de infraestructura, hechos y decisiones, sin duplicados (huella del texto), con versión (`supersedes`) y **ámbito** (laboral, personal, familiar): una consulta laboral nunca devuelve lo familiar.
- Consulta obligatoria antes de planificar: `/api/command` pide `briefFor(orden, ['work'])` y lo pasa al planificador.
- Se alimenta sola de lo que JANUS ya sabía: lecciones de errores e instrucciones de proyecto (`POST /api/memory/sync`, y al arrancar), y de cada servicio que se conecta.
- **Decisión:** el almacén por defecto es SQLite local (`knowledge_items`), por la regla local-first y de no gastar sin aprobación. `VectorStore` es una interfaz; `QdrantVectorStore` está incluido como adaptador para cuando haya servidor propio. Pinecone/Weaviate entrarían igual.
- **Límite declarado:** sin `JANUS_EMBEDDINGS_URL` se usa una huella léxica local: encuentra por vocabulario, no por sinónimos. La búsqueda semántica real requiere un modelo de embeddings (local o de pago). No es un grafo de conocimiento; es búsqueda por similitud.

## 4. Puerta humana

- `classifyOperation` decide por lo que la operación **hace**, no por quién la pide: lectura → automática; escritura → aprobación; borrar, revocar, sobrescribir, SQL destructivo, producción, dinero, permisos o personas → restringida. Una lista de confianza solo puede relajar escrituras menores, nunca lo restringido.
- `HitlGate.authorize` pausa el hilo en la `ApprovalQueue` existente, avisa al dispositivo del CEO (Web Push) y continúa o cancela según su decisión (`POST /api/approvals/:id/decision`). Caduca sola si nadie responde.
- **Límite declarado:** el aviso al teléfono necesita la clave de avisos y que el CEO active los avisos en su dispositivo; no se ha verificado contra Apple/Google. La decisión hoy se toma por API; falta el botón Aprobar/Denegar en la pantalla del CEO para estas operaciones.

## Variables

`JANUS_EMBEDDINGS_URL`, `JANUS_EMBEDDINGS_MODEL`, `JANUS_EMBEDDINGS_DIMENSIONS` · `JANUS_TRUSTED_MINOR_WRITES` · `JANUS_SANDBOX_IMAGE` · `JANUS_SELF_CHANGE`, `JANUS_SELF_CHANGE_REPO`, `JANUS_SELF_CHANGE_REMOTE`.

## Pruebas

`tests/spec-connector.test.ts`, `tests/sandbox-runner.test.ts`, `tests/knowledge-memory.test.ts`, `tests/operation-risk.test.ts` (22) y un bloque de extremo a extremo en `tests/work-runtime-smoke.mjs`.
No verificado: un servicio real por su especificación (el entorno de trabajo no tiene salida libre a internet), Docker, Qdrant, un modelo de embeddings real.

## Siguiente paso

1. Cablear al planificador de voz la elección de servicio y operación (con la memoria como contexto).
2. Botones Aprobar / Denegar en la dashboard del CEO para la cola de aprobaciones.
3. Que un modelo redacte el cambio que entra a `ChangePipeline`.
4. Activar en el equipo real: embeddings, Docker (cuando haya servidor) y `JANUS_SELF_CHANGE`.
