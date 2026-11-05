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
