# JANUS — Estado vigente

Fecha: 2026-10-23

## AHORA

**M1/M2 — Super-Agent Decision Loop + Flow Automation Engine + Continuidad + Ejecución observable**

Integrar la nueva capa de Super-Agent en la ruta productiva completa: continuidad vigente -> Decision Blueprint -> Work Graph -> Agent Swarm -> Model/Tool Gateway -> guardrails/aprobación -> ejecución -> Delivery Gate -> Decision Receipt -> outcome -> calibración/drift -> propuesta de mejora.

La mejora autónoma es controlada: Janus puede detectar, aprender y proponer, pero no modificar silenciosamente producción. La nueva capa de automatización convierte workflows deterministas y agentic workflows en una misma arquitectura Janus.

## HECHO

- **Envío de correo con aprobación exacta (2026-10-23, rama `claude/social-accounts-watch`)**: `gmail.draft.preview` (solo lectura: Para/Cc/Cco, asunto, texto y huella) + plantilla `correo-enviar-aprobado` (inicio manual; `enviar` de riesgo alto, irreversible, con aprobación) + `mail-send-approval.ts` (tarjeta de aprobación con avisos). Si el borrador cambia tras aprobar, **no se envía**. 13 pruebas nuevas y 8 mutaciones detectadas. **Sin enviar nada real** y **sin botón en la PWA** (necesita autorización de Jean para tocar `apps/pwa`; OAuth de Google pendiente). Detalle: `docs/mail-send-approval.md`.
- **Nodo `ai.agent` ↔ Agent Swarm (2026-10-23, rama `claude/social-accounts-watch`)**: `packages/orchestrator/src/flow-agent-adapter.ts` — enrutado por capacidades del swarm, local-first (`requireLocal`/`preferLocal`), verificación independiente que **falla cerrado** con riesgo medio/alto o acción irreversible (veredicto estricto `{ ok: true }`, verificador distinto del productor), traspaso auditable con huellas (nunca contenido), tiempo y tamaño acotados; con riesgo alto, primero aprobación humana. 20 pruebas nuevas y 5 mutaciones detectadas. **Sin agentes reales conectados** (modelo con API = gasto, en reposo, norma 7). Detalle: `docs/flow-agents.md`.
- **Despachador de disparadores de flujos (2026-10-23, rama `claude/social-accounts-watch`)**: `packages/automation/src/trigger-dispatcher.ts` + `cron.ts` — programado (cron con zona horaria y cambios de hora), webhook firmado con HMAC (anti-repetición, 401 uniforme, secreto desde la bóveda), evento y cola sin conexión con revalidación, todo idempotente y con cursor/cola en SQLite; el motor acepta `trigger.nodeId`. 35 pruebas nuevas (suite 540/541) y 6 mutaciones detectadas. **El runtime todavía no lo arranca** (en reposo, norma 7). Contrato y límites: `docs/flow-triggers.md`.
- **Editor visual de flujos «Flujos» (2026-10-23, rama `claude/social-accounts-watch`)**: `apps/flow-editor/` — lienzo táctil de nodos sobre el motor real (catálogo, validación, plantillas), conexión en dos toques con ramas, deshacer/rehacer, problemas en español, orden previsto, importar/exportar borradores sin claves, entorno **simulado** rotulado; lo «en reposo» se cuenta aparte de los errores (norma 7). Un solo HTML sin red (`npm run flow-editor:build`); 64 comprobaciones en navegador (`npm run flow-editor:e2e`). **No publica ni ejecuta; no probado en iPhone/iPad reales.** Detalle: `apps/flow-editor/README.md` y el handoff `2026-10-23-vault-oauth-phone-watch`.

