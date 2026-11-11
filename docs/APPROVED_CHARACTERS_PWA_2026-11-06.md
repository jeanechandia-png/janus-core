# JANUS CORE — Integración de personajes originales en PWA canónicas
Fecha: 2026-11-06. Estado: código propuesto para revisión, SIN merge y SIN despliegue.

## Referencia real y linaje
Único repositorio: jeanechandia-png/janus-core. Rama de esta integración creada del HEAD verificado de la PR #66 (8621b3d03bb1e02a8e5809058cd13ef09c4f975d); línea canónica de /dashboard/a, /dashboard/b, / y /kendra. No se creó ninguna dashboard nueva, no se utilizó la PR #79/#80 como interfaz ni se tocó landing/producción.

## Originales adjuntos e inmutables
Los archivos originales que Jean aportó en el chat (ninguno se redibujó ni se publicó en el repositorio público) tienen los siguientes SHA-256:
- Kendra, cuatro criaturas y accesorios: A40EABCE-7ED9-4171-94B2-F79A5CDF0CFC.jpeg — 87d977714b2b2dc03f426151b731e0b3f1936be7e0d81c09108377bf4b1af5e3, 1536×864.
- Janus 02 Nexo masculino: 53A5A4DD-A3C3-43E7-B901-F4DC26A44216.jpeg — fbb0ba9cf9923848600b866a0b31ecc44d17013e627024b7c5b566c09d78aeb1, 1535×1024.
- Referencia histórica femenina: F520DA9D-91F2-41A4-B1F4-C4F37FBF2E7A.jpeg — 4d21d78ab32c352a2207aa62043d32b52ef4971eede93051925b8c89b24861b1, 1536×1024.

Las referencias son 2D de origen 1536 px, NO fotos nativas 4K y NO modelos 3D. No se sustituyen silenciosamente con imágenes generadas. El nuevo módulo solo admite originales exactos mediante SHA-256 en IndexedDB local; exhibe recortes de esas mismas láminas **sin alterar sus píxeles** como modo referencial, claramente marcado 2D.

## Implementación funcional
- Se reutilizan **blobs existentes** de Three.js, glTF kit y JanusCreatureSlot; no se crea otro motor ni otro repositorio. Los GLB de los seis slots de identidad se cargan, validan y persisten en el dispositivo sin subir datos ni gastar créditos; deben pasar malla, rig, accesorios, morphs y clips, más revisión humana de identidad/estética antes de considerarse finales.
- Los controles del padre son accesibles tras autenticación (Founder) o PIN parental (Kendra). La PWA nunca envía los archivos a proveedores. La importación no depende de Runway ni Kling.
- En /kendra se sustituye la **representación SVG genérica** por el stage del personaje oficial, sin alterar la lógica de emparejamiento, tareas, seguridad infantil, estrellas, ropa, permisos ni API /api/kid.
- En / se añade la presencia JANUS 02 NEXO al lado del control existente de voz. En /dashboard/a y /dashboard/b se ofrece un visor GLB desde el menú de acceso ya existente, sin reemplazar las interfaces A/B.
- Gestos táctiles para rotación de modelo GLB, animación y morphs cuando el rig correcto está realmente cargado. CSS responsive y reducción de movimiento. Service Worker offline cache v15 con motor reutilizado.
- Sin créditos adicionales, generación ni contratación.

## LÍMITE / BLOQUEO REAL
Los seis GLB cinematográficos **no constan aquí como archivos verificados, aprobados y disponibles**. La herramienta de GitHub de esta sesión permite escribir el código, pero NO adjunta los JPEG privados a la PWA remota ni crea modelos 3D por convertir una imagen en código. Por tanto, esta PR NO demuestra hiperrealismo 4K ni dashboards 100% completos; los originales pueden instalarse desde archivos exactos en un dispositivo autorizado y los GLB deben producirse/importarse y validarse sin alterar la identidad.
No publicar ni hacer merge automático. No declarar PASS de Safari físico ni E2E sin evidencia.
