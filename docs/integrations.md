# Integraciones externas de Janus (2026-10-14)

Janus Core manda; cada servicio es un **adaptador reemplazable**.

**Puesta en marcha en el equipo de Janus:** `cp .env.example .env.local` → rellenar solo lo que quieras activar → `npm run integrations:check` (dice qué falta, nunca muestra valores) → `npm run start:local`. `.env.local` está ignorado por git. Los secretos van solo en variables de entorno (nunca en SQLite, código, recibos ni logs). Endpoints verificados el 2026-10-14 contra la documentación oficial de cada proveedor.

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
| Supabase (escritura, nuevo) | `SUPABASE_WRITE_ACCESS_TOKEN` + `JANUS_SUPABASE_WRITE_PROJECTS` (refs permitidos) | `migration.apply`, `sql.execute` | **cambia la base de datos → aprobación explícita**; SQL destructivo (DROP, TRUNCATE, DELETE/UPDATE sin WHERE) se rechaza salvo `allowDestructive: true` aprobado; `sql.execute` **nunca devuelve filas** (solo recuento y nombres de columnas) |
| Vercel (release, nuevo) | `VERCEL_RELEASE_TOKEN` + `JANUS_VERCEL_RELEASE_PROJECTS` (nombres permitidos) | `deployment.redeploy` | **puede cambiar producción → aprobación explícita**; solo proyectos autorizados |
| Hostinger (lectura, nuevo) | `HOSTINGER_API_TOKEN` (hPanel) | `websites.list` | solo lectura |
| Hostinger (publicar/modificar webs, nuevo) | `HOSTINGER_RELEASE_TOKEN` + `JANUS_HOSTINGER_SITES` = `{"dominio.com":"usuario_hosting"}` | `site.deploy` (sube un sitio estático como ZIP y lo despliega en el dominio) | **cambia un sitio en vivo → aprobación explícita**; solo dominios del mapa; exige `index.html` en la raíz; rechaza `.env`, `.git`, claves y rutas con `..` |
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

### Ejecución (2026-10-16)
- Supabase: `POST /v1/projects/{ref}/database/migrations` (body `query`, `name`) y `POST /v1/projects/{ref}/database/query` (Supabase lo documenta como **experimental**). Verificado contra su documentación el 2026-10-16.
- Vercel: `POST /v13/deployments?forceNew=1` con `deploymentId` (redeploy de un despliegue existente). Verificado contra su documentación el 2026-10-16.
- Las acciones nuevas son privilegiadas en el Tool Gateway (clave de idempotencia + permiso de autoridad auditado) y la política las fuerza a aprobación aunque el planificador diga lo contrario.
- **POR CONFIRMAR (no implementado a propósito):** activar/desactivar flujos de n8n por API y promover despliegues en Vercel — no pude verificar esos endpoints en la documentación oficial. n8n ya ejecuta flujos mediante webhooks autorizados (`workflow.trigger`).
- Instalaciones existentes: las herramientas nuevas requieren una revisión del Blueprint (Permitir herramientas nuevas) antes de que el planificador las use.

### Hostinger (2026-10-16)
- Flujo (docs.hostinger.com + repo oficial `hostinger/api-mcp-server`): `POST /api/hosting/v1/files/upload-urls` → subida TUS 1.0.0 del ZIP a `public_html` (cabeceras `X-Auth`, `X-Auth-Rest`) → `POST /api/hosting/v1/accounts/{username}/websites/{domain}/deploy`.
- Janus recibe el contenido como `files: {"index.html": "…", "css/site.css": "…"}` (y `binaryFiles` en base64 para imágenes), construye el ZIP él mismo y lo publica. **Modificar una web actual = volver a publicarla con los archivos corregidos.**
- **POR CONFIRMAR (sin inventar):** las páginas públicas de la documentación no muestran el esquema del cuerpo de dos llamadas y el OpenAPI no se pudo descargar desde este entorno (host bloqueado). El adaptador envía `{username, domain}` a `upload-urls` y `{archive_path}` a `deploy`; si Hostinger responde 4xx, el mensaje de error vuelve tal cual y se corrige en dos constantes (`UPLOAD_URL_BODY`, `DEPLOY_BODY`). Tampoco se sabe si el despliegue **reemplaza** todo el sitio o extrae encima, ni si el ZIP queda dentro de `public_html`.
- No cubre: WordPress, Node.js, bases de datos ni limpiar la caché (endpoint no verificado); la primera prueba debe hacerse en un subdominio de pruebas.

### Pendiente
- ~~Flujo de aprobación interactivo en la PWA~~ → hecho: ver `docs/founder-approvals.md`.
- ~~Revisión del Blueprint para habilitar las nuevas herramientas~~ → hecho desde la app: ver `docs/founder-approvals.md` (el Founder debe confirmarla en su instalación).
- Pruebas con cuentas reales (nada de lo escrito aquí se ha probado contra Supabase/Vercel reales) (todo verificado con servicios simulados; no verificado contra las APIs reales).


## Séneca y reconocimiento de hablante (módulos LEGO)
- Herramienta `seneca` (solo lectura, local, sin credenciales): `guidance.get`, `profile.get`, `quote.get`, `reflection.daily`. En instalaciones existentes requiere una revisión de Blueprint aprobada por el Founder. Las citas llevan estado de verificación; la frase «liberarse del miedo a un mal futuro y del recuerdo de un mal pasado» se presenta como *atribuida, sin ubicar* (no como cita literal).
- Reconocimiento de hablante: opcional (`JANUS_SPEAKER_ID_ENABLED=true`), ver ADR-011 y `scripts/voice-enroll.ts`. `/health` expone `speakerRecognition.state`.
- Herramienta `marcus-aurelius` (mismas acciones, solo lectura): se enruta cuando se nombra a Marco Aurelio o las Meditaciones sin nombrar a Séneca; el resto de peticiones estoicas o de estrés sigue yendo a `seneca`. Fuente de las citas: traducción inglesa de G. Long (dominio público, classics.mit.edu); el español es versión libre y el griego no se consultó. «Tienes poder sobre tu mente, no sobre los acontecimientos externos…» figura como *atribuida, sin ubicar*. Requiere aprobación de Blueprint en instalaciones existentes y está permitida en el perfil restringido del hogar.
- Janus School (`janus-school`, solo lectura, offline): `lesson.next/get/complete`, `glossary.lookup`, `review.next/grade`, `quiz.get/answer`, `kids.session/technique/guide`, `progress.get`. Progreso mínimo en `JANUS_SCHOOL_PROGRESS_PATH` (por defecto `data/school-progress.json`; migrar a SQLite: PENDIENTE). Un aprendiz infantil solo accede a `kids.session`, `kids.technique` y `progress.get`.
- Reconocimiento facial del hogar: opcional (`JANUS_FACE_ID_ENABLED=true`, `JANUS_FACE_VAULT_KEY`, sidecar loopback), `POST /api/identity/face?sessionId=` con sesión autenticada; `JANUS_HOUSEHOLD_STRICT=true` restringe voces/caras no identificadas como propietario. `/health` expone `faceRecognition`. Ver ADR-011.
