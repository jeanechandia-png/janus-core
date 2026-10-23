# Platino 3D (iconos de la piel B)
Medallones renderizados en 3D físico (three.js r160, `MeshPhysicalMaterial`, estudio de softboxes frío) en Chromium headless (SwiftShader):
canto de **platino** pulido, esmalte **zafiro** abombado (cabujón) con rayos finos y el símbolo Lucide convertido en relieve **macizo** de platino con bisel
(los trazos se transforman en contornos con Clipper y se extruyen). Es el equivalente en claro de los objetos de oro + obsidiana de la piel A:
sin reflejo ni halo incrustado, fondo transparente y la sombra la pone el CSS de B.

Uso (los medallones ya generados están en `lego/janus-platino/assets/obj/`, un WebP de 256 px por icono Lucide):
1. Carpeta de trabajo con `nm/` → `node_modules` que contenga `three@0.160.0`, `clipper-lib` y `lucide-static` (`npm i three@0.160.0 clipper-lib lucide-static`); copia `render.html` ahí.
2. `python3 -m http.server 8765` en esa carpeta.
3. `PLAYWRIGHT_MODULE=… SHARP_MODULE=… node tools/platino3d/run.cjs all` (≈4 s por icono; `EXTRA=plane` añade iconos sueltos).
`build.cjs` los incrusta en `GOLD.p`; `src/icons.js` (`EMO_PT`, generado por `tools/gen-icons.cjs`) y `phonea2.js` los eligen solo en la piel B.
Licencias: three.js MIT · Lucide ISC · Clipper (Boost).

Qué emoji pasan a medallón y cuáles son «solo B»: `tools/gen-icons.cjs` (`MAP` = A y B; `PT_ONLY` = solo B, A los deja como emoji). Tras añadir un nombre: `node tools/platino3d/run.cjs <nombre>`, regenerar `src/icons.js` (OJO: con otra versión de Lucide cambian los trazos vectoriales de A; añade solo las líneas nuevas) y repetir `tests/skin.cjs`.
