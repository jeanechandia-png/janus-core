# JANUS — Entrega incremental: proyectos permanentes y plantilla laboral (10-nov-2026)

Repositorio canónico: `jeanechandia-png/janus-core`.
Rama continuada (NO nueva): `chatgpt/janus-approved-characters-integration-20261106`.
Base leída: `551179e8402b5810276a796a906f5b2ccff611fc`.

## Hechos identificados antes de modificar
- Ya existían ProjectWorkspace/threads/resources/checkpoints en SQLite y rutas `/api/projects` en Core.
- Ya existían la coordinación de operadores/scopes/assignments/handoffs, Agent Swarm y adaptadores configurables OpenAI/Anthropic/Gemini.
- `prototypes/dashboard/src/projects.js` es aún un catálogo de demostración. La PWA visual y las escenas aprobadas no se reemplazaron.
- `/api/attachments` almacenaba archivos del Founder sin enlace explícito de carga a un proyecto.

## Cambio de código de esta sesión
1. Campo `instructions` persistente en ProjectWorkspace, con límite de 12.000 caracteres, y snapshot de instrucciones en el checkpoint de nuevos hilos.
2. `POST /api/projects` permite instrucciones iniciales solamente del Founder; `PUT /api/projects/:id/instructions` exige sesión autenticada del Founder. El planner recibe nombre, descripción e instrucciones de proyecto.
3. `POST /api/attachments` enlaza una carga del Founder a proyecto/hilo vía cabeceras `x-attachment-project-id` y `x-attachment-thread-id`, manteniendo los bytes en el almacén protegido, no en GitHub. Las referencias de origen `upload` se validan contra la propiedad del adjunto.
4. Contrato de plantilla laboral reutilizable `buildReusableWorkDashboard`: selecciona texto y locale ES/NL/EN por perfil de operador, filtra tareas propias y bloquea voz, compras y autorizaciones. Expuesto mediante `GET /api/dashboard/work` autenticado. El registro de operador admite `locale`.
5. Pruebas unitarias nuevas sobre instrucciones y separación de la plantilla.

## Estado y siguientes acciones
- Los cambios son en **backend y contrato reutilizable**, no un dashboard laboral terminado ni desplegado. No se sustituyó el diseño Founder ni Kendra.
- **Pendiente:** integrar la plantilla en las vistas A/B existentes con reutilización visual, login de operadores y E2E iPhone/desktop; diseñar editor/selector de proyectos en UI que use estas rutas.
- **Pendiente:** cargas desde operadores/lectura multiusuario de binarios con control de acceso propio; en esta etapa el endpoint de carga y descarga sigue Founder-only.
- **Pendiente:** conectar ejecutores externos de Claude/ChatGPT/Gemini con cuentas empresariales autorizadas, control de costes y memoria compartida verificada. El catálogo de proveedores y el swarm no equivalen a ejecución automática de varios modelos en paralelo.
- **Pendiente:** ejecutar CI y pruebas E2E completas tras el commit; ninguna publicación ni compra queda autorizada por este cambio.
- Seguridad: `janus-core` es público, por lo tanto nunca alojar allí conversaciones privadas, archivos, claves o identidades reales.
