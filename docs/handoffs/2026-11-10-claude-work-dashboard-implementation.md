# Handoff — JANUS Work: plantilla laboral reutilizable (Claude, 10-nov-2026)

Responde a `docs/handoffs/2026-11-10-claude-workforce-dashboard-directive.md`.
Rama: `claude/work-dashboard-template`, creada sobre `chatgpt/janus-approved-characters-integration-20261106` @ `72e1776`.
**No fusionada, no desplegada, no publicada.** Pendiente de aprobación visual del CEO.

## Qué había (HECHO VERIFICADO)

- `01228836` (ChatGPT): contrato `buildReusableWorkDashboard`, `GET /api/dashboard/work`, instrucciones permanentes
  de proyecto (solo Founder), vinculación de recursos, operadores delegados con llave de dispositivo. Sin interfaz.
- Dashboard personal aprobada del CEO: Artifact «Janus Dashboard» (actualizado 04-nov-2026) = build `--artifact`
  de `prototypes/dashboard` en la rama `claude/companion-escena-3d` @ `c71bcd2` (comparación byte a byte: idéntico
  salvo el envoltorio que añade la plataforma). No se ha tocado.

## Qué se ha añadido

1. **Una sola plantilla** `prototypes/dashboard/work/` (`work-app.js`, `work-i18n.js`, `work-example.js`,
   `work-extra.css`, `build-work.cjs`). Julio, Robin, Mariel o cualquier alta futura usan el MISMO archivo; cambia
   solo su perfil (identidad, idioma, funciones, instrucciones) y sus permisos. No hay código por persona.
2. **Diseño = dashboard de IBA** (decisión del CEO, 10-nov). Se usan sus clases `cc-*` sin modificar. El CSS vive en
   el repo PRIVADO `infinity-chatbox-platform` y este repo es PÚBLICO, así que **no se copia**: `skin.lock.json` fija
   repositorio, commit `06da714`, ruta y SHA-256; el build lo lee de `prototypes/dashboard/local/` (fuera de Git) o de
   `JANUS_WORK_SKIN_CSS`. Sin piel verificada el build falla y `/work` responde 503: nunca se sirve otro diseño.
3. **Selector de idioma con los medallones 3D aprobados** (ES · NL · EN), componente compartido
   `janus-language-button`; arte en `apps/pwa/language-art/*-192.webp` (192 px, generado de los originales del CEO con
   transparencia). Conservan su 3D y reflejos; al tocar se iluminan con halo y un barrido de luz.
4. **Ruta `/work`** en el runtime + `apps/pwa/work.webmanifest` (instalable como app). Acceso con la llave del
   dispositivo (misma `founder-session.js` de la PWA): sin contraseñas; el CEO autoriza la llave pública.
5. **Contrato ampliado** (`work-dashboard-template.ts`): perfil (cargo, funciones, instrucciones individuales),
   proyectos con instrucciones, punto exacto de continuación, próximos pasos, decisiones, errores y metadatos de
   archivos; entregas propias; sesiones; `capabilities` (voz siempre `false`) y `reservedToCeo`.
6. **Registro de sesiones** (`work-session.ts`, tabla `work_session_events`, append-only): inicio, pausa, reanudar,
   avance, bloqueo, entrega, fin. Lo declara la persona; la hora la pone el servidor; no hay vigilancia del equipo.
7. **Endpoints nuevos:** `PUT /api/dashboard/work/locale` (propia persona) ·
   `PUT /api/coordination/operators/:id/profile` (solo Founder) · `GET /api/work/sessions` ·
   `POST /api/work/sessions/events` · `POST /api/work/attachments` (**en reposo**: 403 salvo
   `JANUS_WORK_OPERATOR_UPLOADS=on`).
8. **Pasarela de modelo v1.2** (aditivo): reenvía `projectId/threadId/assignmentId` a `/api/command` si son válidos.
   Sin esos campos el cuerpo es idéntico al anterior; las dashboards A/B no cambian de comportamiento.

## Actualización 10-nov-2026 (tarde) — decisiones del CEO y segunda entrega

Decisiones del CEO: JANUS solo lleva ES/NL/EN (sin turco: es producto interno, no de venta) · los colaboradores
SÍ adjuntan y descargan archivos, siempre dentro de sus proyectos autorizados · las altas reales de personas quedan
aparcadas (no son tarea de Claude).

