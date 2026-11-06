# Incidencia: dashboards vacíos en el visor del iPhone · 2026-11-05

**Contexto:** Kendra / JANUS Founder. Cambio añadido a PR #63; dashboard A/B estáticos descargables antes se abrían como páginas negras dentro del visor de archivos en iPhone. Captura de prueba del usuario: fondo negro y una barra visible; ningún control.

## Error → causa → impacto → lección → regla → cambio → verificación

- **ERROR observable**: los dos archivos HTML autónomos se ven vacíos al abrir como documento en el visor móvil del chat, pese a que pasan la CI y funcionan en Chromium con JavaScript activo.
- **CAUSA confirmada en prueba de reproducción**: las páginas sólo contenían un contenedor vacío y un bootstrap JavaScript de aproximadamente 3 MB. Sin ejecución de scripts, el documento tenía **0 caracteres de texto visible**. La previsualización de documentos del iPhone no es una superficie fiable para aplicaciones JavaScript/WebGL.
- **IMPACTO**: el usuario recibe archivos aparentemente rotos e inutilizables aunque su build sea técnicamente correcto. Los tests de sintaxis/compilación no cubrían modo JS desactivado ni el visor Quick Look.
- **LECCIÓN**: una compilación correcta no implica experiencia utilizable. Para artefactos HTML enviados por el chat hay que verificar además una primera pintura funcional sin JS y suministrar una ruta HTTPS para interactividad.
- **REGLA PREVENTIVA**: ningún dashboard HTML descargable puede mostrar una pantalla vacía sin JavaScript. Debe existir un fallback estático renderizado antes del primer `<script>` y su ocultación sólo tras éxito de bootstrap de la app; el fallback debe advertir que es una vista de archivo, no la app funcional.
- **CAMBIO**: `prototypes/dashboard/build.cjs` ahora empaqueta una vista previa responsive con identidad Janus, módulos, imagen de marca incrustada y aviso de limitaciones del visor. En una carga con JS funcional, `janus-ready` oculta el fallback tras encontrar texto real en `#dash` o `#view`. Si JS falla/no se ejecuta, muestra contenido real, scroll normal y no pinta el contenedor vacío. Conserva dashboards A/B y otros módulos, sin cambios en `main`.
- **TESTS**: `tests/ios-quicklook.test.cjs` corre después de `build.cjs` sobre A y B; verifica estructura de texto, recursos incrustados, prioridad del fallback, CSS de boot y presencia de la aplicación 3D. Se añadió a `.github/workflows/janus-creatures-ci.yml`.
- **VERIFICACIÓN ejecutada**: build CI en commit `e90e9413bf69b73ee2b131d3e311467b0d96c00d` pasó en [run #42100998736](https://github.com/jeanechandia-png/janus-core/actions/runs/42100998736) y [Core CI #42100998747](https://github.com/jeanechandia-png/janus-core/actions/runs/42100998747). Artefactos descargados, probados en Chromium 390×844: **JS desactivado** A/B muestran 580+ caracteres y el fallback visible; **JS activado** A/B tienen 1600+ caracteres, `janus-ready`, dashboard interactivo visible, **sin errores JS**.

## Entrega que sí funciona en iPhone

- **Vista preliminar directa**: imágenes PNG reales de A/B (generadas desde Chromium con JS activo) que abren como imágenes normales en el chat, sin visor de HTML.
- **HTML corregidos**: generan vista preliminar con JavaScript desactivado. **No son interactivos si se abren como documentos en Quick Look.**
- **Vista interactiva HTTPS**: se emplea la rama `gh-pages` **ya existente** con publicación aislada en `/qa/janus-2026-11-05/`. No se toca `/index.html`, `manifest`, rutas existentes ni se publican datos locales de usuario. Workflow `janus-ios-preview.yml`: falla preventivamente si detecta `local/real.js` o `local/names.json`, empaqueta exclusivamente datos de ejemplo y publica A/B en el subdirectorio.
- **URL prevista tras despliegue Pages**: `https://jeanechandia-png.github.io/janus-core/qa/janus-2026-11-05/`. Verificar estado real de `pages build and deployment` antes de afirmar disponibilidad pública en respuestas.
- **Limitaciones no resueltas**: QA real con Safari iOS físico, soporte WebGL y GLB hiperrealistas finales, autenticación/datos reales en una aplicación segura, experiencia nativa/PWA. Los prototipos públicos de ejemplo **no** son acceso al backend personal.

## Continuidad

Mantener el módulo `JanusEdgeCompanion` y Nexo/Founder separados de las criaturas de Kendra; no reconstruir ni sobreescribir trabajo anterior. No afirmar despliegue principal ni 4K cinematográfico completado.

## Resultado comprobado del despliegue QA HTTPS

- GitHub Actions **pages build and deployment** ejecutado sobre `gh-pages` commit `37d8e5cdc0ceacda6333cf3357f7736b60c9d6dd`: [run #42101778605](https://github.com/jeanechandia-png/janus-core/actions/runs/42101778605) = **success**.
- Workflow de construcción y publicación de QA aislada: [run #42101744838](https://github.com/jeanechandia-png/janus-core/actions/runs/42101744838) = **success**.
- URL de entrada del QA: https://jeanechandia-png.github.io/janus-core/qa/janus-2026-11-05/ con enlaces a `platino.html` y `obsidiana.html`.
- Se verificó en la rama Pages que esos HTML contienen `janus-static-preview`; la raíz `index.html` conserva su SHA anterior `0f0b34cc98c7fc0b1fd00407178c044136ae59c0`.
- Pendiente **prueba física de Safari iOS** (la web herramienta no pudo recuperar `github.io` desde su infraestructura, por lo que la comprobación disponible es el despliegue Pages y pruebas Chromium, no una prueba Safari).
