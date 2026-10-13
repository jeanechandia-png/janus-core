# Integraciones externas de Janus (2026-10-14)

Janus Core manda; cada servicio es un **adaptador reemplazable**. Los secretos van solo en variables de entorno (nunca en SQLite, código, recibos ni logs). Endpoints verificados el 2026-10-14 contra la documentación oficial de cada proveedor.

## Modelos de IA (Model Gateway + Model Router)

| Proveedor | Variables (llave + modelo) | Protocolo |
|---|---|---|
| Modelo local / compatible OpenAI (ya existente) | `JANUS_MODEL_BASE_URL`, `JANUS_MODEL_NAME`, `JANUS_MODEL_API_KEY` | Chat Completions |
| ChatGPT (OpenAI) | `JANUS_OPENAI_API_KEY`, `JANUS_OPENAI_MODEL` | `https://api.openai.com/v1/chat/completions` |
| Claude (Anthropic) | `JANUS_ANTHROPIC_API_KEY`, `JANUS_ANTHROPIC_MODEL` | Messages API nativa `https://api.anthropic.com/v1/messages` (`anthropic-version: 2023-06-01`) |
| Gemini (Google) | `JANUS_GEMINI_API_KEY`, `JANUS_GEMINI_MODEL` | Compatible OpenAI `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` |

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

### Garantías
- **Política de acciones sensibles** (`packages/orchestrator/src/sensitive-action-policy.ts`): tras planificar y antes de ejecutar, `asana.task.create`, `runway.image.create`, `runway.video.create` y `github.file.publish` quedan en riesgo alto, irreversibles y con aprobación obligatoria, aunque el planificador diga lo contrario. Además, sus nombres las hacen privilegiadas en el TaskRunner (autoridad autenticada) y las escrituras exigen clave de idempotencia.
- **Gobernanza del Blueprint**: en una instalación existente, el Blueprint activo guarda la lista de herramientas permitidas. Las nuevas (Asana, Vercel, Runway) aparecen como capacidades, pero el planificador **no** las usa hasta que el Founder apruebe una nueva revisión del Blueprint. En una base nueva entran en la semilla. Es intencionado: ninguna herramienta nueva se activa sola.
- Las URLs de salida de Runway caducan en 24–48 h; hay que guardarlas si se necesitan.

### Pendiente
- Flujo de aprobación interactivo en la PWA (hoy, sin aprobación, las acciones sensibles quedan **bloqueadas** de forma segura).
- Revisión del Blueprint para habilitar las nuevas herramientas en la instalación del Founder.
- Pruebas con cuentas reales (todo verificado con servicios simulados; no verificado contra las APIs reales).