9. **Archivos para colaboradores (activo):** `POST /api/work/attachments` pasa a estar ENCENDIDO por defecto
   (`JANUS_WORK_OPERATOR_UPLOADS=off` lo apaga). Nuevo `GET /api/work/files/:resourceId`: descarga solo si la persona
   puede leer ESE proyecto (404 uniforme para ajeno o inexistente). El CEO descarga lo que sube su equipo. En el panel:
   Adjuntar archivo (varios), Hacer foto, Descargar.
10. **Lector de códigos:** se reutiliza el LEGO `janus-attach` + `vendor/jsqr` sin modificarlos. Lee **QR**; el texto
    leído se añade al mensaje como dato y nunca se abre solo. **Códigos de barras 1D (EAN, Code 128): NO** todavía
    (el lector actual es solo QR; requiere añadir un decodificador). El lector conserva su piel dorada y sus textos en
    español.
11. **Agente por tarea:** `preferredProvider` en la asignación (`anthropic` Claude · `openai` ChatGPT · `gemini` ·
    `perplexity` · `custom` local). Lo fija solo el Founder (al crear la tarea o con
    `PUT /api/coordination/assignments/:id/provider`). `FallbackModelRouter.withPreference()` pone ese agente primero y
    deja el resto de respaldo; un rechazo por presupuesto no se esquiva. Sin credencial configurada la preferencia se
    guarda pero no actúa (la respuesta lo dice: `configured:false`).
12. **Límite diario por colaborador:** tabla `operator_run_usage` (durable). `JANUS_OPERATOR_DAILY_RUNS` (60 por
    defecto; 0 = sin límite). Al superarlo `/api/command` responde 429 `operator_daily_limit`. El Founder no tiene
    límite. El panel muestra «Consultas hoy: n/límite».

Pruebas tras esta entrega: typecheck limpio · `npm test` 685/0 fallos (7 nuevas de delegación y límite) ·
runtime-smoke ok · work-runtime-smoke 11 bloques con navegador (subida de 2 archivos, descarga, 404 en proyecto ajeno) ·
E2E 117/117 · dashboard:test 20/20.

**No hecho:** el agente por tarea se aplica al planificador de la ejecución (donde hoy se llama al modelo); no hay
todavía ejecución real en paralelo de varios agentes externos ni reparto automático por tipo de trabajo. Ningún
proveedor externo se ha llamado en pruebas (no hay credenciales en este entorno).

## LEGO reutilizado (no se ha creado diseño nuevo)

Piel `command-center.css` de IBA · `janus-language-button` + arte de idiomas · `apps/pwa/founder-session.js` ·
`lego/janus-model-gateway` · módulos Core de coordinación (operadores, ámbitos, permisos, asignaciones, handoffs),
proyectos (hilos, recursos, checkpoints), autoridad y adjuntos.

## Pruebas (ejecutadas el 10-nov-2026 en contenedor Linux, Node 22)

| Prueba | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npm test` | 678 pruebas, 0 fallos (incluye 13 nuevas: sesiones y contrato) |
| `node tests/runtime-smoke.mjs` (existente) | ok |
| `npm run dashboard:test` | 20/20 (9 nuevas de la plantilla) |
| `node tests/work-runtime-smoke.mjs` | 10 bloques ok, navegador real incluido |
| `prototypes/dashboard/tests/e2e-work.cjs` | 111/111 en móvil, tablet y escritorio |

**Faltan:** iPhone/Safari físico e instalación como app; lector de pantalla; el chat con un modelo real configurado
(en las pruebas el Núcleo responde sin modelo); varios colaboradores a la vez durante horas; CI de GitHub para las
dos pruebas nuevas con navegador (requieren la piel privada: en CI público se omiten o verifican el 503).

## Pendiente de aprobación del CEO

1. Aprobación visual de la vista previa.
2. Dónde alojar la piel de IBA para el runtime real (hoy: copia local fuera de Git).
3. Fusión de esta rama (PR #82, borrador) y cualquier despliegue.

Aparcado por orden del CEO: altas reales de personas.

## Continuación

`npm run work:build` (vista previa) · `npm run work:build -- --mode core` · `npm run work:smoke`.
Siguiente: panel del CEO para ver sesiones y entregas del equipo dentro de SU dashboard (requiere su aprobación,
porque toca la dashboard personal), y delegación de JANUS a Claude/ChatGPT/Gemini por tarea con límites de consumo.
