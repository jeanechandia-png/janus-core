# INFINITYSEED GROUP — Transferencia de dashboards y accesos JANUS/Kendra
Fecha: 2026-11-06 (Europe/Amsterdam)
Proyecto: JANUS CORE
Agente saliente: ChatGPT (sesión de continuidad)
Agente entrante: por asignar
Estado: IMPLEMENTADO EN RAMA / CORE CI VERIFICADA / DISPOSITIVOS PENDIENTES

## OBJETIVO PRINCIPAL
Incorporar los DOS medallones de idioma ES/NL originales facilitados por el Founder en los dashboards existentes, con animación táctil compacta, y mantener accesos tipo app separados para Janus y Kendra. No rehacer ni sustituir la UI 3D, escenas aprobadas, pantallas ni seguridad existente.

## ESTADO ACTUAL VERIFICADO
- Repositorio: jeanechandia-png/janus-core
- Línea base verificable: PR #59, commit 8120c00d5ea04cf8932bd60cb1971a5626ccdd2c.
- Nueva rama aislada: chatgpt/janus-approved-language-access-20261106 (derivada exactamente de esa línea base).
- main al recuperar contexto: 7ddfe245f15ec53438c2db98dbb7b137420ebcf9.
- PR #65 (d9c640fd2b550b1618589a8bc83ba83d7f73e501) contiene las piezas de diseño aprobadas y se conserva, pero fue creada sobre main antiguo y abrió /companion.html en lugar de reutilizar /kendra del Core; NO copiar ese reemplazo ni fusionar a ciegas.
- PR #63 conserva geometría/escenas/criaturas 3D y avances posteriores por integrar; ramas divergentes, no autoriza sobreescritura.

## CAMBIOS REALMENTE ESCRITOS
- `apps/pwa/language-art/nederland.webp.b64` y `espana.webp.b64`: copiar EXACTAMENTE las miniaturas WebP de imágenes aprobadas de PR #65, sin regenerar/alterar dibujo.
- `apps/pwa/language-buttons.{js,css}`: componente visual LEGO local-first; 44 px de área táctil, 32 px de arte, destello activo, reflejo al tocar, reduced-motion, etiquetas accesibles, estado por perfil y caché.
- `apps/pwa/dashboard-access.{js,css}`: incorpora los botones en la cabecera de los dashboards verdaderos A/B que sirve JANUS CORE (no crea dashboard nuevo).
- `apps/pwa/index.html` y `app.js`: mismo componente en pantalla de control y autenticación del Founder; traduce primera capa de controles.
- `apps/pwa/kendra.html`, `kendra.js`, `kendra.css`: controles en cabecera original y traducción parcial de navegación, sin tocar lógica de `/api/kid/*` ni emparejamiento con tutor.
- `apps/pwa/kendra.webmanifest`: icono JANUS dorado aprobado reutilizado; conserva PWA independiente id/start_url `/kendra`. Manifest Founder conserva `/dashboard/a` e identidad `/`.
- `apps/pwa/sw.js`: precache offline de módulo y arte, cache shell v14; seguridad de respuesta API sin caché preservada.
- `tests/dashboard-language-access.test.ts`: pruebas de regresión de ruta A/B, app Kendra, perfiles aislados, imágenes originales, CSS, PWA y caché.

## CRITERIOS DE ACEPTACIÓN Y PRUEBAS
- Lectura de GitHub y revisión de archivos: realizados; cambios registrados mediante commits concretos en la nueva rama.
- **CI del núcleo verificada** en commit `a0b685beebccea9f7d99f3da58a788eec5103b42`: [Janus Core CI #42131385129](https://github.com/jeanechandia-png/janus-core/actions/runs/42131385129), final `success`; pasos Typecheck, PWA syntax, Sidecar syntax, Tests (incluyendo nuevas regresiones) y Runtime smoke `success`. No implica E2E visual, rendimiento GPU ni aceptación de usuarios. Si este documento cambia en un commit posterior, comprobar CI de ese nuevo HEAD.
- iPhone físico (Safari e instalación desde pantalla de inicio), reflejo/estética y icono real: NO VERIFICADO.
- Traducción ES/NL actual: etiquetas de primera capa. Contenido dinámico, TTS/STT, lecciones y textos completos NO localizados; no atribuir traducción total.
- Arte original: miniaturas WebP existentes de PR #65; no se declara 4K nativo ni GLB final.

## DECISIONES PROTEGIDAS
No tocar la landing ni la web pública de Melanie, no modificar production, no hacer merge, ni instalar/activar proveedores. No cambiar roles, PIN/Face ID, emparejamiento Kendra ni guardas del Core. Preservar el icono dorado distinto de los botones ES/NL, que NO se superponen al icono.
No reconstruir ni degradar las escenas 3D; merge con #63 requiere una reconciliación independiente y pruebas.

## PRÓXIMA ACCIÓN EXACTA
Ejecutar `npm ci && npm run typecheck && npm test && node prototypes/dashboard/build.cjs && node prototypes/dashboard/build.cjs --skin b` en checkout completo de esta rama, con `node tests/runtime-smoke.mjs` si está disponible; revisar CI. Después, verificar visualmente /dashboard/a, /dashboard/b y /kendra bajo JANUS CORE, navegación/rol, instalación PWA iPhone y persistencia local del idioma sin perder diseño; resolver diferencias con #63 antes de merge. El responsable debe aprobar el merge/despliegue tras criterios.

## REGISTRO DE EVIDENCIAS
- PR de origen del diseño: https://github.com/jeanechandia-png/janus-core/pull/65
- PR de integración Core: https://github.com/jeanechandia-png/janus-core/pull/59
- PR de criaturas/escenas posterior: https://github.com/jeanechandia-png/janus-core/pull/63
- Rama: https://github.com/jeanechandia-png/janus-core/tree/chatgpt/janus-approved-language-access-20261106

## 2026-11-06 — corrección adicional de las cabeceras reales
- Tras contrastar capturas de móvil con código A/B, se eliminó la barra flotante `position:fixed` de `apps/pwa/dashboard-access.js`. Ese overlay competía con los controles originales y violaba la instrucción de no sustituir ni superponer elementos a la dashboard.
- El mismo módulo `mountLanguageButtons` (con los medallones originales de PR #65) reside ahora dentro de las cabeceras reales: `#view .vh` en Sala/Compañero, `#dash .a2h/.pvh/.hd` en dashboards A/B y teléfono.
- Observador limitado a la región `#app` reanexa el componente cuando el render sustituye el header; no crea ni duplica dashboards, autenticación o datos.
- Los enlaces de identificación, control del Founder, Kendra e instalación siguen disponibles detrás de un menú compacto accionable (`<details>`) dentro del mismo header. Los dos PWA manifests mantienen identidades distintas y sus iconos originales.
- `apps/pwa/dashboard-access.css`: tamaños táctiles y distribución responsive, panel de accesos solo al solicitarlo, sin barra fija permanente.
- `tests/dashboard-language-access.test.ts`: prueba preventiva para impedir recuperar el overlay flotante.
- **CI de Core verificada**: workflow #42135377617 concluyó `success` para commit `1c6660e6a02baf67449992f7754281aee71776c9`. Comprobar nuevamente si cambia la rama después de este registro documental.
- La verificación visual e instalación física en Safari/iPhone sigue pendiente. No confundir CI con aprobación VFX, modelos GLB finales o localización completa.
