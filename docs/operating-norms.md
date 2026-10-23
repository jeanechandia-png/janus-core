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
