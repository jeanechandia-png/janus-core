# Normas operativas del Founder (VIGENTE desde 2026-10-21)

Fuente: instrucciones directas de Jean. Se cargan como políticas permanentes (`config/founder-reference-library.json`, subjects `founder-policy:*`) y se hacen cumplir en código cuando es posible. El Founder las redactará en orden más adelante; esta es la versión operativa actual.

| # | Norma | Cómo se cumple hoy |
|---|---|---|
| 1 | Antes de entregar: filtros estructural, ortográfico, síntesis, coherencia e i18n; después una segunda pasada completa | `DeliveryGate` con `FOUNDER_REQUIRED_DIMENSIONS` (activo en el servidor para todo `artifact.updated`) y `DeliveryPipeline.submit/recheck` |
| 2 | Vista previa antes del zip; navegable, nunca estática; el Founder decide | `DeliveryPipeline.attachPreview` (valida HTML navegable y apto para móvil) y `decide` (solo el principal Founder); `authorizePackage` falla si no hay aprobación |
| 3 | Descarga fácil: archivo directo y el mismo texto, no solo enlaces; gráficas y emojis | `authorizePackage` exige archivo directo + texto en línea (lectura POR CONFIRMAR); el revisor `style` avisa si falta apoyo visual |
| 4 | Vocabulario rico y conversación fluida | Revisor `style` (solo advierte) y política `language-style` |
| 5 | Continuidad: continuar donde dejó el agente anterior, sin duplicar | `npm run continuity`, `docs/PROJECT_MAP.md`, `START_HERE.md` |
| 6 | Janus School no diagnostica a menores | Módulo `janus-school` y política `school-safety` |

## Límites honestos
- El `DeliveryPipeline` es biblioteca con pruebas; todavía no tiene panel en la PWA ni ruta HTTP (**PENDIENTE**; la PWA aprobada no se toca sin autorización).
- Los revisores son heurísticos y offline. No sustituyen una revisión humana ni un corrector ortográfico real (**PENDIENTE**: adaptador de modelo/diccionario).
- La norma 3 se interpretó como «archivo directo + mismo texto en el chat»; **POR CONFIRMAR**.


## Normas Infinity Seed 6 (hoja manuscrita de Jean, 22-10-2026) — se suman a las anteriores
1. **Filtros → preview → aprobación → ZIP.** Al terminar se aplican los filtros estructural, arquitectónico, ortográfico, de síntesis y de coherencia visual y estructural. Después va un **preview** para que Jean lo apruebe y, como último paso, el **ZIP**. *(Corrección de Jean, 22-10.)* Amplía las normas 1 y 2 con el filtro **arquitectónico** y la **coherencia visual**.
2. **Evitar la saturación visual.**
3. **Prohibido empezar desde cero:** se aprovechan los recursos, activos y módulos propios. Solo si no existen se diseña un elemento nuevo. Refuerza la norma 5.
4. **Todo activo debe ser reutilizable y monetizable** (piezas LEGO en `packages/modules/*`).
5. **Desarrollo centralizado:** no se crean repositorios nuevos y todo agente continúa desde donde lo dejó el anterior (`npm run continuity`, `START_HERE.md`, `docs/STATE.md`).
6. **Herramientas de pago disponibles:** ChatGPT, Gemini, Claude y Google Workspace. Si otra herramienta rinde mejor en una tarea, el agente **lo dice** y propone usarla o combinarla.

## Norma 7 — El gasto va al final (Jean, 2026-10-23)
Instrucción del Founder: «Siempre tenemos que poder trabajar al máximo sin necesidad de comprar nada. Lo que implique comprar herramientas nuevas o suscripciones se deja siempre como último.» Motivo: se pagó un mes completo de CatCut y se usó una o dos veces.

