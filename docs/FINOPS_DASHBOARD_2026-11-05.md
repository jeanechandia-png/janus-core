# JANUS · FinOps en el dashboard (integración incremental)

Fecha: 2026-11-05 · Rama existente: claude/companion-escena-3d · PR #53

## Alcance codificado

Se añade una sola sección #plataformas al dashboard actual de JANUS sin sustituir los diseños Obsidiana/Platino, las escenas 3D, ni crear un repositorio o aplicación nuevos.
- Cabecera de escritorio y tablet: un chip compacto, con colores verde/naranja/rojo; gris expresa no verificado.
- Mobile A/A2/B/C: acceso compacto al detalle, dentro del flujo principal.
- Detalle navegable y específico de cada proveedor: consumos diarios y mensuales, presupuesto EUR, créditos, renovación, fuente, plan B.
- Historial gráfico sin datos sintéticos y sin convertir información ausente en 0. La suma de proveedores disponibles se rotula parcial, nunca total reconciliado.
- Distinción expresa entre suscripción ChatGPT y consumo OpenAI API.

Archivos: prototypes/dashboard/src/platform-finops.js, platform-finops.css, views.js, dash.js, dash-b.js, phonev.js, app.js, build.cjs; test prototypes/dashboard/tests/finops.cjs.

## Contrato de datos y seguridad

El frontend consulta GET /api/finops, ahora IMPLEMENTADO en apps/runtime/server.ts con autorización exclusiva del fundador. Lee los snapshots SQLite ya existentes del Operations Hub, filtrando solo registros de plataforma etiquetados como finops:provider. Alternativamente admite window.JANUS_FINOPS_SNAPSHOT únicamente cuando lo inyecte un runtime privado autenticado.

Para registrar una plataforma se reutiliza POST /api/operations/products con tags=[finops:provider]; para registrar lecturas verificadas se reutiliza POST /api/operations/health con métricas spentEur (coste acumulado del período en EUR), dailySpendEur (coste real del día en EUR), budgetEur, creditsUsed, creditsLimit, renewalDate, plan y fallback. Los snapshots representan lecturas, no facturas pagadas; no sumarlos al ledger contable como nuevos pagos. No se crean tablas, procesos paralelos ni una contabilidad duplicada.

Campos por proveedor: id, name, verifiedAt, source, budgetEur, spentEur, creditsUsed, creditsLimit, daily[{date,eur}], monthly[{month,eur}], renewalDate, health, plan, fallback. La respuesta contiene generatedAt y providers[].

Un dato en USD nunca debe presentarse como EUR sin conversión fechada y procedencia documentada. Sin una fuente actualizada en las últimas 24 horas, el estado queda Sin verificar. Una plataforma del catálogo NO equivale a una suscripción de pago confirmada.

El endpoint de JANUS debe requerir autorización de propietario, no exponer claves ni secretos, aislar datos de clientes y conservar trazabilidad por proveedor / producto / tenant cuando proceda. Prohibido colocar importes privados y datos de facturación reales en archivos públicos de GitHub o en vistas previas estáticas.

## Estado y próximos pasos

- CODED: navegación, diseño responsive, color de riesgo, detalle y gráficas alimentadas exclusivamente por datos proporcionados.
- STATIC VERIFIED: sintaxis y pruebas de contrato en memoria con datos ficticios de prueba; estos no quedan guardados en el dashboard. Se añadieron tests/platform-finops.test.ts y prototypes/dashboard/tests/finops.cjs para verificar aislamiento, no duplicación de lecturas, importes desconocidos, gráficas y estados.
- NO VERIFICADO E2E/PRODUCCIÓN: el endpoint autenticado está implementado con lectura de la base existente; aún falta conectar los importadores de uso real de ElevenLabs, OpenAI, ChatGPT, Claude, Gemini, Google Workspace, Hostinger, Vercel, Netlify, Supabase, Meta y demás servicios efectivamente pagados. No llamar operativo al monitor hasta ejecutar pruebas E2E del endpoint, proveedor, notificación y contingencia real.
- Las alertas horarias de JANUS son un respaldo. Se requiere monitor de producción independiente, alertas 50/70/85/95, proyección de agotamiento, avisos por pago fallido, sondas sintéticas y fallback real comprobado. Esta interfaz por sí sola no impide interrupciones ni cargos.
- No se cambiaron contraseñas, suscripciones, prompts, modelos, servicios ni despliegues.


