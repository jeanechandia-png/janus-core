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

## Actualización 10-nov-2026 (14:15) — confidencialidad y agenda (decisiones del CEO)

Reglas fijadas por el CEO: el colaborador solo ve lo de SUS proyectos (nunca ingresos, gastos, personal ni la lista
general de proyectos) · **no descarga archivos ni envía nada fuera de la empresa** · si hace falta enviar un correo,
se lo pide a JANUS, que lo evalúa y solo escala al CEO como último recurso; destinatarios admitidos: correos de la
empresa y el del CEO · la agenda personal de cada persona es privada; todo lo relacionado con la empresa lo ve el CEO.

13. **Sin descarga para colaboradores:** `GET /api/work/files/:id` (descarga) queda SOLO para el Founder (403 para
    operadores). Nuevo `GET /api/work/files/:id/view`: abre el archivo dentro del panel (imagen, PDF, texto), sin caché.
    El botón «Descargar» se sustituye por «Ver». Capacidades `downloadFiles:false` y `shareOutside:false`.
14. **Visor interno con marca de agua** (nombre, identificador y fecha repetidos sobre el contenido), sin menú
    contextual, copia ni arrastre; impresión bloqueada por CSS; el contenido se difumina cuando la app pasa a segundo
    plano. **Es disuasión y trazabilidad, no un bloqueo:** una web/PWA no puede impedir capturas de pantalla.
15. **Registro de aperturas** (`work_file_access`, append-only) y `GET /api/work/file-access` solo para el Founder.
16. **Agenda personal** (`work-agenda.ts`, tabla `work_agenda_items`): recordatorios y disponibilidad («voy a
    trabajar»). `GET/POST /api/work/agenda`, `PUT/DELETE /api/work/agenda/:id`. Privacidad aplicada en el servidor:
    lo `private` solo lo recibe su dueño; el Founder recibe únicamente lo `work`. La disponibilidad y todo lo ligado a
    un proyecto son siempre `work`, aunque se pida privado. Un elemento ajeno responde 404.

Pruebas: typecheck limpio · `npm test` 690/0 fallos · runtime-smoke ok · work-runtime-smoke 12 bloques con navegador ·
E2E 132/132 · dashboard:test 20/20.

**No hecho / límites:** los recordatorios se ven en el panel pero todavía no avisan (sin notificaciones push) ni se
crean hablando con JANUS en el chat · no existe aún el flujo «pedir a JANUS que envíe un correo» (hoy el colaborador
no puede enviar ningún correo) · los datos privados de la agenda se guardan sin cifrar en la base de datos de JANUS
(ninguna pantalla ni API los muestra al CEO, pero quien administre el servidor podría leerlos) · bloquear capturas
exigiría una app nativa, y en iPhone ni siquiera así se bloquea del todo · el contenido del chat sigue viajando al
proveedor del modelo elegido (falta la opción «solo modelo propio» por proyecto).

## Actualización 10-nov-2026 (14:45) — cierre de pendientes

Orden del CEO: avanzar hasta que solo queden (1) la clonación de voces y (2) las criaturas y el robot 3D, que él
aportará desde otra plataforma. Decisión adicional: dentro de un proyecto de empresa NADA es privado (se descartó
un espacio «privado» dentro de los proyectos); lo único privado es la agenda personal.

17. **Mensajes internos** (`work-message.ts`, tabla `work_messages`): el colaborador escribe a un destinatario
    INTERNO (`JANUS_INTERNAL_RECIPIENTS`, por defecto solo el CEO). JANUS decide con reglas fijas: destino externo →
    rechazado automáticamente (422), queda rastro sin guardar la dirección y sin avisar al CEO. `GET/POST
    /api/work/messages`, `PUT /api/work/messages/:id/read` (CEO). No es correo: nada sale del ecosistema.
18. **Agenda privada cifrada en reposo** (AES-256-GCM, clave derivada por HKDF de `JANUS_CREDENTIAL_VAULT_KEY`).
    Sin esa clave se guarda en claro.