1. **Primero lo que no cuesta:** lo gratuito, lo local y lo ya pagado (ChatGPT, Gemini, Claude y Google Workspace; ver norma 6 de Infinity Seed 6).
2. **Lo que requiere pago se construye y se deja en reposo.** Adaptador, política y pruebas con servicios simulados; se registra en `docs/dormant-capabilities.md` como «preparado, pendiente de activación». **No se contrata.**
3. **Solo el Founder activa.** Cuando lo pida, el agente presenta: precio **en euros** de fuente primaria con fecha, si incluye IVA, plazo y permanencia, condiciones de baja y uso previsto frente a coste. Se prefiere facturación mensual cancelable al prepago largo. **El pago lo hace el Founder** (el agente no introduce datos de pago).
4. **Todo gasto aprobado se anota** (fecha, importe, fecha de baja prevista y uso real) en el registro de `docs/dormant-capabilities.md`.
5. **Nunca en dólares:** toda cifra al Founder, en euros.

Cómo se cumple hoy: política `founder-policy:spend-last` en `config/founder-reference-library.json` (la leen todos los agentes); `SENSITIVE_TOOL_ACTIONS` obliga a aprobación en las acciones que gastan o escriben fuera; `planPhoneAccess` recomienda siempre la ruta sin gasto; `npm run integrations:check` muestra lo no activado como «en reposo» (no como fallo); `tests/spend-last-norm.test.ts` vigila la política, el registro y la ruta recomendada.

## Norma 8 — Independencia tecnológica y cero créditos por defecto (Founder, 2026-11-06)

**Orden de ejecución obligatorio para todos los proyectos de InfinitySeed Group:**

1. **Motor propio / local-first:** JANUS CORE y módulos LEGO reutilizables; ejecutar en el equipo, incluso sin red, siempre que la tarea lo permita.
2. **Libre o gratuito:** herramientas locales, licencias abiertas y soluciones gratuitas verificadas, manteniendo control de privacidad.
3. **Recursos existentes:** reutilizar infraestructura y suscripciones ya disponibles **si no generan consumo adicional**. Una suscripción a ChatGPT, Claude o ElevenLabs **no autoriza consumo por API**: presupuestos, créditos y cargos por uso se tratan por separado.
4. **Última alternativa:** API/plataforma de terceros con cobro por uso, créditos o tokens. Documentar por qué la solución propia no alcanza el criterio, precio y condiciones en euros, consentimiento específico del Founder, riesgo de datos y límite de gasto. No permitir fallbacks automáticos a proveedores de pago.

**Implementación verificable del ámbito de modelos JANUS:**
- `packages/core/src/model-provider-config.ts` distingue modelos alojados localmente de endpoints externos, y da precedencia a los primeros aunque `JANUS_MODEL_ORDER` indique lo contrario.
- `apps/runtime/server.ts` excluye proveedores externos por defecto, incluso si hay claves API configuradas.
- Solo habilitar los externos con **ambos** `JANUS_ALLOW_EXTERNAL_MODEL_CREDITS=true` y `JANUS_MAX_EXTERNAL_MODEL_CALLS` positivo y acotado (hasta 100); todo proveedor comparte el mismo límite de intentos en el proceso.
- Cuando el proveedor local no responde y no hay permiso externo, JANUS utiliza el camino determinista disponible o informa que la capacidad falta, sin comprar ni cargar créditos.
- Para un servidor propio accesible por LAN, clasificarlo como local exige registrar explícitamente el origen exacto en `JANUS_TRUSTED_LOCAL_MODEL_ORIGINS`.
- El número de llamadas **no equivale a un techo monetario**, no sobrevive por sí solo a reinicios y no acredita identidad del Founder. El responsable de despliegue debe controlar el acceso a la configuración, autorizar el uso y revisar los límites del proveedor; persisten las autorizaciones y validaciones del CORE.

**Para la voz de las criaturas:** una única identidad caricaturesca compartida. Preferir TTS propio/local y, donde exista, voz nativa confirmada como local. No seleccionar voces remotas silenciosamente ni utilizar clones de personas. Una voz genuinamente de caricatura no humana continúa **PENDIENTE DE VALIDACIÓN** mientras no exista motor/activo local aprobado y prueba auditiva de calidad.

Esta norma complementa la 7: la autonomía tecnológica precede incluso al uso innecesario de créditos que ya estén disponibles.

