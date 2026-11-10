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
3. Activar la carga de adjuntos de colaboradores.
4. Altas reales (Julio, Robin, Mariel): llave pública de cada dispositivo + ámbitos y proyectos de cada uno.
5. Fusión de esta rama y cualquier despliegue.

## Continuación

`npm run work:build` (vista previa) · `npm run work:build -- --mode core` · `npm run work:smoke`.
Siguiente: panel del CEO para ver sesiones y entregas del equipo dentro de SU dashboard (requiere su aprobación,
porque toca la dashboard personal), y delegación de JANUS a Claude/ChatGPT/Gemini por tarea con límites de consumo.
