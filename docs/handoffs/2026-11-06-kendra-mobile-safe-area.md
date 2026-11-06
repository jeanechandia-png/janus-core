# INFINITYSEED GROUP · JANUS / KENDRA
## Transferencia: corrección geométrica del compañero móvil
Fecha: 2026-11-06 (Europe/Amsterdam)
Proyecto: JANUS CORE — dashboard Kendra / Sala / móvil
Rama: chatgpt/janus-presencia-criaturas-cinematica-20261105 (PR #63, sin fusionar)
Línea base comprobada: ab2dbbecf924cc41213ccbfa305530c1b25ef182
Último commit de código antes de documentar: dbd9e2e7ec869c21eb0094ffb6d3694732d4cf0b

### Objetivo
Las capturas reales del iPhone muestran que el avatar procedimental de Lumi interfiere con botón «Muéstramelo», selector de criaturas y zona de aprendizaje. El producto aprobado exige 3D expresivo, movimiento en margen y controles completamente funcionales. Preservar diseños aprobados (Lumi/Bombo/Musgo/Nimbo; Nexo 02 masculino/femenino), perfiles, autonomía, estrellas y catálogo; no crear otra dashboard.

### Implementación
1. `prototypes/dashboard/lego/janus-edge-companion/janus-edge-companion.js`: calcular tamaño/posición respecto a `.vb-companero .cpst3` y rectángulos reales de bocadillo, botones de escena, HUD de lección y barra selectora. Limitar arrastre y paseo a zona libre; ocultar avatar cuando la escena sale de pantalla; respetar WebGL/LOD/reduced-motion/ropa/gestos.
2. `prototypes/dashboard/tests/edge-companion.test.cjs`: nueva prueba determinista de móvil 390×844, exclusión de zonas interactivas, arrastre y ocultación al desplazarse.
3. `prototypes/dashboard/tests/edge-mobile-visual.cjs`: prueba Chromium con geometría real A/B, pantallas 390×844 y 430×932, capturas completas, clics en pestañas y errores de JS. Si WebGL no está disponible conserva fallback y no afirma GPU real.
4. `.github/workflows/janus-creatures-ci.yml`: nueva puerta E2E con Playwright/Chromium, imágenes QA como artefactos retenidos 7 días.

### Verificación
- Sintaxis y pruebas deterministas + builds A/B: el workflow especializado #42135721592 mostraba pasos correctos al registrar este documento; **verificar conclusión final antes de marcar E2E como superado**.
- Core CI (commit anterior del ajuste) #42135106898: success, verificar nueva cabeza.
- No se han probado GPU real en iPhone, Face ID, ni modelos GLB 4K. La malla procedural sigue siendo distinta de las imágenes artísticas aprobadas. Importación de modelos cinematográficos con rig facial y ropa sigue PENDIENTE.

### Continuidad y restricciones
- PR #66 contiene accesos e idiomas en rama de integración Core; no fusionar a ciegas PR #63 con PR #66, #60/#61/#64 ni alterar main, landings o Melanie. 
- Próxima acción: CI verde del E2E 390/430, revisar artefactos visuales A/B; si falla, corregir y repetir. Luego incorporar modelos GLB aprobados con prueba GPU real iPhone/iPad y resolver la reconciliación con JANUS CORE sin regresiones.
- Preview QA de ejemplo aislada (GitHub Pages): `qa/janus-2026-11-05/obsidiana.html` y `platino.html`; no es un acceso autenticado ni producción.
