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

## Actualización 11-nov-2026 (12:00) — los tres pasos siguientes, hechos

1. **Aprobar / Denegar en la pantalla del CEO** (`apps/pwa/approval-chip.js`): aviso rojo «Aprobar n» en la cabecera de
   las dashboards A/B, visible solo cuando hay acciones en pausa; despliega la lista (qué, dónde, por qué, riesgo,
   caducidad) con los dos botones. Usa la cola existente; el panel «Aprobaciones» de la app sigue igual.
   Probado en navegador (escritorio, tablet, móvil): 15/15.
2. **De la orden (voz o texto) a cualquier servicio conectado** (`packages/adapters/src/integration-hub-adapter.ts`):
   una sola herramienta `integration` con `operation.find`, `operation.read` y `operation.write`. El planificador
   recibe, con cada orden, los servicios conectados y las operaciones que más se le parecen (`connectedServices`).
   `operation.read` se niega a ejecutar lo que no sea lectura; `integration.operation.write` está en la política de
   acciones sensibles: siempre espera la aprobación del CEO, diga lo que diga el modelo.
   **Requisito de gobierno existente:** el CEO debe permitir la herramienta nueva una vez («acciones nuevas por
   permitir», dos toques). Sin eso el planificador no puede usarla.
3. **Un modelo redacta el cambio de código** (`packages/core/src/change-drafter.ts`, `POST /api/changes/draft`):
   lee del último commit solo los archivos indicados, pide al modelo el contenido completo y valida el borrador:
   solo esos archivos (o nuevos bajo carpetas permitidas), nunca secretos, dependencias, CI ni instaladores. Luego
   pasa por la misma tubería (clon → sandbox → commit preparado → aprobación para subir).

NO VERIFICADO: la orden por voz con un modelo real (probado con un modelo simulado), la redacción con un modelo real y
el aviso al teléfono. Sigue apagado por defecto: `JANUS_SELF_CHANGE`.

## Siguiente paso

1. Encender JANUS en un equipo, permitir la herramienta `integration` y probar una orden real contra un servicio real.
2. Autenticación de servicios distinta de Bearer (clave en cabecera propia, OAuth) cuando un servicio la necesite.
3. Especificaciones en YAML.
4. Activar embeddings, Docker (cuando haya servidor) y `JANUS_SELF_CHANGE`.

## Actualización 15-nov-2026 — quinto pilar: los datos que caducan viven fuera del código

Orden del Founder: «asegúrate de que las medidas para que JANUS en 5 años no esté obsoleto sean tomadas», a la vez que
pide contabilidad (balance y estado de resultados) y la declaración anual ante la Belastingdienst.

**Riesgo concreto.** Un tipo impositivo, un tramo o un plazo escrito en el código queda mal el 1 de enero siguiente sin
que nada falle: es la forma más silenciosa de quedar obsoleto.

**Decisión.**
1. **Reglas que cambian con el tiempo = datos con fecha y fuentes**, no código. Primer caso: `packages/modules/nl-tax-prep`
   lee «paquetes de reglas» por año (`packs/nl-<año>.json`; también `POST /api/tax/packs`, guardados en `tax_rule_packs`).
2. **Verificación por fuentes**: una cifra es «verificada» con ≥ 2 editores distintos y al menos uno oficial; con una
   sola fuente se avisa en cada informe. Las discrepancias se anotan en el propio paquete (el 15-nov, SRA publicaba
   cifras provisionales de sept-2025 distintas de las de la Belastingdienst: prevalece la fuente primaria).
3. **Sin datos del año, no hay cálculo.** Nunca se extrapola con las reglas de otro año.
4. **Caducidad visible**: un paquete revisado hace más de 120 días aparece como «por revisar» en la pantalla.
5. **Guardia en pruebas**: `tests/lego-nl-tax-prep.test.ts` falla si una cifra fiscal aparece escrita en el motor;
   `tests/lego-contracts.test.ts` exige que las piezas autónomas no importen nada externo y que todo paquete lleve
   fecha de revisión y fuentes https.
6. **Piezas con puertos estructurales**: `company-books` y `nl-tax-prep` no se importan entre sí; el anfitrión pasa
   cifras de una a otra. Cualquiera puede sustituirse (otro plan de cuentas, otro país) sin tocar la otra.

**Lo que esto NO resuelve (honestidad):** si cambia la FORMA de la ley (una deducción nueva o suprimida), hay que
versionar el esquema del paquete y el motor a la vez; nadie revisa solo las fuentes cada año (el Opportunity Radar podría
vigilar las páginas oficiales, pero su monitor sigue apagado); y un paquete nuevo lo valida el código en su forma, no en
su verdad: quien lo carga responde de las cifras.

**Voz (decisión del Founder, 12-nov-2026):** JANUS habla con el Founder prioritariamente en español; el neerlandés es
secundario y queda como hueco preparado hasta tener un módulo de voz neerlandesa; las voces de las criaturas (neerlandés
perfecto para la hija, timbre propio de criatura) son un tema aparte y pendiente. Ninguna pieza fija un proveedor de voz.

**Sin internet (recordatorio del Founder, 15-nov):** contabilidad, balance, estado de resultados y hoja fiscal funcionan
sin conexión: cálculo local, reglas en archivo local, diario en SQLite. Lo único que necesita red es REVISAR las fuentes
para actualizar un paquete de reglas; mientras tanto se usa el último paquete guardado, con su fecha de revisión a la vista.