19. **«Solo modelo propio» por proyecto** (`modelPolicy:'local_only'`, `PUT /api/projects/:id/model-policy`, solo CEO):
    en esos proyectos JANUS no usa proveedores externos; si no hay modelo local configurado, responde sin modelo.
20. **Proyecto propio del colaborador:** botón «Nuevo proyecto» (la API ya lo permitía). Nace en la empresa; el CEO lo
    ve desde el primer momento; solo el CEO da acceso a terceros.
21. **«Recuérdame…» en el chat** (ES/NL/EN): analizador determinista en el panel (hoy, mañana, día de la semana,
    DD/MM, «a las HH:MM»); crea el recordatorio personal y lo confirma. No consume consultas del modelo.
22. **Avisos al teléfono** (`web-push.ts`, sin dependencias: RFC 8291 + VAPID; `apps/pwa/work-sw.js`): suscripción por
    dispositivo solo hacia servicios de avisos conocidos (Apple, Google, Mozilla, Windows); barrido cada 30 s; cada
    recordatorio avisa una vez, a la hora LOCAL de la persona (`timeZone` del elemento). Apagado hasta definir
    `JANUS_PUSH_VAPID_PRIVATE_KEY` (`npm run work:push-key` genera una). Con el panel abierto el aviso sale en pantalla.
23. **Vista de equipo del CEO** (`/work/team`, `work-team.js`, `GET /api/work/team`): página APARTE con la piel de IBA;
    no modifica la dashboard personal aprobada. Personas y sesiones, disponibilidad, tareas (con selector de agente),
    entregas, bandeja de mensajes, archivos abiertos y proyectos (con «solo modelo propio»). Solo asuntos de empresa.

Pruebas: typecheck limpio · `npm test` 700/0 fallos · runtime-smoke ok · work-runtime-smoke 16 bloques con navegador ·
E2E panel 144/144 · E2E equipo 16/16 · dashboard:test 22/22.

### Qué queda realmente (además de voces y criaturas/robot)

- **No verificable desde este entorno:** entrega real de avisos por Apple/Google (el cifrado está probado de ida y
  vuelta contra un receptor simulado, no contra el servicio real) · llamadas reales a Claude/ChatGPT/Gemini (sin
  credenciales) · iPhone/Safari físico e instalación como app.
- **Requiere decisión o acción del CEO:** aprobación visual · fusionar la PR #82 · servidor donde corra JANUS con HTTPS
  (sin él, ni `/work` ni los avisos llegan a los teléfonos) · claves en el servidor (VAPID, almacén, proveedores).
- **No construido:** envío de correo real a direcciones de empresa a través de JANUS (hoy la comunicación es interna) ·
  reparto automático de un trabajo entre varios agentes a la vez · códigos de barras 1D · lector QR en NL/EN y con la
  piel de IBA · panel del CEO integrado dentro de su dashboard personal (la vista de equipo es una página aparte).

## Actualización 10-nov-2026 (19:10) — accesos por invitación

Orden del CEO (18:58): entregar los accesos tipo app (el suyo, el de Kendra y dos de personal a nombre de Julio y
Robin) y que JANUS pueda actualizarse a sí mismo cuando él suba las criaturas y los robots. Voz temporal: la voz
«Jean» ya clonada en ElevenLabs y la voz femenina de los productos.

24. **Acceso de colaboradores por enlace** (`operator-invite.ts`, tabla `operator_invites`,
    `LocalAuthorityAuthService.enrollOperatorFromInvitation`): el CEO crea el enlace en `/work/team` → «Accesos»
    (misma acción biométrica que la delegación directa: `security.authority.delegate_operator`, ADR-007 intacta). El
    colaborador lo abre en SU teléfono: se crea la llave del dispositivo, se canjea el código y entra en su panel.
    Código de 256 bits, solo en el fragmento `#invite=` (no viaja al servidor en la dirección ni queda en registros),
    guardado solo como huella SHA-256, un solo uso (canje atómico), caduca a las 72 h (máx. 7 días), anulable; una
    invitación nueva anula la pendiente anterior de esa persona; nunca toca al Founder ni a un administrador; un
    acceso nuevo no ve ningún proyecto hasta que el CEO se lo asigne. Rutas: `POST/GET /api/auth/operator/invites`,
    `DELETE /api/auth/operator/invites/:id`, `POST /api/auth/operator/invites/redeem` (freno de 10 intentos/10 min).