## Conectores reales incorporados (sin modificar proveedores)

En este branch se creó `packages/core/src/provider-billing-collector.ts` y se conectó al runtime fundador existente `apps/runtime/server.ts`. Cada 15 minutos recoge datos mediante consultas de solo lectura cuando las credenciales estén presentes. Los resultados pasan por la SQLite existente; no se crea una base paralela ni se crea un cobro. La interfaz vuelve a consultar `GET /api/finops` cada 15 minutos.

- ElevenLabs: `GET /v1/user/subscription` y `POST /v1/workspace/analytics/query/usage-by-product-over-time`. Se conserva separación absoluta entre caracteres, créditos, cuota y euros. Un crédito no es un euro. La cuota de caracteres se etiqueta como caracteres, no como créditos; si no es posible conocer el límite de créditos real, queda SIN VERIFICAR. El gasto en EUR solo se introduce cuando existe un importe monetario real en EUR (por ejemplo, exceso informado por API).
- OpenAI API: `GET /v1/organization/costs` con clave ADMIN separada y consulta oficial diaria al BCE para EUR. Se etiquetan los importes convertidos como referencia cambiaria, NO como cargos definitivos en factura; la API de costes no es prueba del saldo prepago. No se confunde el plan ChatGPT con la API OpenAI.
- Las dos fuentes disponen de tests en `tests/provider-billing-collector.test.ts` usando respuestas simuladas; NO se ejecutaron llamadas pagadas ni se modificaron claves de producción.

### Requisitos operativos que faltan para producción (NO SIMULAR)

1. Servidor JANUS autorizado y activo con la misma sesión autenticada que el dashboard; un HTML estático alojado por separado no puede compartir automáticamente la sesión.
2. Pegar los valores directamente en `.env.local` o en el gestor privado de variables del servidor: `ELEVENLABS_FINOPS_API_KEY` con permisos de lectura de suscripción/analytics; `OPENAI_FINOPS_ADMIN_KEY` con permisos de consulta de costes de la organización. NO usar claves de inferencia de ChatBox/IBA ni publicar ninguna clave en chat/repositorios.
3. Establecer presupuestos mensuales `FINOPS_ELEVENLABS_BUDGET_EUR` y `FINOPS_OPENAI_BUDGET_EUR` basados en la decisión del propietario. Son límites de alerta: NO bloquean cargos en las cuentas de terceros ni autorizan pagos.
4. Probar autenticación de propietario, lectura de credenciales, acceso oficial a ambas APIs, fecha/fuente del dato, colores, historial mensual y gráficas mediante E2E real del runtime. Si falta permisos, se presenta `Sin verificar`.
5. Proseguir con otras fuentes de pago (ChatGPT, Claude, Gemini, Google Workspace, Hostinger, Netlify, Vercel, Supabase, GitHub, Meta/WhatsApp y otras confirmadas por facturas). No suponer que una integración de código ya aporta acceso financiero. El conector Vercel de la cuenta conectado en ChatGPT devolvió `404 Plan not found` al solicitar cargos del período de noviembre; pendiente de comprobar acceso/plan, no registrar €0.
6. Configurar la notificación fuera del panel con un canal autorizado, una sonda sintética independiente para el texto/voz y un plan B real por servicio. Las alertas de la tarea JANUS cada hora son un respaldo, NO monitor continuo de producción.

**Estado de entrega:** CODED + CI/UNIT TESTED; NO E2E LIVE/NO PRODUCCIÓN. No reportar datos ficticios ni inferir costes sin factura o fuente de consumo verificable.
