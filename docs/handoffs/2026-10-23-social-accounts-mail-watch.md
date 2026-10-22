# Handoff — Cuentas sociales y buzones del Founder: seguimiento de solo lectura (2026-10-23)

> **Actualización (misma fecha, segunda pasada):** la política de este documento ("lectura + borradores; enviar desactivado") fue **superada** por las decisiones de Jean; ver `2026-10-23-vault-oauth-phone-watch.md`. Esta versión se conserva como histórico. Corrección: la prueba de fugas cubre solo algunos archivos, y `START_HERE.md` (publicado el 2026-10-21) ya contiene la dirección personal de Jean; el detalle está en el segundo handoff.

Rama: `claude/social-accounts-watch` (apilada sobre `claude/flow-engine-n8n-parity`, PR #46). No se toca `apps/pwa`.

## AHORA
Jean entregó (00:41) sus cuentas de Facebook, Instagram y Threads, y (00:49) cinco direcciones de correo, con esta instrucción: Janus debe poder **tener control y hacer seguimiento continuo** de las cuentas, y tener acceso a los correos y controlarlos "bajo mi supervisión".

Lo que esto significa hoy (decisión de diseño, no una limitación accidental): **lectura + borradores aprobados**. Publicar, responder, enviar, borrar, archivar o reenviar queda desactivado y sería otra capacidad con aprobación por acción. Es decisión de Jean ampliarlo.

## HECHO (verificado: `tsc` limpio, 428/428 pruebas, `tests/runtime-smoke.mjs` ok)
- **Datos personales fuera del repo público.** Capa local `config/founder-reference-library.local.json` (ignorada por git) fusionada al cargar con `mergeFounderReferenceLibraries`. Contiene el perfil personal de Facebook y los 4 buzones únicos. Una prueba verifica que no hay direcciones reales en la configuración, `.env.example` y estos documentos (alcance limitado: ver la actualización arriba).
- **Threads** añadido como plataforma (registro, vinculación, validación) + `ThreadsInsightsAdapter` de solo lectura. Hechos de API verificados contra documentación oficial (ver `docs/founder-social-source-readiness.md`).
- **Plan y vigilancia** `packages/core/src/social-watch.ts`: `planSocialWatch` (qué se puede leer ya y qué falta, cuenta por cuenta, sin llamar a nadie), `flattenInsights`, `diffMetrics`, `runSocialWatch`. `tests/social-watch.test.ts` (12).
- **Buzones** `packages/core/src/founder-mail-accounts.ts`: normaliza, colapsa duplicados, ámbito por etiqueta, `minor`, proveedor `google` solo para Gmail; política de supervisión; `planMailAccess`.
- **Google multi-cuenta** (lectura y escritura): `input.account` + `allowedAccounts`; cuenta no registrada o sin autorizar se rechaza antes de la red; la escritura rechaza menores; sin `account` nada cambia.
- **Runtime**: `GET /api/founder/mail-accounts` (Founder + biometría, sin llamadas externas), plan de vigilancia en el snapshot social, capacidad `threads-insights`.
- **Herramientas**: `.env.example`, `npm run integrations:check` (ahora lista buzón a buzón qué variable falta, sin mostrar direcciones ni valores) y `docs/integrations.md`.
- Pruebas nuevas: `tests/founder-mail-accounts.test.ts` (9) y ampliación de `tests/runtime-smoke.mjs`.

## Lección registrada
ERROR: los buzones se guardaron como `kind: "reference"` con una dirección en `value`, pero el parser exige una URL https en todo `reference` → CAUSA: el registro de buzones nunca se probó cargando el overlay real por el parser (se probó con objetos ya construidos) → IMPACTO: el runtime habría fallado al leer el overlay y sin buzones; lo detectó la primera prueba que usó el parser real → LECCIÓN: probar cada registro nuevo con el cargador de producción y con el archivo real → PREVENCIÓN: el parser valida `mail` como dirección y el resto como https; tres pruebas lo fijan; el smoke carga el overlay si existe → VERIFICACIÓN: `tests/founder-mail-accounts.test.ts` (parser, cronología) y `tests/runtime-smoke.mjs`.

## PENDIENTE
- **Seguimiento continuo real**: no hay planificador que ejecute `runSocialWatch` ni persistencia de instantáneas en SQLite (el almacén se inyecta; hoy no guarda nada).
- Credenciales de producción: almacén seguro con renovación (OAuth/refresh). Hoy solo variables de entorno (puente de desarrollo). Threads dura 60 días; los tokens de acceso de Google, cerca de una hora.
- Lectura de correo → resumen/triaje enlazado a plantillas de flujos y al Agent Swarm; panel en el dashboard.
- Correo no Google (IMAP) para el dominio propio si no resulta ser Google Workspace.
- Nombres de métricas de Facebook/Instagram: configurar por cuenta (no se suponen).

## BLOQUEADO (necesita a Jean)
1. **Meta**: crear la app de desarrollador y dar un token (Standard Access basta para cuentas propias); confirmar si las cuentas de Instagram son Business/Creator.
2. **Threads**: invitación como tester + token (`threads_basic`, `threads_manage_insights`).
3. **Google**: consentimiento OAuth por buzón con permisos mínimos (lectura; borradores aparte).
4. **Confirmar** (marcadas como INFERENCIA en el registro): qué enlace de Facebook es qué cuenta (se leyó el rótulo que sigue al enlace); si los enlaces nuevos duplican a los tres ya guardados; si son Páginas o perfil personal; el ámbito de La Tribuna, del buzón del proyecto de IA y del personal; el proveedor del correo de dominio propio; cómo tratar el buzón de la menor (puede que una cuenta supervisada no permita OAuth de terceros: **no verificado**).
5. **Decisión**: si "control" debe incluir algún día actuar (publicar, responder, enviar). Se diseñaría aparte, con aprobación por acción y auditoría.
6. Autorización para fusionar la pila #37 → #38 → #40 → #45 → #46 → esta, y para tocar `apps/pwa`.

## Cómo reproducir
```bash
git fetch --all && git checkout claude/social-accounts-watch
npm install --no-audit --no-fund
npm run typecheck && npm test
node tests/runtime-smoke.mjs
npm run integrations:check
```
El overlay personal **no** está en el repositorio: se entrega aparte y se coloca en `config/founder-reference-library.local.json` en la máquina que ejecuta el runtime de Janus. Sin él, todo funciona y simplemente no hay buzones ni perfil personal.

## Configuración nueva (solo entorno, nunca en el repo)
```text
THREADS_ACCESS_TOKEN=...            # y opcional THREADS_API_VERSION=v1.0
GOOGLE_ACCESS_TOKEN__<ID>=...       # una por buzón; <ID> = id del buzón en MAYÚSCULAS con "_"
GOOGLE_WRITE_ACCESS_TOKEN__<ID>=... # borradores; los menores no tienen
```