25. **Instalador de la tablet** (`scripts/tablet/install-termux.sh`): instala la piel de IBA si el archivo está en la
    tablet y genera allí la llave de avisos.

Pruebas: typecheck limpio · `npm test` 705 (704 correctas, 1 omitida, 0 fallos) · runtime-smoke ok ·
work-runtime-smoke 18 bloques (incluye un teléfono nuevo entrando por el enlace en navegador real) · E2E panel
144/144 · E2E equipo 24/24.

### HECHO VERIFICADO sobre los accesos reales (por qué aún no existen)

- Los tres accesos tipo app YA están en el código y comparten el icono dorado de JANUS aprobado: `/` (CEO),
  `/kendra` (Kendra) y `/work` (personal). Son direcciones del propio JANUS: solo existen cuando JANUS está encendido
  en algún equipo. Hoy no lo está en ninguno (`docs/tablet-node.md`: piloto en la tablet «en reposo hasta que Jean lo
  ejecute»).
- Dar acceso a un colaborador exige el Face ID del CEO (ADR-007). El puente de Face ID es una app nativa de iPhone
  (`platform/ios/`) que hay que compilar con un Mac: sin Mac no se puede instalar. **Bloqueo real** para los accesos
  de Julio y Robin. Alternativa a decidir por el CEO: aceptar la llave de acceso de Safari (passkey con Face ID, sin
  app nativa ni Mac) como segunda forma de confirmación; es un cambio de la decisión de seguridad ADR-007 y no se ha
  hecho sin su autorización.
- POR CONFIRMAR: dirección segura (HTTPS) para llegar a la tablet desde los teléfonos. No se pudo verificar desde
  este entorno si Tailscale en Android ofrece HTTPS propio; la otra vía gratuita es un túnel de Cloudflare instalado en
  Termux (nombre público: requiere aprobación del CEO).
- Criaturas y robots: el mecanismo para anexarlos ya existe (seis huecos de modelo GLB, `docs/APPROVED_CHARACTERS_PWA_2026-11-06.md`):
  se cargan desde el propio dispositivo, sin tocar código. Admite modelos 3D (GLB), no imágenes.

## Actualización 10-nov-2026 (19:50) — Face ID del navegador para dar accesos

Decisión del CEO (19:18): no esperar al Mac. Enmienda registrada en `docs/ADR-007-founder-biometric-authority.md`.

26. **Llave de acceso del CEO** (`packages/security/src/founder-passkey.ts`, tabla `founder_passkeys`): WebAuthn sin
    dependencias (CBOR mínimo + ES256). Método `webauthn-uv`, aceptado por la política SOLO para
    `security.authority.delegate_operator` (`AuthorityPolicy.passkeyActions`). Rutas `/api/auth/passkey/status`,
    `register/options|verify`, `assert/options|verify` (todas exigen sesión del CEO).
27. **Vista de equipo:** «Activar Face ID» (una vez) y creación de enlaces confirmando con Face ID del navegador; si
    existe el puente nativo, se usa ese.
28. **Tablet:** `scripts/tablet/faceid-setup.sh https://…` abre el alta 10 minutos y la cierra sola.
29. **Corrección:** `/work` y `/work/team` se reconstruyen cuando el código es más reciente que la página guardada
    (antes, tras una actualización, se habría seguido sirviendo la versión anterior).

Pruebas: ver STATE. Flujo completo en Chrome real con autenticador virtual: activar → crear enlace → la colaboradora
entra → sin verificación del usuario no se crea nada → la llave no sirve para otras acciones reservadas.
NO VERIFICADO: iPhone/Safari físico (en iOS la llave de acceso exige HTTPS con nombre de dominio).

## Actualización 10-nov-2026 (20:20) — códigos de barras y lector en tres idiomas

