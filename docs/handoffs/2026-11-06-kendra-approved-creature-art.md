# INFINITYSEED GROUP · TRANSFERENCIA MULTIAGENTE
## JANUS / KENDRA — ARTE APROBADO · 6 NOV 2026

**ESTADO:** código implementado en rama de revisión; 26 WebP exactos construidos en paquete local, **binarios aún no publicados en GitHub**. Modelos 3D hiperrealistas, rigging y animaciones definitivas: **PENDIENTE**.

- Repositorio: `jeanechandia-png/janus-core`
- Base: PR #63 `chatgpt/janus-presencia-criaturas-cinematica-20261105` @ `18784451457236f6926cbd568568214e938fe278`
- Rama de ejecución: `chatgpt/kendra-approved-art-20261106`, PR #67 (DRAFT)
- Ramas relacionadas: PR #66 idioma/accesos PWA Core, PR #63 escena/Three.js. No fusionadas aquí.
- Fuente visual aprobada: dos imágenes adjuntas por Jean (6 nov 2026), la ilustración principal de Lumi y el catálogo de Lumi/Bombo/Musgo/Nimbo. NO usar una criatura procedural como apariencia final aprobada.

### IMPLEMENTADO Y ESCRITO
1. `prototypes/dashboard/build.cjs`: registro `APPROVED_ART`, carga fotos/expresiones/accesorios locales y EMBEBE cada WebP en HTML offline A/B. Verifica hashes SHA-256 de `assets/approved/INDEX.json`; falla si hay sustituciones. Fallback independiente a retratos JPEG existentes sin fingir acabado final.
2. `src/companero.js`: migración visual del antiguo modo edge procedural a «Arte aprobado» cuando no se ha importado un GLB; mantiene 3D técnico explícito, nombres personalizados, cambio de criatura, aprendizaje, TTS, estados, premios, compras y autorizaciones. Vestidor con selector de las cuatro especies, tarjetas de accesorios originales, galería de expresiones faciales con botón real `cpMood` y SKU reales. Los dibujos no simulan morphs ni GLB.
3. `src/companero.css` y `lego/janus-presence/janus-presence.js`: presentación con imágenes originales, rejillas móviles y accesibilidad.
4. `tests/approved-art.test.cjs`, `tests/kendra-identity.test.cjs`, `tests/edge-companion.test.cjs`, workflow especializado. Seguridad: identidad del Founder (Nexo) NO se sustituye por criatura infantil.
5. `assets/approved/INDEX.json`: los 26 archivos esperados (4 retratos, 10 accesorios, 12 expresiones) y sus SHA-256; `README.md` con mapeos reales tienda/personalización, diferencias entre referencia 2D y rig 3D.

### BUNDLE PORTABLE
Paquete `janus_kendra_arte_aprobado_20261106.zip`, creado en esta sesión y entregado en el chat, contiene `janus_aprobado/assets/approved/` (26 WebP, índice), `install_into_checkout.py`, documentación y hashes. Los recortes son EXACTAMENTE de las imágenes dadas por el usuario, sin generación de un personaje distinto. El ZIP NO está dentro de esta rama: una importación futura debe verificar que los 26 SHA coincidan antes de declarar deploy.

### VERIFICACIONES
- Ejecutar Core CI y Creatures CI en el HEAD de PR #67. No considerar suficientes las validaciones de ramas antiguas.
- 390×844 / 430×932 en Chromium A/B, selector de criaturas, vestidor, tienda, `cpMood`, acceso iPhone Safari y flujo de aprendizaje sin invasión de botones.
- El modo «Arte aprobado» muestra imagen exacta 2D; el modo «3D prueba» muestra mesh procedural provisional. No atribuir VFX hiperrealista a esas mallas.
- El empaquetador con **binarios exactos instalados** necesita build en checkout completo; el CI remoto sin WebP solo valida fallback y lógica.
- El proyecto no tiene GLB riggeados hiperrealistas de Lumi/Bombo/Musgo/Nimbo en esta PR. Pendientes: pelo y branquias finos, estructura de expresiones, visemas, mirada y labios, ropa en sockets, LOD, física, test en GPU iPhone, rendimiento.

### PRÓXIMA ACCIÓN EXACTA
1. Insertar los 26 binarios originales del paquete portable en `prototypes/dashboard/assets/approved/`, verificar SHA-256 contra `INDEX.json`, realizar builds offline A/B, screenshots y E2E.
2. Reconciliar este código y activos con PR #63 y PR #66 sobre base común comprobada, sin resetear identidad gráfica ni acceso, y verificar pruebas Core y visuales de Kendra.
3. Construir/importar GLB riggeados para cuatro criaturas aprobadas (la imagen 2D sola NO constituye un modelo 3D), con el contrato `lego/janus-creature-slot/CONTRATO.md`.
4. Validar en Safari/iPhone físico antes de publicar o llamar completo.

**No se ha modificado producción, landing, credenciales ni permisos.** Nunca presentar una nueva imagen, preview genérico o un test verde como modelo cinematográfico final.
