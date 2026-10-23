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