30. **Códigos de barras clásicos** (`lego/janus-attach/barcode-1d.js`, pieza opcional sin dependencias): EAN-13, UPC-A,
    EAN-8 y Code 128; solo devuelve un código si su dígito de control cuadra. Verificado contra patrones de un
    codificador independiente (JsBarcode, solo como origen de `tests/fixtures/barcodes-1d.json`; no es dependencia).
31. **`janus-attach` 1.1.0:** `configure({formats, strings, theme})` OPCIONAL. Sin configurar se comporta como la 1.0
    (las dashboards personales no lo llaman: mismo comportamiento; `scripts/attach-smoke.mjs` sigue pasando). JANUS Work
    lo configura con QR + barras, textos ES/NL/EN y tema `iba`.

NO VERIFICADO: lectura con la cámara de un teléfono real (enfoque, reflejos, códigos girados). Las pruebas usan
patrones dibujados con desenfoque, ruido y luz desigual simulados.

## Actualización 10-nov-2026 (20:15) — sello oficial y pestaña «¿Cómo va el equipo?»

Orden del CEO (19:52, con el logo adjunto): poner el sello oficial, que la vista de equipo sea una pestaña con ese título
y que la dashboard original tenga un acceso simplificado que lleve a ella. Autorización expresa: «estás autorizado a hacerlo».

32. **Sello oficial InfinitySeed Group** (`apps/pwa/brand/infinityseed-group-logo.webp`, 520×154, ~28 KB; recortado del PNG
    que envió el CEO). Aparece en la barra lateral y en la entrada de JANUS Work y de la vista de equipo; en móvil, en una franja
    superior. Una sola copia incrustada (`WORK_BRAND`) en las vistas previas autónomas.
33. **Vista de equipo = «¿Cómo va el equipo?»** (`/work/team`): título nuevo y enlace «← Mi dashboard» (barra lateral y
    cabecera). El retorno solo acepta una lista cerrada (`/dashboard/a`, `/dashboard/b`, `/`); cualquier otro valor de
    `?back=` vuelve a `/dashboard/a` (sin redirecciones abiertas).
34. **Acceso simplificado en la dashboard original** (`apps/pwa/team-chip.js`, nuevo): pastilla «Equipo» (NL: «Team») en la
    cabecera de A y B, mismo tamaño y trazo que los demás controles. Muestra una insignia con las MISMAS cifras de la vista de
    equipo (tareas bloqueadas + mensajes sin leer) y un punto verde si hay alguien trabajando. Sin sesión o sin permiso
    (HTTP 401/403): solo el enlace, sin cifras. Se refresca cada 60 s y solo con la pestaña visible.

**Cómo se hizo sin tocar lo aprobado (HECHO VERIFICADO):** la pastilla se monta desde `apps/pwa/dashboard-access.js`, la
misma capa que ya añadía los medallones de idioma y el menú ☰. `git diff` sobre `prototypes/dashboard/src` y `dist`:
0 archivos; `tests/team-chip.test.ts` lo vigila (las dashboards A/B no contienen `janus-team-chip`). Service worker:
caché `janus-shell-v16` (`/team-chip.js` precacheado; dos pruebas existentes actualizadas de v15 a v16).
Idiomas de la cabecera aprobada: solo ES/NL, como sus controles actuales (no se añadió inglés a esa capa).

Prueba de extremo a extremo (scratchpad, no versionada): servidor mínimo que replica la inyección del runtime sobre la
dashboard A real → clic en «Equipo» → `/work/team?back=…` → «← Mi dashboard». 24 comprobaciones ok en escritorio
(1280 px) y móvil (430 px), con y sin permiso. NO VERIFICADO: iPhone/Safari físico; el resumen real contra un Núcleo vivo
con datos reales (las pruebas usan datos ficticios).

## Actualización 10-nov-2026 (21:00) — «Mi equipo» con lucecitas (sustituye a la pastilla «Equipo»)

Orden del CEO (20:28–20:29): no un botón, sino una tarjeta/sección «Mi equipo» donde se vea con una luz quién está
conectado o trabajando en ese momento; al tocarla se hunde y abre la pestaña «¿Cómo va el equipo?».

