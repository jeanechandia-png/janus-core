# Oro 3D renderizado (pipeline)
Render físico (three.js r160, MeshPhysicalMaterial metalness 1 + estudio de softboxes) en Chromium headless (SwiftShader).
- `render.html`: `R.text` (letras/cifras extruidas con bisel; `fixed:true` = misma altura para todas las cifras), `R.iconCoin` (moneda con canto de oro, esmalte y símbolo Lucide en hilo de oro), `R.frame` (marco 9-slice).
- Acabados: `pulido`, `satinado`, `champan`.
- Uso: servir la carpeta por HTTP (`python3 -m http.server 8765`) con `nm/` enlazado a node_modules (three, opentype.js, lucide-static) y `node run.cjs jobs.json`.
- Fuentes: Cinzel 900 (wordmark) y Bodoni Moda 700 (cifras), OFL.
