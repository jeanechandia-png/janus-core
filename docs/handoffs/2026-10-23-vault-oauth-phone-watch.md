# Handoff — Correo con envío aprobado, almacén cifrado + Google OAuth, teléfono/WhatsApp y vigilancia periódica (2026-10-23, segunda pasada)

Rama: `claude/social-accounts-watch` (PR #47, apilada sobre `claude/flow-engine-n8n-parity`, PR #46). No se toca `apps/pwa`.
Continúa `2026-10-23-social-accounts-mail-watch.md`: **su política de "solo lectura + borradores" queda superada por las decisiones de Jean de esta pasada** (se conserva el texto original como histórico).

## AHORA
Jean (01:02–01:07) pidió que Janus pueda leer, redactar, corregir y **enviar** correo bajo sus instrucciones (incluida la cuenta de su hija, que él administra), y acceder/enviar/contestar por teléfono y WhatsApp. Pidió además no recibir preguntas que puedan resolverse contrastando datos.

## HECHO (verificado con servicios simulados: `tsc` limpio, suite completa, humo del runtime)
- **Correo con envío aprobado.** `gmail.draft.update` y `gmail.draft.send`. El envío **relee el borrador en Gmail y compara destinatarios (Para/Cc/Cco) y asunto con lo aprobado** (`input.expect`); si difiere, no se puede leer o falta la aprobación → no se envía nada. El **texto** siempre queda ligado: la aprobación debe traer `expect.bodySha256` (`draftBodyDigest`); sin ella no se envía (y ni se consulta Gmail). **Pendiente:** el emisor de la aprobación (interfaz/planificador, aún sin escribir) debe calcular esa huella con el texto exacto que ve el Founder. Riesgo residual: comparar y enviar no es atómico (ventana de milisegundos). Acciones registradas como sensibles (alto riesgo, irreversible, aprobación obligatoria).
- **Política nueva** (`FounderMailPolicy`): redactar por instrucción del Founder, cada envío con su confirmación; autónomo/auto-respuesta/borrar/archivar/reenviar = false. Cuenta de menor: solo lectura salvo etiqueta `guardian-managed` (la de la hija, con `founder-consent:2026-10-23`).
- **Almacén cifrado de credenciales** (AES-256-GCM, llave externa, 0600, auditoría sin tokens) y **consentimiento de Google por buzón** (PKCE S256, state de un solo uso, comprobación de que la cuenta concedida es la del buzón —si no, se revoca y no se guarda—, lectura y escritura por separado, renovación automática, `invalid_grant` ⇒ pide nuevo consentimiento). Renovación y canje de Threads. Endpoints con rostro + `confirmAction`.
- **Teléfono/WhatsApp.** Registro, política, plan por rutas (L1 enlaces de un toque disponibles ya; L2 API/voz con bloqueos y coste; L3 cliente no oficial rechazado), enlaces `wa.me` / `tel:` / `sms:`, endpoint `GET /api/founder/phone-channels`. Acciones reservadas (`whatsapp.message.send`, `sms.message.send`, `phone.call.place`…) ya nacen con aprobación obligatoria; el verbo `place` es privilegiado.
- **Vigilancia periódica de redes**: planificador opt-in sin solapes y con retroceso; fotos guardadas en SQLite (`social-watch`); endpoints de estado y ejecución manual.
- **Agrupación por cuenta** (`account:<id>`): varios enlaces de la misma cuenta se suman. Facebook de Jean personal confirmado por él.
- **Corrección de defecto propio:** las capacidades `google-workspace*`/`threads-insights` solo miraban la variable global; ahora siguen las credenciales por buzón y el almacén.
- Pruebas: 467 en la suite (antes 428) + `tests/runtime-smoke.mjs` ok. Nuevas: correo 14, teléfono 12, almacén/OAuth/Threads 17, planificador 5, escaneo de privacidad 1 (local).

## Lecciones (ERROR→CAUSA→IMPACTO→LECCIÓN→PREVENCIÓN→CAMBIO→VERIFICACIÓN)
1. **Dato personal en un commit público.** ERROR: una prueba de `2881129` usó como ejemplo el identificador de compartir del Facebook personal de Jean → CAUSA: usé el valor real como fixture y mi guardián solo vigilaba el archivo de configuración → IMPACTO: el identificador está en el historial público de la rama (el árbol actual ya no lo tiene) → LECCIÓN: un fixture jamás usa un valor real, y el guardián debe comparar contra el archivo privado, no solo contra una lista de archivos → PREVENCIÓN: `tests/founder-privacy-scan.test.ts` compara cada valor del archivo privado con todos los archivos versionables y fue comprobado con una sonda; fixtures ficticios → CAMBIO: fixture sustituido → VERIFICACIÓN: el escaneo pasa y falla si se planta el número. **Pendiente de decisión de Jean:** reescribir el historial de la rama (fuerza un push) o dejarlo (el enlace de compartir es público por diseño).
2. **Afirmación demasiado amplia.** Escribí que "ningún correo del Founder aparece en archivos versionados" cuando la prueba cubría 5 archivos, y `START_HERE.md` (de una sesión anterior, 2026-10-21) ya publica su dirección personal como identidad operativa. Corregido: los guardianes declaran su alcance y las dos referencias ya públicas figuran explícitas en el escaneo.
3. **Capacidades ciegas a credenciales por buzón** (ver arriba): detectado al cablear el almacén; ahora `syncCredentialCapabilities`.
4. **Regex privilegiada.** Añadir `activate`/`answer` habría convertido en privilegiadas acciones inocuas (`home-scenes.scene.activate`, `quiz.answer`); solo se añadió `place`, y una prueba fija ambas cosas.

## PENDIENTE
- **Nada se ha probado contra las API reales** (Gmail, Google OAuth, Threads, Meta, WhatsApp).
- Botón en la PWA para iniciar el consentimiento de Google (los endpoints existen; tocar `apps/pwa` necesita autorización).
- Adaptadores reales de WhatsApp Cloud API / SMS / línea de voz (cuestan dinero y exigen número dedicado).
- Lectura/triaje de correo hacia flujos y Agent Swarm; aviso push de alertas al iPhone.
- Correo no Google (IMAP) para el dominio propio si no es Workspace.
- Nombres de métricas de Facebook/Instagram por cuenta.

## BLOQUEADO (solo con un toque de Jean)
1. Crear el cliente OAuth en Google Cloud, registrar la URI exacta que muestra `GET /api/founder/mail-accounts` (`credentialRuntime.redirectUri`) y aceptar la pantalla de consentimiento de Google, buzón por buzón (lectura y, aparte, escritura).
2. Generar la llave del almacén (`openssl rand -base64 32`) y guardarla como `JANUS_CREDENTIAL_VAULT_KEY` en el equipo que ejecuta Janus.
3. Meta: app de desarrollador + token. Threads: invitación como tester + token (se guarda con el endpoint, no en el chat).
4. Decisiones: ruta de WhatsApp (recomendado por ahora: enlaces de un toque; número dedicado solo si quiere envío por API), alquiler de número para la línea de voz (gasto), autorización para `apps/pwa` y para fusionar la pila, y qué hacer con el identificador ya en el historial.

## Lo que no puedo afirmar (POR CONFIRMAR)
Formato `wa.me` y `sms:?body=` en iOS; desvío condicional del operador hacia una línea de voz; caducidad de refresh tokens con la pantalla de consentimiento en modo "Testing" (se dice 7 días, no verificado); que el `id_token` recibido directamente del endpoint de tokens pueda validarse sin firma (se implementó siguiendo OpenID Connect Core §3.1.3.7, con emisor/audiencia/vigencia/correo verificado exigidos); si los enlaces de Facebook nuevos duplican a los tres antiguos (Facebook bloquea la lectura automática).

## Cómo reproducir
```bash
git fetch --all && git checkout claude/social-accounts-watch
npm install --no-audit --no-fund
npm run typecheck && npm test
node tests/runtime-smoke.mjs
npm run integrations:check
```
El archivo privado `config/founder-reference-library.local.json` **no** está en el repositorio: se entrega aparte y se coloca en esa ruta en el equipo que ejecuta Janus (sin él todo funciona y no hay buzones, teléfono ni perfil personal).

## Configuración nueva (solo entorno, nunca en el repo)
```text
JANUS_CREDENTIAL_VAULT_KEY=...          # 32 bytes base64/hex; JANUS_CREDENTIAL_VAULT_PATH opcional
GOOGLE_OAUTH_CLIENT_ID=...              # + GOOGLE_OAUTH_CLIENT_SECRET opcional
JANUS_OAUTH_REDIRECT_BASE=https://...   # dirección pública de este Janus alcanzable desde el iPhone
THREADS_APP_SECRET=...                  # solo si pegas un token de corta duración
JANUS_SOCIAL_WATCH_INTERVAL_MIN=360     # opcional; mínimo 15
```

## Decisión del Founder (2026-10-23, 01:44–01:56) — el gasto va al final
- **Opción C:** el motor (runtime) **no se despliega por ahora** y no se contrata servidor. Jean confirma que de momento **no necesita** leer/enviar correos por sí mismo, vigilar redes ni contestar WhatsApp/llamadas; quiere la opción **preparada y pendiente de activación**.
- **Norma 7** (`docs/operating-norms.md`, política `founder-policy:spend-last`): se trabaja al máximo sin comprar; herramientas, suscripciones y servidores van siempre al final y en euros. Origen: CatCut (un mes pagado, 1–2 usos).
- `docs/dormant-capabilities.md` lista lo que está en reposo, con precios de servidor en euros verificados el 2026-10-23, y lleva el registro de gasto. `npm run integrations:check` ahora dice «en reposo» en lugar de «falta».
- Nada de esto cambia el código ya entregado: lo que hay en la PR #47 sigue siendo válido y se activa con variables cuando el Founder lo pida.

## Lección: pruebas faciales rechazadas al azar como «caducadas» (hallada y corregida 2026-10-23)
- **ERROR:** la prueba de humo del runtime fallaba de forma intermitente (≈ 4–5 de cada 48 ejecuciones en paralelo; 2 de 14 en serie) con 403 `founder_biometric_expired` justo después de crear la prueba.
- **CAUSA:** `FounderBiometricService.verifyAssertion` leía el reloj dos veces (`verifiedAt` y, aparte, `expiresAt = ahora + TTL`). Si el milisegundo cambiaba entre las dos lecturas, la vigencia salía TTL + 1 ms y `evaluateAuthority` (`expiresAt - verifiedAt > biometricFreshnessMs`) la rechazaba. Defecto previo a este trabajo (rama base), no introducido hoy.
- **IMPACTO:** en uso real, un porcentaje pequeño de las acciones privadas del Founder (con cara) habría fallado sin motivo y pedido repetir la verificación. Más probable con la máquina cargada. Ninguna brecha de seguridad: fallaba cerrado.
- **LECCIÓN:** un instante que se usa para derivar otros debe leerse una sola vez.
- **PREVENCIÓN:** prueba de regresión con reloj que avanza 1 ms por lectura (`tests/founder-biometric.test.ts`); verificada: **falla sin el arreglo y pasa con él**. La prueba de humo guarda ahora el motivo de cada 403 para que un fallo intermitente deje rastro.
- **CAMBIO:** `packages/security/src/founder-biometric.ts` (una sola lectura de reloj).
- **VERIFICACIÓN:** 0 fallos en 48 ejecuciones paralelas de la prueba de humo tras el arreglo (antes, 4–5). Es evidencia, no demostración; escaneo de otros pares de lecturas de reloj en `packages/` y `apps/runtime`: sin coincidencias.

## Historial de ejecuciones de flujos (2026-10-23, sin servidor ni gasto)
- `SqliteStore`: tablas `flow_runs`, `flow_run_events`, `flow_dedupe` y métodos `claimFlowKey`, `saveFlowRun`, `getFlowRun`, `listFlowRuns`, `appendFlowRunEvent`, `listFlowRunEvents`.
- `packages/automation/src/flow-run-persistence.ts`: `runWorkflowPersisted` y `resumeWorkflowRun` (errores `FlowResumeError`: `not_found`, `not_paused`, `not_resumable`, `workflow_mismatch`) y `redactSecrets`.
- **Decisión de diseño (INFERENCIA, a revisar):** las claves con nombre de secreto (`token`, `password`, `apiKey`, `authorization`…) se guardan como `[redacted]`; si se ocultó algo, esa ejecución **no se reanuda** en vez de continuar con datos alterados. Los flujos deberían llevar referencias a credenciales, no secretos (ADR-004).
- **Pendiente:** ruta HTTP bajo Founder + biometría para listar/aprobar/reanudar, disparadores programado/webhook/evento, y el editor visual (dos opciones HTML para elegir).
- Verificación: 8 pruebas; con la ocultación desactivada fallan 2 (comprobado).