35. **Presencia real** (`packages/core/src/work-presence.ts`): luz = sesión de trabajo declarada + señal de presencia.
    El panel del colaborador envía `POST /api/work/presence` cada 30 s (solo abierto y a la vista) y cualquier petición
    válida suya cuenta. Solo en memoria: no se guarda ni se audita; tras reiniciar JANUS todos salen apagados hasta su
    siguiente señal. Estados: **verde** trabajando (sesión en marcha y señal ≤ 5 min) · **verde hueco** sesión abierta
    sin señal > 5 min (no se afirma que trabaje) · **ámbar** en pausa · **azul** conectado sin sesión (señal ≤ 90 s) ·
    **gris** desconectado.
36. **`GET /api/work/team/presence`** (solo CEO): nombre, cargo, estado, segundos desde la última señal, inicio de la
    sesión y dos contadores (tareas bloqueadas, mensajes sin leer). Nada más. `/api/work/team` añade `presence` y la vista
    de equipo usa los mismos estados.
37. **Tarjeta «Mi equipo»** (`apps/pwa/team-panel.js`, sustituye a `team-chip.js`): mismo cristal y borde dorado que
    las tarjetas aprobadas; se hunde al tocarla; refresco cada 15 s con la pestaña visible. Tablet/escritorio: en la
    cabecera, con una luz por persona (inicial dentro) y la insignia roja de asuntos; la rejilla aprobada no se toca y
    sigue entrando en una pantalla. Teléfono: tarjeta a ancho completo bajo los accesos rápidos, con nombre, estado y
    hora («Trabajando · desde las 19:05»). Sin sesión del CEO o sin permiso: solo el acceso, sin luces ni cifras.
38. **Dashboard B (Platino):** su cabecera de escritorio (`.pl-hd`) no recibía los controles de acceso (banderas y ☰):
    hueco previo. Ahora se montan también ahí, con tinta oscura para su fondo claro.

Verificación (HECHO): prueba de extremo a extremo con navegador sobre las dashboards A y B reales, escritorio
1280×800, tablet 1024×768 y móvil 430×932, con y sin permiso: 76/76 comprobaciones (una sola tarjeta visible, luces y
cifras correctas, sin desbordes, una pantalla en tablet/escritorio, clic → «¿Cómo va el equipo?», sin errores).
`git diff` sobre `prototypes/dashboard/src` y `dist`: 0 archivos. Caché del service worker `janus-shell-v17`.
NO VERIFICADO: iPhone/Safari físico; si iOS corta la señal de 30 s al bloquear el teléfono (la luz pasaría a verde
hueco a los 5 min, que es el comportamiento buscado, pero no se ha medido en un dispositivo real).

## Actualización 10-nov-2026 (21:45) — correcciones de lectura en la dashboard personal A (orden expresa del CEO)

Orden del CEO (21:20, con dos fotos de su tablet): textos montados en «Prioridades», falta IBA en «Proyectos», letra
pequeña demasiado fina, el medallón de JANUS debe girar con una luz de conexión, los botones deben parecer botones 3D
y las líneas divisorias deben marcarse más. **Es la primera modificación del código de la dashboard personal A
(`prototypes/dashboard/src`), hecha por orden directa del CEO.** La piel B no cambia.

39. **Textos montados (causa):** cada correo de «Prioridades» tenía dos líneas en una fila de altura repartida; en la
    tablet la fila era más baja que las dos líneas. **Corrección:** una línea por correo (remitente · asunto, con
    puntos suspensivos si no cabe). Los títulos de tarjeta ya no se parten en dos líneas.
40. **Proyectos:** cuatro botones fijos, Janus · ChatBox · Web · IBA (`projects.js`: IBA con nombre corto).
41. **Letra:** `build.cjs → legibleFonts` sube en la piel A todo texto menor de 12 px un 28 % (mín. +2 px, máx. 13 px);
    `src/legible.css` añade grosor (600–700), más contraste en los textos secundarios y divisores dorados más marcados.
    Barra de pestañas de las vistas: iconos y nombres más grandes.
