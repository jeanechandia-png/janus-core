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
