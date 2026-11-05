# JanusHyper · Compañero 3D hiperrealista — HANDOFF

Estado: **PREVIEW PENDIENTE DE APROBACIÓN DE JEAN** (norma IS6: preview → aprobación → ZIP/integración). No se ha integrado en el dashboard ni se ha hecho merge.

## Qué es
Módulo LEGO reutilizable que modela, viste y anima a los compañeros de Kendra (Lumi, Bombo, Musgo, Nimbo) en 3D procedural. No usa herramientas de pago ni modelos glTF externos: todo se genera en el navegador con three.js (r160).

## Cómo reconstruirlo
```bash
# requiere node_modules con three@0.160.0 y esbuild
THREE_DIR=<carpeta node_modules> node build.cjs dist/janus-hyper.js          # bundle del motor (global JanusHyper)
THREE_DIR=<carpeta node_modules> node build-preview.cjs preview/janus-companero-preview.html   # preview autocontenido (un solo HTML)
```

## API (`JanusHyper.create(canvas, { creature, quality, light, style })`)
`setCreature(id, look) · setLook({fur,accent,eyes}) · setStyle('fur'|'vinyl') · setPose('idle'|'saluda'|'celebra'|'piensa') · wear(id, {main,accent}) · unwear(slot) · clearOutfit() · setWind(v, yaw) · setQuality('eco'|'normal'|'profundo'|'maximo') · setLight('cine'|'neon'|'dia') · walk (bool) · cam{yaw,pitch,dist,ty,auto}` y `JanusHyper.thumb(id, species, {size})` → dataURL con miniatura 3D. Catálogo: `CATALOG, SLOTS, TIERS, BY_ID, ANCH`.

## Estructura (`src/`)
| Archivo | Función |
|---|---|
| `sdf.js, species/*.js, creature.js` | cuerpos SDF → malla → esqueleto y pesos de piel automáticos |
| `fur.js` | pelaje en capas (shells) + **viento y inercia** (muelle por hueso, ondulación viajera) |
| `eyes.js, shading.js, mats.js, parts.js, studio.js` | ojos, piel húmeda/roca, materiales, estudio (luz, reflejos, bloom) |
| `anchors.js` | puntos de montaje por criatura (cabeza, cara, cuello, espalda, pies, manos, prenda) |
| `garment.js, items/torso.js` | prendas que se ajustan al cuerpo (SDF recortado, mangas, dobladillo en rib, bordes redondeados) |
| `items/*.js, catalog.js` | 58 prendas/accesorios, precio propuesto en estrellas y rareza |
| `equip.js` | ponerse/quitarse piezas, ocultar rasgos que estorban (alas, flor, helechos), recortar pelo bajo la ropa y zapatos |
| `thumbs.js` | miniaturas 3D de todos los accesorios (también de los bloqueados) |

## Hecho (verificado con renders reales, motor SwiftShader)
- Las 4 criaturas se modelan, se animan (4 poses) y se visten; 58 miniaturas generan sin errores (Lumi y Nimbo).
- Pelo con viento + inercia al desplazarse (implementado; verificado el render estático con viento; **el movimiento fino no se ha visto en vídeo**).
- Ropa de calle moderna (sudadera, bomber, varsity, plumífero, cuero, tie-dye, chándal, techwear…), calzado sneaker, gorras, gafas, cadena de oro con eslabones, mochilas, alas, auras.

## Pendiente
- Probar el catálogo completo en Bombo, Musgo y Nimbo (solo se han revisado combinaciones sueltas) y ajustar `anchors.js`.
- Medir rendimiento en iPad/iPhone/GPU reales (solo se ha medido en emulación por software: ~2–4 s por fotograma, no representativo).
- Mundo interactivo (casa con puertas y habitaciones, moto y coche montables, WASD/ratón/joystick táctil), escena a pantalla completa con el dashboard dentro del mundo (identidad Obsidiana/Platino).
- Mover precios/rarezas a `star-shop` y los looks a `avatar-look` en janus-core; pruebas e2e; integración.
- Después del compañero: clonación de voz y reconocimiento facial de Jean y Kendra (Kendra es menor: consentimiento y seguridad primero; los módulos `speaker-id`/`face-id` son solo de conveniencia).

## Límites honestos
- Calidad: estilo película de animación procedural, **no** escultura de estudio. Para acercarse más hay dos vías: modelar las criaturas en una herramienta de pago (coste en euros, por confirmar) o delegar esa parte a otra herramienta.
- Los precios en estrellas son una propuesta; la economía real la fija `star-shop`.