- **Cuentas, buzones y teléfono del Founder — lectura, redacción y envío con confirmación (2026-10-23, rama `claude/social-accounts-watch`, PR #47)**:
  - correo: leer, redactar, corregir y **enviar bajo instrucción del Founder con su confirmación en cada envío** (el envío relee el borrador y se niega si destinatarios/asunto difieren de lo aprobado); nada autónomo (sin respuestas automáticas, borrar, archivar ni reenviar); cuenta de menor solo lectura salvo `guardian-managed`;
  - almacén cifrado de credenciales (AES-256-GCM) + consentimiento de Google por buzón (PKCE, cuenta verificada, lectura y escritura separadas, renovación automática); token de Threads renovable;
  - teléfono/WhatsApp: registro, política, plan por rutas y enlaces de un toque (WhatsApp/SMS/llamada); API oficial, voz y SMS **no existen todavía** (requieren número dedicado y gasto); clientes no oficiales de WhatsApp rechazados;
  - vigilancia periódica de redes opt-in (fotos en SQLite, alertas de caída/subida), agrupación de enlaces por cuenta;
  - datos personales en una capa local ignorada por git; escaneo de privacidad local; **nada probado contra las API reales**; 482/482 pruebas + humo del runtime;
  - **historial de ejecuciones de flujos en SQLite** (`packages/automation/src/flow-run-persistence.ts`): estado, salidas y eventos en orden; desduplicación del disparador que sobrevive a reinicios; reanudación de pausas por aprobación/espera (falla cerrado si la instantánea no es fiable); valores con aspecto de secreto ocultados antes de guardar; **aún sin ruta HTTP ni panel** (PENDIENTE);
  - **norma 7, «el gasto va al final» (Founder, 2026-10-23)**: lo que cuesta dinero se construye y queda **en reposo, pendiente de activación** (`docs/dormant-capabilities.md`); el motor no se despliega ni se contrata servidor por ahora (opción C); precios siempre en euros;
  - detalle, límites, lecciones y bloqueos: `docs/handoffs/2026-10-23-vault-oauth-phone-watch.md` (y el anterior, histórico) y `docs/founder-social-source-readiness.md`.

- **Motor de flujos inspirado en n8n + respuestas con citas (2026-10-23, rama `claude/flow-engine-n8n-parity`)**:
  - ejecución real de flujos (ramas, reintentos, ramas de error, aprobación y esperas reanudables, subflujos, desduplicación, tiempo máximo), código JS aislado, nodo HTTP/REST con endpoints autorizados por nombre, nodos de IA con el texto externo acotado como dato, catálogo de nodos/conectores honesto y 5 plantillas;
  - `cited-answer`: búsqueda → citas numeradas con enlaces → verificación automática;
  - Python y los disparadores programado/webhook/evento **no existen todavía** y están registrados como `unavailable`;
  - detalle, límites y pendientes: `docs/handoffs/2026-10-23-flow-engine-n8n-parity.md` y addendum de `ADR-004`.

- **Coding & Agentic Engineering Expertise (2026-09-23)**:
  - `coding` y `agentic_workflow` son tipos de trabajo nativos del Work Graph;
  - Agent Swarm asigna Builder especializado a coding y Workflow Architect a agentic workflows;
  - capacidades explícitas: arquitectura, debugging, testing, security/performance y, para workflows, multi-agent, tool use, MCP, memory/RAG, HITL, observability, recovery y evaluation;
  - política de actualización continua exige conocimiento vigente y prioriza fuentes primarias antes de decisiones sensibles a cambios tecnológicos;
  - verificación obligatoria por dominio y principios local-first/provider-independent quedan codificados como contrato ejecutable.

- **Capability Modules / IBA integration**:
  - Identity & Presence definido como capacidad nativa de Janus y módulo reutilizable desacoplado;
  - IBA corregido como nombre del producto (con B);
  - casos iniciales: Admin Dashboard, Sensitive Vault, re-autenticación y auditoría;
  - packaging comercial provisional: IBA Core / Secure Access / Secure Vault / Enterprise Security;
  - precio marcado POR CONFIRMAR mediante estudio de mercado + willingness-to-pay;
  - regla general para evaluar futuras capacidades Janus como módulos/SDK reutilizables.

- **Janus Identity & Presence (ADR-008)**:
  - verificación facial como factor biométrico local, no como autoridad por sí sola;
  - liveness/anti-spoof obligatorio para assurance fuerte;
  - dispositivo confiable + face match + liveness = sesión strong;
  - acciones root requieren además PIN/recovery factor independiente;
  - sesiones administrativas cortas y auditables;
  - plantillas biométricas únicamente por referencia a Secure Enclave/Keychain/TPM/secure store;
  - prohibido guardar templates biométricos en SQLite, código, workflows, logs o prompts;
  - arquitectura 1:1 para verificar al administrador enrolado, no identificación masiva de terceros;
  - adapters biométricos reemplazables y ejecución local-first.

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
- **Execution Prediction calibrada por revisión**:
  - el prior 0.5 deja de ser permanente y pasa a ser un fallback temporal mientras no exista evidencia suficiente;
  - Janus exige mínimo 12 Learning Observations verificadas de la misma Blueprint revision antes de usar evidencia histórica;
  - la predicción calibrada usa shrinkage hacia 0.5 para evitar sobreajuste con muestras pequeñas;
  - la probabilidad operativa queda limitada a 0.1–0.9 para evitar falsa certeza;
  - cada `execution_prediction` registra basis, sampleCount, meanOutcome, prior y minimumSamples en su Decision Receipt;
  - `/health` y `GET /api/learning` exponen la predicción que usaría el siguiente run;
  - ninguna calibración modifica el Blueprint ni políticas de producción: solo informa la predicción del resultado.
- **Coordinación multioperador productiva**:
  - operadores humanos autenticados usan rol `operator` de mínimo privilegio y claves públicas P-256; no heredan autoridad administrativa;
  - el Founder define scopes `private/shared/project/system` y grants explícitos `read_context/write_work/coordinate/handoff`;
  - una asignación nunca concede acceso implícito a un scope privado: el grant se valida incluso para el assignee;
  - perfiles, scopes, grants, assignments y handoffs viven en SQLite local; revocar un operador invalida sesiones y revoca sus grants activos;
  - `GET /api/coordination` entrega un brief filtrado por identidad con trabajo visible y último handoff;
  - `POST /api/command` puede enlazar un `assignmentId`; antes de ejecutar se revalida `write_work` para todos los scopes;
  - todo run enlazado que termina, falla, se bloquea o cancela genera un handoff durable con resumen ejecutivo, conclusiones, completado, pendientes, blockers, próximos pasos, decisiones, referencias de evidencia y checksum SHA-256;
  - el handoff automático añade un Decision Receipt `coordination_handoff`, preservando quién operó y desde qué run;
  - Janus Core puede coordinar el estado local global sin convertirse por ello en la identidad del Founder para external writes;
  - prueba de humo E2E cubre Founder -> alta operator -> scope -> grant -> assignment -> login operator -> linked run -> handoff -> receipt.
- **Reusable LEGO Library + Project Context Continuity**:
  - catálogo central versionado para símbolos, fotos, logos, iconos, botones, tipografías, design tokens, themes, componentes, módulos, templates, workflows y prompts;
  - cada pieza conserva id estable, revisión, tags, compatibilidad, dependencias, spec, content/preview refs y checksum SHA-256;
  - nuevas revisiones son append-only: la revisión anterior pasa a histórico sin perder trazabilidad de su contenido;
  - resolución de dependencias fail-closed ante checksum alterado, dependencia faltante o ciclo;
  - proyectos, threads, resource refs y checkpoints se persisten en SQLite;
  - cada proyecto puede enlazarse a un coordination scope; autenticación por sí sola no concede acceso: Founder ve todo, otros principals requieren ser creator o disponer del grant adecuado;
  - la cronología de un proyecto se filtra por `projectId` para evitar mezclar contexto de otros proyectos;
  - abrir un thread nuevo genera automáticamente un bootstrap checkpoint con instrucciones activas, decisiones, errores, resume point, próximos pasos y evidencia;
  - runs ligados a `projectId + threadId` producen checkpoint al terminar y el planner recibe continuidad/recursos/checkpoint del proyecto;
  - cambiar de chat no reinicia el proyecto: el chat es una ventana y el proyecto es la memoria;
  - resource refs ya modelan local / Google Drive / iCloud / upload / import como backends reemplazables; los binarios siguen pendientes de content-addressed local storage productivo.
- **Assistant Control Plane centralizado**:
  - un perfil padre versionado `infinity-landing-assistant` gobierna comportamiento compartido, guardrails, capacidades y módulos reutilizables;
  - superficies seed: `landing.infinity-group`, `landing.infinity-chatbox`, `landing.iba`;
  - las tres usan `tracking=current` por defecto y heredan automáticamente la revisión vigente sin editar cada superficie;
  - una superficie puede quedar `pinned` temporalmente para congelar una revisión compatible sin bifurcar la ingeniería común;
  - las superficies solo pueden quitar capacidades compartidas, no inventar capacidades fuera del perfil padre;
  - perfiles/superficies tienen checksum SHA-256 y persistencia SQLite;
  - nuevas revisiones son append-only: la anterior pasa a `historical`, la nueva a `current`;
  - módulos requeridos se resuelven contra la Reusable LEGO Library antes de promover una revisión;
  - actualización de perfil registra cronología de gobernanza y lista las superficies afectadas;
  - runtime expone `GET /api/assistant-control`, config resuelta por superficie y mutaciones Founder-only;
  - smoke E2E prueba una sola actualización del perfil -> las tres superficies pasan de rev1 a rev2 sin cambiar sus registros propios.
- **Continue-by-Alternatives Policy**:
  - bloqueo operativo exige PROBLEMA -> RIESGO -> CAUSA -> 2-4 OPCIONES REALES -> EVIDENCIA -> RECOMENDACIÓN -> SIGUIENTE ACCIÓN;
  - dependencia no obligatoria puede quedar aparcada mientras avanza trabajo independiente;
  - faltas de aprobación/autoridad, acciones irreversibles de alto riesgo y ausencia de datos materialmente necesarios siguen siendo stops obligatorios;
  - fallos de provider/capability producen `blocker_resolution` Decision Receipt con alternativas estructuradas;
  - los handoffs multioperador incluyen esos blocker resolutions para que Julio o cualquier operador reciba rutas de continuación, no solo el error;
  - Model Planner recibe la política de progreso como contexto;
  - cambio automático real de proveedor queda pendiente del Model Router multi-model; Janus no afirma haber cambiado de modelo si no existe adapter compatible registrado.
- **Release Target Manifest resolver (foundation)**:
  - contrato checksum-protected para `surfaceId + product + repository + releaseRef + releaseHeadSha + evidenceRefs`;
  - el resolver usa el ref dedicado `infinity/assistant-control-metadata`; la rama default del repositorio no participa en la resolución de release;
  - si `targetRef` no se suministra, el publisher resuelve `.infinity/assistant-control/<productKey>.release.json` desde ese ref de control dedicado;
  - el HEAD real de la rama declarada debe coincidir exactamente con `releaseHeadSha` o la publicación falla cerrada;
  - resolución, fuente y checksum del manifiesto quedan trazables en la decisión de gobernanza;
  - Founder approval, idempotencia, expected-HEAD lease y read-back checksum permanecen obligatorios;
  - PR #27 valida esta foundation con TypeScript, tests y runtime smoke en verde (re-verificado 2026-10-13: 182/182 + smoke con entorno sin credenciales).
  - **Custodia del HEAD de release (2026-10-13)**: el commit verificado del propio publisher ya no invalida el manifiesto; se acepta solo una cadena ininterrumpida de entregas Janus `published_verified/applied` desde `releaseHeadSha` en el mismo repo+ref; commits ajenos, bifurcaciones y ciclos fallan cerrado. 188/188 tests.
  - Smoke runtime hermético: fija `GITHUB_TOKEN=''` y ya no depende de las credenciales del shell.
- **Assistant Config Publisher productivo**:
  - genera bundle saneado/determinista por superficie con revisión exacta, checksums, instrucciones, guardrails, capacidades, presentation y módulos reutilizables;
  - serialización idempotente: misma config -> mismo bundle/checksum/contenido;
  - GitHub adapter añade `branch.get` y `file.publish`;
  - `file.publish` exige auth, ref explícita, HEAD esperado, doble revalidación de rama e idempotencia por contenido;
  - publisher runtime exige Founder + `confirmAction=publish_assistant_surface`, capability disponible, idempotency key y authority audit hash;
  - Janus nunca adivina la rama productiva: el targetRef debe resolverse/confirmarse para cada publicación;
  - después del write, Janus lee el archivo por commit y valida el bundle checksum antes de marcar `published_verified`;
  - `applied` es un estado distinto y solo se alcanza con acknowledgement separado del mismo checksum;
  - deliveries se persisten en SQLite con target/ref/path/head/commit/estado/intentos/evidencia;
  - sin GitHub write credentials el publisher falla cerrado y no crea una falsa entrega.
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

2s. **Nodo de Janus en la tablet Samsung (2026-10-23, rama `claude/tablet-nodo-janus`)**: piloto temporal y **solo para Janus** (ChatBox e IBA no cambian), 0 €, en reposo hasta que Jean lo ejecute en la tablet. Ver `docs/tablet-node.md` y `docs/handoffs/2026-10-23-tablet-nodo-janus.md`.
   - `scripts/tablet/` (instalador Termux idempotente, supervisor con reinicio y una sola instancia, copia diaria verificada de SQLite con rotación, estado en lenguaje llano); sin secretos; envío a Drive inactivo hasta autorización.
   - HECHO VERIFICADO: núcleo en Node 24.22.1 → 573/574 pruebas (1 omitida), `runtime-smoke` ok, `tests/tablet-kit.test.ts` 5/5; Termux trae Node 24 LTS con `--shared-sqlite`. POR CONFIRMAR: Android real de la tablet, tsx/esbuild allí, autonomía de batería. BLOQUEADO (no urgente): acceso desde el iPhone requiere HTTPS para el inicio de sesión.

## PENDIENTE

### P0
1. Integrar consumidores del Assistant Config Bundle en InfinitySeed Group, Infinity ChatBox e IBA y añadir acknowledgement/health verificable de `bundleChecksum`; solo entonces “actualizado en las tres” equivale a live aplicado.
2. Desplegar y gobernar los Release Target Manifests VIGENTES de InfinitySeed Group, Infinity ChatBox e IBA; el resolver Core ya está implementado y validado en PR #27, pero no se considera cerrado hasta que los tres punteros estén publicados y verificados.
2a. **[HISTÓRICO, resuelto en 2a-ter] Hallazgo 2026-10-13 — manifiesto ChatBox OBSOLETO (verificado)**: `infinity-chatbox-platform@infinity/assistant-control-metadata` (commit `de219f8e`) contiene `infinity-chatbox.release.json` con checksum y binding válidos, pero declara `release/rc25-canonical-landing-20260925@0cb2745a`; el HEAD vivo es `7485f058` (≥7 commits `release(netlify)` posteriores, 2026-10-10..13, ajenos a Janus). Janus falla cerrado correctamente. Refrescar el manifiesto es un external write en un repo privado de producto: requiere confirmación Founder y validación de que ese HEAD es la release vigente.
2a-bis. **Corrección del Founder (2026-10-13 19:23)**: el HEAD más reciente de la rama de release NO es lo publicado; es trabajo en curso. Evidencia: `CURRENT_STATE.md` de ChatBox registra "Production: PUBLISHED 2026-10-13 01:59 CEST (release `f0324f9`, deploy `6acd7435…`). Catalog-status follow-up commit awaits its own authorization"; el commit posterior `7485f058` se desplegó en Netlify como `deploy-preview` (deploy `6acdd408`, título "production candidate"). Publicado según registro: `f0324f96`. NO confirmado independientemente: la página bloquea lectores automáticos (robots) y el ID de deploy está truncado.
   - REGLA: lo publicado se determina por el deploy de producción, nunca por "el commit más nuevo" de una rama. Orden cronológico siempre, pero cronología ≠ publicación.
   - **HECHO (2026-10-13)**: ancla al deploy de producción implementada — adapter Netlify solo lectura (`site.published_deploy`), campo opcional `deployment` en el manifiesto (compatible: el manifiesto ChatBox vigente valida sin cambios), `assessPublishedRelease` y puerta en el publisher. 197/197 tests + smoke hermético. No verificado contra la API real de Netlify (falta `NETLIFY_AUTH_TOKEN` en Janus).
   - **Contradicción abierta**: Netlify marca el deploy `6acdd408` (candidato `7485f058`) con `published_at 2026-10-13T06:49Z`, contexto `deploy-preview`, y el conector lo muestra como deploy actual; `CURRENT_STATE.md` dice que ese commit espera autorización. Debe confirmarse en el panel de Netlify (Deploys → "Published") si el candidato quedó publicado sin autorización registrada.
   - Consecuencia de diseño: la rama de release puede contener candidatos no autorizados por encima de lo publicado. Janus NO debe escribir el bundle encima de ese candidato. La custodia actual ya falla cerrado en este caso (HEAD `7485f058` ≠ manifiesto). Mejora pendiente: anclar el manifiesto al deploy de producción verificado (Netlify published deploy → commit) y no al HEAD de la rama.
2a-ter. **RESUELTO (2026-10-13 19:32)**: el Founder corrige su indicación anterior: `7485f058` SÍ es la versión publicada y ChatBox está terminado. La evidencia de Netlify (deploy `6acdd408`, `published_at 06:49Z`) era correcta; la línea "awaits its own authorization" de `CURRENT_STATE.md` de ChatBox quedó desactualizada (no se modificó ese documento de producto).
   - **HECHO**: manifiesto ChatBox refrescado en `infinity-chatbox-platform@infinity/assistant-control-metadata` → commit `b56e5ade`, `releaseHeadSha 7485f058`, checksum `6ad723d6…43f8`. Releído desde GitHub y validado con el código de Janus: checksum + binding OK, custodia `manifest_head` contra el HEAD vivo. Rama de producto intacta. Manifiesto anterior `de219f8e` conservado en historial.
   - Sin binding `deployment` todavía: los deploys CLI de ChatBox tienen `commit_ref: null` y lo bloquearían como `commit_unverifiable`. Añadirlo cuando los deploys registren su commit.
   - LECCIÓN: ante evidencia contradictoria (proveedor vs documento), reportar la contradicción sin resolverla por suposición; el estado del proveedor de hosting prevalece sobre un documento narrativo.
2b. **Group e IBA — BLOQUEADO por arquitectura (verificado 2026-10-13)**; NO se crearon manifiestos (serían afirmaciones falsas):
   - **InfinitySeed Group**: producción = HTML estático en Hostinger `public_html` (www.infinityseed.group); copia exacta en `recovery/live-production-baseline-20260929@68478544`; V9 en `feature/v8-premium-continuity-20261012` = vista previa NO publicada. Nada en producción lee del repositorio → un bundle publicado ahí nunca llegaría. El chat de la web llama al motor de ChatBox (`POST infinitychatbox.nl/api/v1/infinityseed/advisor`). Opciones: (a) redirigir el target de la superficie `landing.infinity-group` al runtime ChatBox que realmente la sirve (recomendado; requiere decisión del Founder porque cambia dónde escribe Janus); (b) adapter Hostinger con aprobación explícita; (c) dejarla sin entrega automática.
   - **IBA**: `feature/iba-live-ai-landing@06da714f` (2026-09-20) sin consumidor `assistant-control`; Vercel API niega listar deploys (403) → versión publicada NO verificable. Registro previo: producción fallaba cerrada por config. Requiere: consumidor en IBA + acceso de lectura a deploys de Vercel.
   - Observación de marca: la superficie seed `landing.infinity-group` usa `brandName: 'Infinity Group'`; el nombre canónico es "InfinitySeed Group". No se cambió (cambio de marca → autorización del Founder).
2c-bis. **HECHO — acknowledgement observado por Janus**: `POST /api/assistant-control/deliveries/:id/verify-applied` (Founder) consulta el endpoint de estado del consumidor mediante adapter `assistant-consumer.status.read` (solo GET, https, allowlist exacta, sin credenciales, sin redirecciones, 10 s, 64 KB) y marca `applied` solo si el consumidor reporta `loaded` con mismo surface + revisión + checksum. Fuente registrada `janus-probe:<url>@<hora>`. El ack manual se conserva (atestación humana). URL ChatBox por defecto; extensible con `JANUS_ASSISTANT_STATUS_URLS`. No probado contra el endpoint real (la red del sandbox lo bloquea; `robots` impide WebFetch).
2d. ~~Brecha de verificación~~ → resuelta por 2c-bis para ChatBox.
2c. El consumidor ChatBox existe en la rama de release (`app/api/v1/assistant-control/status/route.ts`, `applied = status === "loaded"`), pero el bundle `.infinity/assistant-control/infinity-chatbox.*` aún no está publicado en esa rama (404).
2d-hist. [HISTÓRICO] Brecha detectada: el ack aceptaba un checksum tecleado; resuelta en 2c-bis.
2e. **HECHO (2026-10-13) — Acceso tipo app de Janus (norma de activos reutilizables)**:
   - Pieza reutilizable `apps/pwa/app-install.js`, generalizada desde `infinityseed-group-website@31306eb3`: sin dependencia de producto (`mountAppInstall({ appName, iconSrc, lang })`), 4 idiomas del ecosistema (ES/EN/NL/TR), aviso nativo en Chromium, guía de 2 pasos en iPhone/iPad, oculta si ya está instalada, Escape y foco accesibles.
   - Janus: botón "Instalar app" en la cabecera, metadatos iOS/Android, manifiesto con `id/scope/lang`, caché offline `janus-shell-v5` incluye la pieza, servidor sirve `.png/.webp/.ico`. Nombre visible "JANUS" sin cambios.
   - Verificado en navegador (iPhone 15 Pro Max emulado y escritorio): botón visible, guía correcta, cierra con Escape, la interfaz vuelve a ser utilizable, oculto en modo instalado, sin errores de página.
   - ERROR → LECCIÓN: la primera adaptación dejó una capa invisible bloqueando la pantalla tras cerrar, porque el sitio de origen dependía de una regla global `[hidden]{display:none!important}` que no viajó con la pieza. REGLA: una pieza reutilizable debe llevar consigo todas sus dependencias de estilo/comportamiento. Prueba de regresión añadida.
   - Textos de capacidades GitHub/Netlify traducidos al español (el smoke acepta ambas formas).
   - **BLOQUEADO — icono oficial de Janus**: el manifiesto no declara iconos porque no existe en el repositorio un archivo maestro del logo de Janus. Por la norma de marca no se recorta ni se regenera desde las imágenes de diseño. Necesario: PNG maestro 512×512 (y 180×180 para iPhone), preferiblemente con fondo opaco. Sin él, iPhone usa una captura como icono y Android puede no mostrar el aviso nativo (la guía sigue funcionando).
   - Pendiente de reutilización: registrar la pieza en la Reusable LEGO Library y ofrecerla a ChatBox/IBA cuando corresponda.
2f. **HECHO (2026-10-13) — Interpretación tolerante a errores de transcripción** (regla del Founder: considerar que la transcripción puede estar mal y resolver el significado por contexto):
   - `packages/core/src/transcript-interpretation.ts`: léxico canónico del ecosistema con errores conocidos ("Llanos"→Janus, "Infinity Group"/"Infinity Shift"→InfinitySeed Group, "IVA"→IBA), alias ambiguos que solo se resuelven con contexto del ecosistema ("llanos" = llanuras; "IVA" con vocabulario fiscal conserva su sentido), coincidencias fonéticas solo como sugerencia, nunca toca citas/código/URLs/correos/rutas, y **nunca autocorrige órdenes sensibles** (publicar, borrar, enviar, pagar, desplegar…): pregunta.
   - Texto original siempre preservado; Decision Receipt `transcript_interpretation` en la cadena SHA-256; el planner recibe original + interpretación; la planificación solo usa correcciones aplicadas.
   - Prevención en origen: whisper.cpp recibe `prompt` con el vocabulario canónico (no probado contra un servidor whisper real).
   - PWA: aviso persistente "INTERPRETACIÓN" con botón "Sí, corrígelo" que reenvía la frase corregida como nueva orden gobernada. Verificado en iPhone emulado: aviso visible tras terminar la tarea, confirmación reenvía «…InfinitySeed Group», sin errores.
   - Lección de prueba: un servidor de una prueba anterior seguía ocupando el puerto y respondía con código viejo. El script E2E ahora aborta si el puerto está ocupado o el servidor no arranca.
2g. **HECHO (2026-10-13) — Marca y destino de la web**: "Infinity Group" era un error de transcripción → `InfinitySeed Group` en la superficie seed; migración aditiva e idempotente para instalaciones existentes (solo superficies creadas por `janus-core`). Destino adicional `infinity-chatbox-platform` (targetIndex 1) donde realmente corre el chat de la web; el destino original se conserva (índice 0). Manifiesto `infinity-group.release.json` publicado en `infinity/assistant-control-metadata` (commit `b9ad99a0`, checksum `03d74a8e…4663`, release `7485f058`). Falta: consumidor de esta superficie dentro de ChatBox (cambio de producto → requiere autorización).
2h. **IBA — estado según su propio registro (2026-10-11, `fix/iba-baseline-recovery-20260920@30c09c9b`)**: "listo para publicar en infinitybusinessassistant.nl"; 485/485 tests, build y E2E local 43/44 (único fallo: favicon IBA inexistente). Producción Vercel anterior sin cambios (`dpl_F1Tch…@cfc6d89`). Bloqueo por permisos: el Founder debe (1) promover el deploy `dpl_2FLY3ratQruEkWALyqJuqfAaT1hj` a producción en Vercel, (2) añadir el dominio `infinitybusinessassistant.nl` (+www), (3) configurar el DNS en Hostinger. NO VERIFICADO si esto ocurrió después del 11-oct (Vercel API 403/404; robots bloquea la web). El consumidor Janus de IBA existe en `janus/assistant-control-iba-consumer` (2026-09-30), aún no integrado en la rama canónica de IBA.
2i. **Buzón de estado de la web del Grupo dentro de ChatBox (2026-10-13, autorizado por el Founder por voz)**: PR borrador `jeanechandia-png/infinity-chatbox-platform#80` (rama `feat/assistant-control-infinity-group-status-20261013` @ `710ceafa`, base release `7485f058`) añade `GET /api/v1/assistant-control/infinity-group/status` (solo lectura, solo metadatos; ruta ChatBox existente sin cambios). Verificado local: 382/382 tests, build, runtime 9/9, security 38/38, secret scan, tsc; GET 200 `missing`, POST 405. NO fusionado ni publicado. Cuando el Founder autorice publicar ese SHA exacto y responda en producción, añadir a `DEFAULT_ASSISTANT_CONSUMER_STATUS_URLS`: `'landing.infinity-group': 'https://infinitychatbox.nl/api/v1/assistant-control/infinity-group/status'` (antes no: Janus no registra URLs que aún no existen en vivo).
2j. **Icono oficial de la app Janus (2026-10-13, elegido por el Founder)**: opción «Bloque 3 — Oro 3D cuadrado con halo» (Jano de dos caras, oro/bronce 3D, halo luminoso; generada con ElevenLabs seedream-5-pro, original 2048×2048 en el Drive del Founder, id `1i8mhFFYSqbblV1FwZUN-bjFFpr5dcd1K`). Renditions opacas (sin alfa, fondo negro) 180/192/512 en `apps/pwa/icons/`, conectadas en manifest, `apple-touch-icon`, hoja de instalación y shell offline (caché `janus-shell-v6`). Nombre del manifest sigue «JANUS». PENDIENTE: efecto de halo que se intensifica al tocar/hover (diseñado para ello, no implementado); el Founder debe quitar y volver a añadir el icono en iPhone (iOS cachea el icono al instalar). NO VERIFICADO: aspecto en un iPhone real.
2k. **Emblema vivo de Janus (2026-10-13/14)**: pieza reutilizable `apps/pwa/glow-emblem.js` + CSS `.glow-emblem` (inclinación 3D en perspectiva que sigue el dedo/cursor, reflejo especular que se desplaza por el metal, halo cinematográfico que se enciende al tocar/hover/foco y se apaga ~0,65 s después; respeta `prefers-reduced-motion`; decorativo, sin botón falso). Montado en la cabecera de la PWA (caché `janus-shell-v7`). Verificado con Chromium emulando iPhone 15 Pro Max: reposo → toque (halo/reflejo 1, inclinación ~8–10°) → soltar (vuelve a 0), sin errores de consola; 226/226 tests. NO VERIFICADO: sensación en iPhone físico y rendimiento en dispositivos antiguos. Reutilizable para ChatBox/IBA/web pasando su propia imagen.
2l. **Reconciliación de PR antiguas (2026-10-14)**: #6 (coding+agentic expertise) y #5 (Identity & Presence) estaban `dirty` contra `main` (CI verde). Contenido reaplicado sobre `main` actual en PR borrador **#29** (182→184/184 tests, tsc limpio) y **#30** (182/182, ADR renumerado ADR-006→ADR-008 por colisión con ADR-006/007 de main). #6/#5 NO se cierran; quedan superadas al fusionar. **#13** (confianza calibrada) NO reconciliada: `main` ya trae el prior calibrado de #14 (fusionada 2026-09-30) pero no los modos `drift_adjusted_recent`/`calibrated_history` de #13; choca en 6 archivos (server.ts, runtime-outcome-learning.ts, tests) → requiere port manual cuidadoso, POR CONFIRMAR si aún se desea.
2m. **Esfuerzo adaptativo ECO/NORMAL/PROFUNDO/MÁXIMO/AUTO (2026-10-14, rama `janus/adaptive-effort-20261014`)**: `packages/core/src/effort-policy.ts` (determinista, local, sin modelo): riesgo (bajo/alto/crítico) + complejidad + coste → nivel y presupuesto (llamadas de modelo, pasadas de verificación, agentes en paralelo, revisores, investigación fresca). Reglas: AUTO nunca elige MÁXIMO (gasto solo por decisión explícita); suelo de riesgo NORMAL (ECO del Founder se sube y se informa); riesgo crítico exige confirmación humana; modo ahorro limita a NORMAL solo si el riesgo es bajo; el esfuerzo nunca relaja autoridad/aprobación/auditoría. Runtime: `POST /api/command` acepta `effort` y devuelve la decisión; receipt `effort_selection`; metadata en el mensaje. PWA: selector con AUTO por defecto, recordado por dispositivo, muestra nivel/riesgo. Verificado: 234/234 tests, smoke runtime OK, navegador iPhone 15 Pro Max sin errores ni desbordes. PENDIENTE: que el planner/TaskRunner/Model Router CONSUMAN el presupuesto (hoy queda registrado y visible, aún no limita llamadas); comando de voz usa AUTO.
2n. **El presupuesto de esfuerzo ya se aplica (2026-10-14)**: pieza reutilizable `packages/gateways/src/budgeted-model-gateway.ts` envuelve cualquier adaptador de modelo y corta llamadas por encima del presupuesto ANTES de llegar al proveedor (sin gasto), acumulando tokens para auditoría. El planner usa por ejecución `maxModelCalls` y `maxPlanSteps` del nivel (ECO 1/8, NORMAL 3/20 = antiguo valor fijo, PROFUNDO 8/20, MÁXIMO 20/30) y recibe la guía del nivel en su contexto. Si la tarea no cabe, NO se trunca: bloqueo con 2 alternativas (subir esfuerzo / dividir tarea) y receipt con uso del modelo. Verificado e2e con proveedor simulado (plan de 12 pasos): ECO → bloqueo «subir esfuerzo», 1 llamada, tokens registrados; NORMAL acepta el tamaño (falló solo por el formato del plan de prueba). **Lección**: `apps/**` no estaba en `tsconfig` → `npm run typecheck`/CI no comprobaba `server.ts`; había 1 error de tipo previo (`delivery.error` posiblemente undefined, de ec29c58). Corregido e incluido `apps/**` en el typecheck. 237/237 tests, smoke OK. PENDIENTE: verificación/revisores/agentes paralelos aún no consumen `verificationPasses`/`reviewers`/`parallelAgents`.
2o. **ChatGPT, Claude, Gemini, Asana, Vercel y Runway (2026-10-14, rama `janus/external-integrations-20261014`)**: ver `docs/integrations.md`. Modelos: adaptador nativo de Claude (Messages API), Gemini vía ruta compatible OpenAI (`chatPath`), ChatGPT por Chat Completions; `resolveModelProviders` (solo con llave+modelo, sin ids inventados, local primero, `JANUS_MODEL_ORDER`) y `FallbackModelRouter` (relevo entre proveedores, nunca alrededor del presupuesto). Herramientas: `AsanaAdapter` (lectura + `task.create`), `VercelAdapter` (solo lectura), `RunwayAdapter` (créditos, estado de tarea, `image.create`/`video.create`), helper `http-json` (timeout, tamaño, sin redirecciones). **Política de acciones sensibles**: escrituras externas y generaciones de pago siempre a aprobación explícita, aunque el planificador las marque como bajo riesgo (receipt `sensitive_action_policy`). Verificado: 244/244 tests (7 nuevos con servicios simulados), smoke OK, e2e con planificador simulado: plan Runway aceptado → forzado a aprobación → autoridad lo bloquea → Runway NO se llama. **Lecciones**: (1) la variable de la base de datos es `JANUS_DB`, no `JANUS_DB_PATH`; mis e2e anteriores usaron `data/janus.db` (local, ignorada por git, solo sandbox; limpiada). (2) En instalaciones existentes, las herramientas nuevas requieren una revisión del Blueprint aprobada por el Founder: intencionado. NO VERIFICADO: llamadas reales (sin credenciales). PENDIENTE: aprobación interactiva en la PWA.
2p. **Google Workspace (escritura), Kling AI, Perplexity y n8n (2026-10-14, misma rama/PR #32)**: `PerplexityAdapter` (Agent API `/v1/agent`: respuesta+citas+fuentes+coste; Sonar Chat Completions terminó 2026-09-27 según sus docs) y Perplexity como proveedor de modelo (router compatible OpenAI); `KlingAdapter` (API Key Bearer, `api-singapore.klingai.com`, `/text-to-video/kling-3.0`, `/tasks?task_ids=` POR CONFIRMAR); `N8nAdapter` (`X-N8N-API-KEY`, workflows/ejecuciones con cursor; disparo solo por webhooks autorizados por nombre); `GoogleWorkspaceWriteAdapter` separado con token propio (`gmail.compose`, `calendar.events`): borradores de Gmail (nunca envía, cabeceras anti-inyección) y eventos de Calendar (sin avisar a invitados por defecto). Todas las escrituras/gastos nuevos en la política de acciones sensibles. 250/250 tests, smoke OK. NO VERIFICADO: llamadas reales.
2q. **Netlify y Supabase (2026-10-14, PR #32)**: Netlify lectura ampliada de forma aditiva (`sites.list`, `deploys.list`, `deploy.get`; la comprobación `site.published_deploy` que usa el gestor de releases no cambia) y `NetlifyReleaseAdapter` separado (`deploy.restore`, token propio `NETLIFY_RELEASE_TOKEN`, solo sitios en `JANUS_NETLIFY_RELEASE_SITES`, aprobación obligatoria). `SupabaseManagementAdapter` de solo lectura (proyectos, salud por servicio, asesores de seguridad/rendimiento, historial de migraciones); sin SQL ni datos de tenants. Fuentes: `@netlify/open-api` 2.60.0, Supabase Management API docs + `supabase-management-js` 2.0.2. 253/253 tests, smoke OK. NO VERIFICADO con cuentas reales.
2r. **Aprobaciones del Founder (2026-10-14, rama `janus/founder-approvals-20261014`)**: ver `docs/founder-approvals.md`. Cola de aprobaciones (espera real, una sola decisión, caducidad, cancelación, recibos `founder_approval`), API `GET /api/approvals` y `POST /api/approvals/{id}/decision` (solo Founder), aceptación aditiva de firmas P1363 (WebCrypto) en el login existente, y panel PWA: vincular dispositivo (llave P-256 no exportable en IndexedDB), entrar/salir como Founder, lista con Aprobar/Rechazar; los comandos de la PWA van autenticados cuando hay sesión. Verificado: 258/258 tests, smoke OK; e2e servidor (sin auth → 401; acción Runway en `waiting_approval`; rechazar → bloqueada; aprobar → continúa y llega a llamar a Runway, que falla solo por llave falsa/red del sandbox; segunda decisión → 409); e2e navegador iPhone 15 Pro Max (vincular → llave no exportable → registrar → entrar → acción pendiente con insignia → Rechazar → lista vacía → salir; sin errores ni desbordes). NO VERIFICADO en tu iPhone real (requiere HTTPS de confianza hacia Janus).
2s. **Permitir herramientas nuevas desde la app (2026-10-14, PR #33)**: `packages/core/src/blueprint-tool-sync.ts` (diferencial + nueva revisión vía propuesta→borrador verificado→aplicar; solo añade; si el Blueprint referencia acciones no registradas lo reporta y no reduce en silencio), `GET/POST /api/learning/blueprints/tool-sync` (POST solo Founder, `confirmAction` + `expectedRevision`), recuadro PWA con dos toques. e2e en instalación existente simulada (DB creada con la versión previa `51c10ec`): revisión 1 → 28 acciones nuevas en 10 herramientas → sin login 401 → Founder confirma → revisión 2 activa, 1 histórica, recuadro desaparece, sin errores ni desbordes. 262/262 tests, smoke OK.
2t. **Fusión y puesta en marcha (2026-10-14, autorizado por el Founder)**: `main` avanzó de `8289bd8` a `aaeb6b9` con la pila #27→#28→#31→#32→#33 (fast-forward) y merges explícitos de #29 y #30 (conflictos solo en STATE.md, resueltos conservando ambos lados). Verificado antes de publicar: tsc, 270/270, smoke, sintaxis PWA; 0 archivos borrados; CI de `main` en verde. Copia de seguridad: rama `backup/main-before-20261014-merge` → `8289bd8` (el proxy no permite publicar etiquetas). Las 7 PR figuran como fusionadas; #6 y #5 cerradas como superadas (con nota, ramas intactas). Después: `.env.example` (solo nombres), `npm run integrations:check` (no muestra valores) y `npm run start:local` (carga `.env.local`, ignorado por git); 273/273 tests.
3. Añadir local content-addressed Asset Store para binarios/archivos de la LEGO Library y deduplicación por hash/similitud antes de crear una pieza nueva.
4. Añadir usage graph Producto/Proyecto -> reusable item@revision para impact analysis y upgrades seguros.
5. Integrar Model Router multi-model real para ejecutar provider/capability alternatives automáticamente y registrar routing, calidad/costo/latencia y confianza.
6. Completar coordinación con agenda/availability por operador y selección de siguiente operador sin compartir credenciales privadas.
7. Crear vista PWA mobile-first de coordinación: tarea, scope, handoff, blocker alternatives, próximos pasos y resume point.
8. Crear reviewers productivos de las seis dimensiones vía Model Router cuando convenga.
9. Conectar Flow Automation Engine productivamente a TaskRunner/Tool Gateway/Model Router.
10. Persistir workflow definitions/revisions/node state/execution checkpoints.
11. Implementar error branches, waits y approvals completos sobre runtime durable.
12. Añadir simulation/dry-run/replay antes de external writes.
13. Importadores/adapters para chats históricos externos sin convertirlos en autoridad.
14. Conectar `expertisePolicy` (PR #6, ya integrada) al planner/runtime para insertar investigación fresca cuando el conocimiento técnico esté vencido y bloquear entrega si faltan verificaciones obligatorias.
15. Conectar Presence Session (PR #5, ya integrada) al Authority Control Plane para elevar sesiones autenticadas a strong/root.
16. Implementar Face Adapter local productivo: enrollment, embedding protegido, 1:1 match y liveness.
17. Implementar trusted-device binding y PIN/recovery factor en secure storage.
18. Añadir UI mobile-first de enrollment, unlock, re-auth y recuperación.

### P1
- Vision Adapter multimodal: cámara, imagen, vídeo y documentos.
- Office Agent: DOCX/XLSX/PPTX/PDF con validación.
- Research Agent: investigación actual, evidencia y Citation Ledger.
- Builder Agent: plan -> código -> test -> validación -> deploy con aprobación.
- Learning Agent: tutoría adaptativa y ejercicios.
- Visual Workflow Editor mobile-first/desktop con canvas de nodos, conexiones, inspección y ejecución paso a paso.
- Biblioteca visual/productiva en PWA para buscar, previsualizar, importar y componer reusable items y Skills/Subflows versionados.
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

## Handoff 2026-10-18 (Claude): Séneca + voz + LEGO

- HECHO VERIFICADO: módulos `seneca-wisdom` y `speaker-id` en `packages/modules/`, adaptadores finos, hook genérico de pista de hablante en `packages/voice`, política de perfil restringido, ruta determinista del planificador, CLI `scripts/voice-enroll.ts`. 307/307 pruebas y typecheck limpios.
- POR CONFIRMAR: calibración del modelo de voz y ejecución real del sidecar; muestras reales de Jean y Kendra; aprobación del Blueprint con la herramienta `seneca`; esquemas de cuerpo de Hostinger.
- 2026-10-18 (tarde): módulo `marcus-aurelius-wisdom` + herramienta `marcus-aurelius` añadidos (313/313 pruebas). Citas contrastadas con Long; locus libro.sección estándar no visible en la fuente (POR CONFIRMAR); griego no consultado.
- Rama `claude/seneca-voice-lego`, apilada sobre `claude/execution-supabase-vercel` (PR #37).

## Handoff 2026-10-21 (Claude): Janus School + reconocimiento del hogar + filtros de entrega + continuidad

- Rama `claude/school-gates-continuity` (PR #40, borrador), apilada sobre `claude/seneca-voice-lego` (#38) → `claude/execution-supabase-vercel` (#37) → `main` (`f713b74`).
- HECHO VERIFICADO (332/332 pruebas y typecheck limpio en esta rama):
  - Módulo LEGO `janus-school` (offline): ruta del Founder, glosario, cuestionarios, repaso espaciado SM-2 y sesiones de matemáticas/atención para un perfil infantil, con nivel de evidencia declarado y sin diagnóstico. Adaptador fino `janus-school-tool-adapter` y ruta determinista del planificador.
  - Módulo LEGO `face-id` (conjunto cerrado, bóveda AES-256-GCM, consentimiento con tutor para menores, sidecar InsightFace local), adaptador `face-recognition-adapter`, fusión de identidad voz+cara (`identity-fusion`), modo estricto y perfil restringido (`HOUSEHOLD_SAFE_TOOLS`), ruta `POST /api/identity/face`, CLI `scripts/face-enroll.ts`. Es comodidad, nunca autorización.
  - Filtros de entrega del Founder (estructural, ortográfico, síntesis, coherencia, i18n, estilo) en `DeliveryGate` con `FOUNDER_REQUIRED_DIMENSIONS`; `DeliveryPipeline` (recheck → vista previa navegable → decisión del Founder → paquete con archivo directo y texto en línea).
  - Continuidad: `npm run continuity`, `docs/PROJECT_MAP.md`, `START_HERE.md`, detección de colisiones de ADR (mi ADR de reconocimiento del hogar pasó a **ADR-011** por choque con #39).
  - Normas operativas del Founder cargadas como políticas en `config/founder-reference-library.json` y documentadas en `docs/operating-norms.md`.
- POR CONFIRMAR / NO HECHO:
  - Ningún modelo de voz ni de cara se ha ejecutado; umbrales sin calibrar; licencia de pesos de InsightFace sin verificar.
  - Faltan muestras reales de Jean y Kendra (inscripción en el equipo anfitrión).
  - Retención por segundo de reels vía API de Meta: no verificado y no implementado (depende de #36).
  - Mecanismo de actualización continua de conocimiento (registro de fuentes + frescura): no implementado.
  - `DeliveryPipeline` sin ruta HTTP ni panel en la PWA; progreso de Janus School en JSON local (migrar a SQLite); sin UI de cámara/inscripción (requiere autorización de Jean para tocar lo visual).
  - Revisores ortográficos heurísticos sin conexión; falta un corrector real como adaptador.
  - Edad de Kendra sin confirmar; aprobación de Blueprint pendiente para las herramientas `seneca`, `marcus-aurelius` y `janus-school` en instalaciones existentes.
- NO DUPLICAR: clonación de voz/cara (#39), panel y reels (#36), confianza de ejecución (#35/#13), verificación de voz 1:1 (`candidate/voice-identity-module`).
- Prompt de relevo para ChatGPT/Codex: `docs/handoffs/2026-10-21-chatgpt-codex-prompt.md`.

## PRÓXIMO

Handoff 2026-10-13 (Claude, sesión Cowork): PR #28 apilada sobre #27 (custodia del HEAD + smoke hermético), CI GitHub `success`. Siguiente acción ejecutable: (1) Founder confirma la release ChatBox vigente y se refresca su manifiesto; (2) implementar el probe automático de acknowledgement (2d); (3) verificar/crear manifiestos de Group e IBA.

Cerrar consumidores + punteros de release productivos:

**Janus profile -> resolved surface bundle -> verified release manifest -> verified repository publish -> product loader -> runtime health reports bundleChecksum -> Janus verifies acknowledgement -> applied.**

No considerar una landing actualizada solo porque el bundle llegó al repositorio. El estado live exige evidencia del runtime consumidor. Después de cerrar los tres consumidores, continuar Asset Store + usage graph + Model Router multi-model.

## Regla de continuidad

Este documento representa el VIGENTE de esta rama. Git y la cronología local preservan el HISTÓRICO. Antes de ejecutar trabajo nuevo, Janus sincroniza código/pruebas + cronología + Error Ledger + Blueprints + outcomes + estado vigente. Si existe contradicción, PRESENTE gobierna ejecución y PASADO se conserva para aprendizaje y previsión.
