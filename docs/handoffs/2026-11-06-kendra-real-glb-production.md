# INFINITYSEED GROUP — TRANSFERENCIA OPERATIVA / 3D REAL
Fecha: 2026-11-06 · Europe/Amsterdam
Proyecto: JANUS CORE / dashboard Kendra
Agente saliente: GPT-6 · Entrante: por asignar
Rama: chatgpt/kendra-verified-hyperreal-glb-gate-20261106
PR: https://github.com/jeanechandia-png/janus-core/pull/69 (DRAFT)
Base: PR #67 @ 7ceaa34b8b2d5d8f26fb8cc76b552ab67f969bce
Entorno productivo: SIN ALTERAR

## OBJETIVO OPERATIVO
Integrar, no sólo mostrar una fotografía, los cuatro personajes originales aprobados por Jean como modelos GLB 3D auténticos con pelaje/materiales, cara expresiva, boca articulada y accesorios. Conservar PR #63 (escenas animadas) y #66 (PWA/idiomas). Rechazar sin excepciones los cuerpos simplificados procedurales como sustitutos de arte final.

## VERIFICACIÓN REAL
- Repositorio PR #67 comprobado: sólo contiene dos GLB sintéticos en `tests/fixtures`. La carpeta `assets/approved/` contiene INDEX/README, no los 26 WebP binarios de la ZIP previa.
- Referencias originales: 4 personajes (Lumi, Bombo, Musgo, Nimbo), 26 WebP preparados anteriormente y verificables contra `INDEX.json`.
- Proyecto de InVideo existente: `https://invideo.io/@jean-224827/janus-criaturas-3d-lumi-bombo-musgo-nimbo`. Se incorporaron cuatro retratos individuales como referencias. Consulta actual: 50 créditos disponibles; precio de una malla sin textura rápida: 4,8 créditos (dry_run). Al intentar generar recibió **free_generation_gate**: el plan no permite generación, no hubo cargo ni archivo GLB.
- No hay Blender, bpy ni pesos de un modelo image-to-3D instalado en este entorno. Desktop Commander no tiene equipos conectados. No se ha contratado ningún proveedor nuevo.

## CAMBIOS IMPLEMENTADOS EN GITHUB
- `prototypes/dashboard/tools/verified-creature-glb.cjs`: auditoría de GLB binary, triángulos, textura PBR/normal, 13 huesos, 10 sockets, 8 morphs, 6 clips, hashes de binario y arte aprobado, capturas de 5 ángulos, revisión física Safari y aceptación de Jean. Rechaza cualquiera que no esté realmente completo.
- `assets/approved/models/REGISTRY.json`: registro de los cuatro con estado vacío — **0/4 GLBs aprobados**, sin inventar componentes.
- `lego/janus-creature-slot/janus-approved-glb-bootstrap.js`: carga GLB aprobado automáticamente desde datos locales, verifica SHA con WebCrypto cuando está disponible, reusa el loader y rig existentes, nunca pisa el GLB de usuario restaurado de IndexedDB.
- `prototypes/dashboard/build.cjs`: embebe únicamente GLB aprobados en ambos HTML offline. Opción `--require-approved-3d` rechaza entregar la versión definitiva mientras falten originales.
- `prototypes/dashboard/src/companero.js`: recupera modelos personales primero, monta los aprobados después, respeta el modo de visualización elegido por Kendra.
- `tests/verified-3d-gate.test.cjs`, workflow de CI especializada: verifican que un fixture no pase por criatura oficial.
- `tools/run-local-creature-reconstruction.py`: adaptador local-first para TripoSR instalado por separado. Produce un borrador de malla, NO simula rig/expresiones aprobadas y nunca altera las dashboards. Requiere hardware/pesos instalados.

## CRITERIOS DE ACEPTACIÓN NO CUMPLIDOS
- Cuatro GLB de imágenes originales con volumen, pelo, ojos y boca, materiales PBR y normales con calidad visual idéntica a referencias. **PENDIENTE: 0/4**.
- 13 huesos, 10 sockets, 8 morphs, 6 clips por personaje — **PENDIENTE**.
- Capturas frontales/laterales/posteriores, detalle de rostro y accesorios; firma de aprobación, test físico Safari/iPhone y rendimiento — **PENDIENTE**.
- Importación de 26 WebP binarios a la rama, revisados por hash — **PENDIENTE**.
- Reconcilación PR #63, #66 y publicación — **NO AUTORIZADA, NO REALIZADA**.

## SIGUIENTE ACCIÓN EJECUTABLE
Conectar un generador image-to-3D que admita las cuatro referencias en el presupuesto aprobado (opción `fal` disponible para conectar) o proporcionar una máquina autorizada con GPU y TripoSR/Hunyuan3D. Producir GLB por criatura y revisarlos visualmente antes de intentar completar el registro. Sin conexión/hardware suficientes, no convertir un ensayo procedural en entrega final.
Después pasar QA de glTF con este repositorio, pruebas E2E de A/B y Safari iPhone, y reconciliar PRs.

## LECCIÓN PREVENTIVA
«CI verde» significa que el código funciona, NO que el arte hiperrealista se haya producido ni que exista una imagen GLB final en GitHub. Los manifiestos vacíos no equivalen a modelos. La opción `--require-approved-3d` impide repetir esa confusión.


