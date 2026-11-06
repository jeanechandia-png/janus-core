# JANUS · Kendra — originales privados instalables en iPhone
Fecha: 2026-11-06 · Europe/Amsterdam
Rama: `chatgpt/kendra-private-originals-import-20261106`
PR: https://github.com/jeanechandia-png/janus-core/pull/70 (DRAFT, base PR #69)

## Propósito y problema ya corregido
Los dos paneles de Kendra estaban compilando miniaturas JPEG de respaldo porque las 26 imágenes aprobadas reales seguían fuera del repositorio. Además, el repositorio `jeanechandia-png/janus-core` es **público**: publicar WebP originales allí revelaría los activos de la empresa sin necesidad.

## Implementado y verificado
- `lego/janus-original-art/janus-original-art.js`: módulo de importación por archivo del dispositivo para los **26 WebP originales** (4 criaturas, 10 accesorios, 12 expresiones). SHA-256 portátil, sin Internet/WebCrypto/CDN/API, por lo que funciona también en vistas offline `file://` de iPhone si existe permiso de archivos. Validación completa antes de registrar cualquier imagen. Si IndexedDB está disponible se guarda localmente; de lo contrario no se afirma persistencia y la interfaz avisa.
- `build.cjs`: embebe sólo los 26 hashes SHA-256 esperados y el módulo, sin incluir imágenes privadas en el repo público.
- `lego/janus-presence/janus-presence.js`, `src/companero.js`: prioridad visual de las imágenes exactas en escenario, selección, accesorios y expresiones; importación accesible en el panel «Papá», sin recreación de las pantallas ni acceso externo. Se corrigió el nombre del selector (`defaultName`).
- `tests/private-original-art.test.cjs`: pruebas deterministas de las 26 firmas, integridad, paquetes incompletos y material alterado. CI Core y 3D/E2E verificados en commit `ee5c013dbe2fa2e0a3a757d503c96c231c20f417` (antes de las actualizaciones documentales).
- Archivo privado de usuario entregado: `JANUS_KENDRA_26_ORIGINALES_PRIVADOS.json`, 257122 bytes, SHA-256 `293071771a51ca268c147f097b9ec3d8767aa8f7119bd256155ddd2bf41eb4f8`, preparado de `janus_kendra_arte_aprobado_20261106.zip`. Este archivo está en la conversación, no en GitHub.

## Verdad sobre 3D
**0/4 GLB hiperrealistas aprobados.** Las 26 imágenes oficiales son arte 2D: aunque la ilustración es cinematográfica, no contiene geometría, esqueleto, pelo físico ni morph targets. El nuevo importador NO genera modelos 3D, no se declara producto terminado. El gate y exportador GLB ya existen en PR #69, pero siguen bloqueando la versión final cuando faltan modelos.

## Kling Standard
El usuario ha contratado Kling Standard por la web. No existe conector de Kling directo autorizado en este chat. Kling convierte imagen en vídeo (MP4), no exporta directamente GLB interactivos. Archivo portátil `KENDRA_KLING_4_CRIATURAS_PRODUCCION.zip` reúne las cuatro imágenes originales y 8 briefs de vídeo para utilizar créditos de Kling, incluyendo un clip publicitario de 5 segundos y una idea de giro como referencia NO geométrica.
No atribuir a este trabajo generaciones en Kling ni créditos consumidos: no se ejecutaron.

## Reproducibilidad y siguiente fase
1. Verificar CI sobre último commit y abrir los dos HTML A/B; desde «Papá» importar el archivo JSON por selector de archivos, comprobar el indicador 26/26 y que retratos/expresiones y prendas coinciden con las láminas.
2. Para producción **3D interactiva** realmente final, conectar un generador 3D capaz de exportar GLB/FBX (no el plan de vídeo), o GPU local con modelo de reconstrucción, y pasar esqueleto facial, pelo, materiales PBR, 360°, licencias y prueba iPhone.
3. Reconciliar PR #70 con #69/#67/#63 y la rama independiente de accesos e idiomas PR #66; conservar seguridad, nombres, estrellas y comportamiento. No hacer merge ni deploy de producción hasta prueba visual y autorización.

PRESENTE gobierna; conservar este documento como estado vivo, no borrar entregas anteriores.