42. **Medallón:** gira sobre su eje y lleva una luz en órbita: verde con conexión, gris y lenta sin ella
    (`navigator.onLine`, se actualiza sola). Respeta «reducir movimiento» del sistema.
43. **Botones 3D:** relieve dorado con brillo superior y sombra inferior en botones de proyecto, chips y pestañas; se
    hunden al pulsar.

Verificación (HECHO): comprobador automático en 7 tamaños (1024×700 a 1920×1080): ninguna tarjeta recortada, la
dashboard sigue entrando en una pantalla, sin textos montados (revisado además a la vista en 1280×740, 1024×700 y
1366×1024). NO VERIFICADO: la tablet Samsung real del CEO (se desconoce su tamaño exacto de ventana).

## Actualización 11-nov-2026 (01:10) — comunicación en los dos sentidos (CEO ↔ equipo)

Orden del CEO (10-nov, 21:48): «yo tengo que poder enviar mensajes al igual que recibir… responder un mensaje, crear
una tarea, enviarles un archivo». La dashboard es el canal; no WhatsApp.

44. **Mensajes del CEO a una persona** (`composeFounderMessage`, `POST /api/work/team/messages`): con `toPrincipalId`,
    respuesta opcional (`replyToId`, que marca el original como leído) y adjuntos del proyecto. El colaborador los
    recibe en `messaging.inbox` / `GET /api/work/messages → inbox`, los marca leídos (solo el destinatario; 404 para
    cualquier otro) y responde. Lo que envía el CEO no cuenta como «nuevo» para él.
45. **Tareas con instrucciones** (`POST /api/work/team/tasks`): persona + proyecto + título + instrucciones + prioridad.
    Si la persona no trabajaba en ese proyecto, se le da acceso SOLO a ese (leer, trabajar, entregar); si el proyecto
    no tenía ámbito, se le crea uno propio. Es decisión de permisos del CEO, tomada al asignar.
46. **Archivos y fotos del CEO** (`POST /api/work/team/attachments`): se guardan en el proyecto y se adjuntan al
    mensaje; la persona los abre en su visor interno (sin descarga), con los permisos del proyecto.
47. **Avisos al teléfono** de la persona al recibir mensaje o tarea (si tiene los avisos activados y hay clave VAPID).
48. **Pantallas:** en «¿Cómo va el equipo?», botones «✉ Escribir» y «✓ Dar tarea» (arriba y en cada persona) y
    «↩ Responder» en cada mensaje; bandeja con los dos sentidos. En el panel del colaborador, «Mensajes del CEO» con
    leer, adjuntos y responder (ES/NL/EN).

Pruebas: `npm test` 721/0; smoke 21 bloques (aislamiento entre personas, permisos, adjuntos, acceso por tarea);
navegador sobre las vistas previas 18/18. NO VERIFICADO: entrega real del aviso por Apple/Google; iPhone físico.

## LEGO reutilizado (no se ha creado diseño nuevo)

Piel `command-center.css` de IBA · `janus-language-button` + arte de idiomas · `apps/pwa/founder-session.js` ·
`lego/janus-model-gateway` · módulos Core de coordinación (operadores, ámbitos, permisos, asignaciones, handoffs),
proyectos (hilos, recursos, checkpoints), autoridad y adjuntos.

## Pruebas (ejecutadas el 10-nov-2026 en contenedor Linux, Node 22)

| Prueba | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npm test` | 719 pruebas, 718 ok, 0 fallos, 1 omitida previa (incluye presencia y «Mi equipo») |
| `node tests/runtime-smoke.mjs` (existente) | ok |
| `npm run dashboard:test` | 26/26 |
| `node tests/work-runtime-smoke.mjs` | 20 bloques ok, navegador real incluido |
| `prototypes/dashboard/tests/e2e-work.cjs` | 153/153 en móvil, tablet y escritorio |
| `prototypes/dashboard/tests/e2e-team.cjs` | 24/24 |

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