## ACTUALIZACIÓN: proveedor fal habilitado y comprobado (2026-11-06)
- El usuario conectó **fal** a esta conversación. Se consultó el catálogo para generación 3D: Hunyuan3D v3.1 Pro, Trellis 2 y Tripo H3.1 admiten GLB según esquemas de salida (no acreditan rig ni fidelidad exacta).
- La comprobación de cuenta autenticada `Jean Echandia` devolvió **`balance_exhausted`**: generación y subida de imágenes bloqueadas hasta disponer de créditos. **No se realizaron cargas ni generaciones de pago. No se intentó cambiar de cuenta.**
- Recuperación oficial, si se autoriza gasto: https://fal.ai/dashboard/usage-billing/credits?utm_medium=fal_mcp&utm_campaign=balance_exhausted&utm_content=openai#buy-credits
- **CI VERIFICADA:** commit `881acdd667f9727df07c3a32445eec6d1d338ea0` con Janus Core `success` en https://github.com/jeanechandia-png/janus-core/actions/runs/42260939875 y 3D/E2E `success` en https://github.com/jeanechandia-png/janus-core/actions/runs/42260939883. El primer ensayo de 3D falló por cambio de Ubuntu 26.04 del runner; el workflow se corrigió a Ubuntu 24.04 y pasó. No son pruebas físicas Safari.
- **0/4 GLB finales** en el repositorio, no fusionar ni publicar como completado. Las cuatro referencias 2D separadas están cargadas en el proyecto InVideo existente, pero ese servicio también rechazó generación por plan gratuito.
- **Reanudar únicamente cuando exista producción 3D real** vía proveedor ya habilitado con crédito autorizado o máquina local con GPU y motor image-to-3D instalado. Aplicar el control de firma y la revisión visual antes de poblar `REGISTRY.json`.


## ACTUALIZACIÓN CRONOLÓGICA — 2026-11-07, normas estrictas de arte/UI

Instrucción actual: continuar ÚNICAMENTE en JANUS CORE / PR #69 y conservar dashboards Obsidiana/Platino, Janus Nexo 02, micrófono, voz, proyectos y estadísticas. Los controles de Kendra no pueden ser una ventana flotante del viewport ni se agregan botones o tarjetas de relleno.

### Código modificado en la misma rama
- `lego/janus-edge-companion/janus-edge-companion.js`: `stageHost()` localiza la tarjeta real `.vb-companero .cpst3.edge-hero`; el canvas WebGL se añade como hijo del escenario existente, no al `document.body`. Posicionamiento/arrastre medidos en coordenadas LOCALES, respetando la zona de diálogo, selección y ejercicios. Tras una reconstrucción del dashboard reanexa EL MISMO renderer al nuevo escenario; no clona la criatura ni abre un contexto WebGL adicional.
- `lego/janus-edge-companion/janus-edge-companion.css`: `position:absolute` y `z-index:1` dentro del escenario, por debajo de controles; desaparece el overlay de pantalla completa.
- `src/companero.js`: etiquetas del modo de escena corregidas, sin modificar permisos, lecciones, botón de voz ni estructura del panel.
- `src/companero-stage.css`: refuerzo de bordes, divisorias de escenario/panel y relieve/contraste de controles EXISTENTES, con estados activos, foco accesible y pulsación; sin añadir botones ni sustituir iconos/GLB.
- `tests/edge-companion.test.cjs`: comprueba que no exista overlay en `body`, que el canvas sea hijo del stage, los límites en iPhone y que no aparezca un renderer duplicado al reconstruir la vista.

### Evidencia y límites
- Se realizó una modificación directa en la rama EXISTENTE `chatgpt/kendra-verified-hyperreal-glb-gate-20261106`; PR #69 permanece en borrador. No se crearon ramas, repositorios, duplicaciones de producto ni despliegues.
- Janus Core CI pasó para la revisión de código `77ea6120249efd7fe2c54bbb8ef051c95e49edb3`: https://github.com/jeanechandia-png/janus-core/actions/runs/42364398980. Verificar de nuevo tras la incorporación de este addendum.
- Ejecución CI 3D/E2E iPhone emulado para esa revisión: https://github.com/jeanechandia-png/janus-core/actions/runs/42364398995. Consultar conclusión final; un navegador emulado NO acredita funcionamiento en Safari iPhone físico.
- El repositorio todavía posee **0 de 4 GLB aprobados**. Aunque exista renderer Three.js, NO significa que Lumi/Bombo/Musgo/Nimbo tengan malla esculpida 4K PBR final, expresiones y gestos producidos o aceptados. Nexo 02 es un rig procedural real, no un GLB hiperrealista final aprobado.
- La capa de iconografía 3D existente (`premium.css`/`janus-gold`) permanece preservada, pero no se certifica un reemplazo de todos los iconos por iconos PBR; exige auditoría por vista y aprobación.

### Reanudación exacta por siguiente agente
1. Verificar HEAD exacto, `npm run continuity`, pruebas de `prototypes/dashboard/tests` y conclusiones de los workflows del HEAD.
2. Revisar capturas generadas por CI de Obsidiana/Platino a 390/430px y probar iPhone Safari físico; verificar que la criatura nunca bloquea botones ni lecciones.
3. Cuando existan GLB originales reales y permiso del Founder, validar contratos y QA visual en `tools/verified-creature-glb.cjs`, registrar modelos aprobados y usar `node prototypes/dashboard/build.cjs --require-approved-3d`; reconciliar PR #63 y #66 antes de fusionar; no desplegar ni etiquetar como final hasta aprobación.
