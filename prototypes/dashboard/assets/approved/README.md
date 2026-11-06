# Kendra — arte aprobado de criaturas y accesorios (06-11-2026)

**DECISIÓN APROBADA:** las dos láminas originales aportadas por Jean definen la identidad de Lumi, Bombo, Musgo y Nimbo. El muñeco 3D procedural anterior NO es su representación aprobada.

## Integración técnica verificable

El paquete binario entregado a Jean se denomina `janus_kendra_arte_aprobado_20261106.zip`. Contiene 14 recortes WebP de las dos imágenes originales, `INDEX.json`, sus SHA-256, documentación y el instalador local seguro `install_into_checkout.py`. Para usarlo en un checkout de esta rama, los archivos `.webp` se copian a `prototypes/dashboard/assets/approved/`. El builder acepta solamente los hash del archivo `INDEX.json` de este directorio; si hay sustituciones, falla, no reproduce un diseño distinto.

`node prototypes/dashboard/build.cjs --skin a` y `node prototypes/dashboard/build.cjs --skin b` insertan esos datos directamente en HTML offline, sin CDN, sin cuentas adicionales y sin sustituir la pantalla real.

En ausencia de los nuevos WebP en el repositorio, el builder utiliza los cuatro JPEG existentes de `assets/creatures/` con aviso documental; el software no declara que estas imágenes de respaldo alcancen la calidad final de la lámina de 2026-11-06.

## Catálogo asociado a IDs reales (no crear objetos inventados)

| Archivo | SKU existente |
| --- | --- |
| capa-galaxia.webp | out:capa-galaxia |
| sudadera-estrella.webp | out:sudadera-estrella |
| chaqueta-lujo.webp | out:chaqueta-lujo |
| corona-estelar.webp | acc:cabeza:corona |
| gafas-glam.webp | acc:cara:gafas-redondas |
| mochila.webp | acc:espalda:mochila |
| alas.webp | acc:espalda:alas-hada |
| bufanda.webp | acc:cuello:bufanda |

`gorra.webp` y `auriculares.webp` son referencias aprobadas de catálogo futuro, **no** se muestran como si fueran productos con un SKU distinto ni se cobran estrellas por productos no implementados. Las imágenes 2D del catálogo no garantizan que la pieza encaje en la geometría del avatar temporal.

## Criterios de aceptación aún pendientes
- Importar los binarios exactos a la rama remota; GitHub APP disponible para esta ejecución permite cambios textuales, no copia de los binarios desde el contenedor. **NO MARCAR COMPLETO** antes de verificar 14 archivos y sus hashes en el repositorio.
- GLB riggeados originales para los cuatro personajes; materiales de pelo, profundidad, parpadeos, sonrisa, boca, visemas, gestos, accesorios en sockets y variaciones de expresión; validar rendimiento GPU iPhone.
- Comprobar las dos dashboards y la app independiente Kendra instaladas en Safari con permisos correctos. Ningún test de Chromium sustituye una prueba física Safari.
- Fusionar PR #67 con #63 y reconciliar PR #66 **solo** tras revisiones y pruebas sin regresiones. No cambiar landing ni producción sin autorización.

## Historial
Los archivos de referencia 3D anteriores continúan como históricos; no se borraron escenas, recompensas, lecciones, prendas, controles de voz ni identidades. La prioridad visual vigente es el arte aprobado, sin simular que una fotografía animada es un modelo 3D.
