# Integraciones externas de Janus (2026-10-14)

Janus Core manda; cada servicio es un **adaptador reemplazable**. Los secretos van solo en variables de entorno (nunca en SQLite, código, recibos ni logs). Endpoints verificados el 2026-10-14 contra la documentación oficial de cada proveedor.

## Modelos de IA (Model Gateway + Model Router)

| Proveedor | Variables (llave + modelo) | Protocolo |
|---|---|---|
| Modelo local / compatible OpenAI (ya existente) | `JANUS_MODEL_BASE_URL`, `JANUS_MODEL_NAME`, `JANUS_MODEL_API_KEY` | Chat Completions |
| ChatGPT (OpenAI) | `JANUS_OPENAI_API_KEY`, `JANUS_OPENAI_MODEL` | `https://api.openai.com/v1/chat/completions` |
| Claude (Anthropic) | `JANUS_ANTHROPIC_API_KEY`, `JANUS_ANTHROPIC_MODEL` | Messages API nativa `https://api.anthropic.com/v1/messages` (`anthropic-version: 2023-06-01`) |
| Gemini (Google) | `JANUS_GEMINI_API_KEY`, `JANUS_GEMINI_MODEL` | Compatible OpenAI `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |
| Perplexity | `PERPLEXITY_API_KEY`, `JANUS_PERPLEXITY_MODEL` | Compatible OpenAI `https://api.perplexity.ai/router/v1/chat/completions` |

- Un proveedor solo se activa con **llave y nombre de modelo**. Janus no inventa ni fija ids de modelo.
- Orden: local primero; `JANUS_MODEL_ORDER=gemini,openai,…` lo cambia. Si un proveedor falla, el router pasa al siguiente y lo deja registrado. El presupuesto de esfuerzo **nunca** se esquiva con el relevo.
- `GET /health` → `credentials.modelProviders` / `modelRoute` (sin secretos).

## Herramientas (Tool Gateway)

| Servicio | Variable | Acciones | Tipo |
|---|---|---|---|
| Asana | `ASANA_ACCESS_TOKEN` (PAT) | `workspaces.list`, `projects.list`, `tasks.list` | lectura |
| Asana | idem | `task.create` | **escritura → aprobación explícita** |
| Vercel | `VERCEL_TOKEN` (+ opcional `VERCEL_TEAM_ID`) | `deployments.list`, `deployment.get` | solo lectura (no despliega, no promueve, no toca dominios) |
| Runway | `RUNWAYML_API_SECRET` (+ opcional `RUNWAY_API_VERSION`, por defecto `2024-11-06`) | `organization.read` (créditos), `task.get` | lectura |
| Runway | idem | `image.create` (text_to_image), `video.create` (image_to_video) | **gasta créditos → aprobación explícita** |
| Perplexity | `PERPLEXITY_API_KEY` | `research.ask` (Agent API: respuesta + citas + fuentes + coste) | lectura; el contenido web es **dato, no orden** |
| Kling AI | `KLING_API_KEY` (+ opcional `KLING_DEFAULT_MODEL`, por defecto `kling-3.0`) | `task.get` | lectura |
| Kling AI | idem | `video.create` (texto → vídeo) | **gasta créditos → aprobación explícita** |
| n8n | `N8N_BASE_URL` (https) + `N8N_API_KEY` | `workflows.list`, `executions.list`, `execution.get` | lectura (la API de n8n no existe en la prueba gratuita) |
| n8n | `JANUS_N8N_WEBHOOKS` = `{"nombre":"https://…"}` | `workflow.trigger` (solo webhooks autorizados por nombre) | **acción externa → aprobación explícita** |
| Netlify (ya existente, ampliado) | `NETLIFY_AUTH_TOKEN` | `site.published_deploy`, `sites.list`, `deploys.list`, `deploy.get` | solo lectura |
| Netlify (release, nuevo) | `NETLIFY_RELEASE_TOKEN` + `JANUS_NETLIFY_RELEASE_SITES` (ids permitidos) | `deploy.restore` (volver a un despliegue anterior) | **cambia producción → aprobación explícita**; solo sitios autorizados |
| Supabase | `SUPABASE_ACCESS_TOKEN` | `projects.list`, `project.health`, `advisors.security`, `advisors.performance`, `migrations.list` | solo lectura; **nunca SQL ni datos de clientes** |
| Google Workspace (ya existente) | `GOOGLE_ACCESS_TOKEN` (solo lectura) | `drive.files.search`, `gmail.messages.search`, `calendar.events.list` | lectura |
| Google Workspace (escritura, nuevo) | `GOOGLE_WRITE_ACCESS_TOKEN` (scopes `gmail.compose`, `calendar.events`) | `gmail.draft.create` (**solo borrador, nunca envía**), `calendar.event.create` (sin avisar a invitados salvo `notifyGuests`) | **escritura → aprobación explícita** |

### Garantías
- **Política de acciones sensibles** (`packages/orchestrator/src/sensitive-action-policy.ts`): tras planificar y antes de ejecutar, `asana.task.create`, `runway.image.create`, `runway.video.create` y `github.file.publish` quedan en riesgo alto, irreversibles y con aprobación obligatoria, aunque el planificador diga lo contrario. Además, sus nombres las hacen privilegiadas en el TaskRunner (autoridad autenticada) y las escrituras exigen clave de idempotencia.
- **Gobernanza del Blueprint**: en una instalación existente, el Blueprint activo guarda la lista de herramientas permitidas. Las nuevas (Asana, Vercel, Runway) aparecen como capacidades, pero el planificador **no** las usa hasta que el Founder apruebe una nueva revisión del Blueprint. En una base nueva entran en la semilla. Es intencionado: ninguna herramienta nueva se activa sola.
- Las URLs de salida de Runway caducan en 24–48 h; hay que guardarlas si se necesitan.
- Perplexity: según su documentación, el soporte de Sonar Chat Completions terminó el 2026-09-27; por eso la investigación usa la Agent API (`/v1/agent`).
- Kling AI: su documentación exige autenticación por API Key (Bearer); el método antiguo Access Key/Secret Key (JWT) no se implementa. La forma `GET /tasks?task_ids=` sale de la tabla de parámetros, no de un ejemplo: **por confirmar** con una llamada real.
- Gmail: los correos se crean como **borrador**; Janus no envía correos. Cabeceras protegidas contra inyección (saltos de línea).
- Netlify: verificado contra la especificación oficial `@netlify/open-api` 2.60.0. La lectura y la «vuelta atrás» usan llaves distintas: la de lectura nunca puede cambiar producción.
- Supabase: Management API (`https://api.supabase.com/v1`, 120 peticiones/min). Un token personal da acceso amplio a la cuenta, por eso el adaptador solo tiene peticiones GET de salud, asesores y migraciones: los datos de los clientes (tenants) nunca pasan por Janus.
- n8n: Janus nunca dispara URLs arbitrarias; solo los webhooks que el Founder nombra en `JANUS_N8N_WEBHOOKS`.

### Pendiente
- ~~Flujo de aprobación interactivo en la PWA~~ → hecho: ver `docs/founder-approvals.md`.
- Revisión del Blueprint para habilitar las nuevas herramientas en la instalación del Founder.
- Pruebas con cuentas reales (todo verificado con servicios simulados; no verificado contra las APIs reales).
