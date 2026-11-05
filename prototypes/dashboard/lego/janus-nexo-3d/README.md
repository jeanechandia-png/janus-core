# JANUS NEXO 02 · variantes masculina y femenina

**Origen de diseño:** las imágenes aprobadas por el Founder en esta conversación muestran al robot `JANUS · 02 NEXO` con armadura plateada metálica, cara expresiva, grandes ojos azules, sonrisa y manos articuladas. No confundir esta identidad con Lumi/Bombo/Musgo/Nimbo: esas criaturas son exclusivas del dashboard de Kendra.

## Qué estaba incorrecto

El repositorio seguía montando `Janus3D.buildBot()`, un robot **dorado y negro** creado antes de aprobar Nexo 02. `JanusPresence.renderNexo` solo lo envolvía con el rótulo «Nexo»; cambiar la etiqueta no sustituía el modelo. Además, `Janus3D` arrancaba con `formGen=0` y `FORM.gen=0`, por lo que nunca aplicaba la nueva forma «robot» en el primer fotograma salvo después de un cambio manual. No existía selección masculino/femenino ni espacio GLB separado por variante.

## Contrato implementado

- `JanusNexo3D.build('masculino'|'femenino')` devuelve un **rig procedural 3D plateado** real, sin red ni servicios de IA externos. Ambos comparten identidad Janus, materiales titanio/acero, ojos azules con iris y pupilas, párpados, cejas articuladas, sonrisa/boca, mandíbula, torso segmentado, cinco dedos por mano, hombros, codos, rodillas, pies y animación.
- La variante masculina se inspira en **la referencia aprobada de Nexo 02**. La femenina mantiene el lenguaje visual y cambia proporciones de cabeza, hombros, tórax, cintura y caderas. **No afirmar que la femenina es una imagen aprobada**: su rig es una primera implementación pendiente de validación artística.
- `Janus3D.setVariant(v)`, `Janus3D.variant()`: elección global de aspecto para el usuario Founder. `ST.settings.nexoVariant='masculino'|'femenino'` es persistente mediante `saveState`. Al cambiar variante se actualizan A/B, móvil y Sala; no se borran mensajes, autorizaciones, tareas, voz ni memoria.
- `Janus3D` usa `JanusCreatureSlot.rigFor('robot')` para masculino si se importa GLB de producción; `rigFor('robot-femenino')` para femenino; si no existe GLB usa `JanusNexo3D`. El masculino conserva el ID histórico `robot` y la base IndexedDB de siempre. Nunca usar el GLB masculino para una variante femenina por sustitución silenciosa.
- `JanusPresence.render('founder')`: presencia Nexo en **todos** los puntos de montaje (Obsidiana, Platino, teléfono y Sala) con botones accesibles de Masculino/Femenino.
- `src/avatar.js`: selector detallado de variantes, estados emocionales, vistas, color de ojos e importación de GLB en la Sala. Las criaturas infantiles quedan fuera de su selector. `app.js` no vuelve a forzar la forma antigua durante cada render.
- Compatibilidad offline: si falla WebGL, el fallback textual identifica Nexo y variante sin vender una ilustración estática como 3D. El importador utiliza IndexedDB local y los componentes existentes del gateway.

## QA y pruebas

- `tests/nexo-gender.test.cjs` **construye los dos rigs** con dobles de Three.js, comprueba materiales, iris, pestañeo, expresión, manos de 5 dedos, proporciones diferentes, animaciones, liberación de geometrías, selección persistente, render con controles y aislamiento de Kendra.
- Test específico previene regresión de **primer fotograma** (`formGen: -1`) que antes dejaba el bot dorado instalado.
- Compilación offline A/B y pruebas de iOS Quick Look existentes, CI general y 3D en GitHub Actions. No se ha integrado ni validado todavía el modelo GLB final de producción.

## Límites importantes

El arte conceptual aprobado es **una imagen 2D**, no un archivo GLB riggeado. Aunque el rig implementado ahora coincide en color de armadura, ojos y estilo y tiene movimiento 3D auténtico, **no puede ser una reproducción geométrica 4K exacta** de la lámina sin esculpir/importar un GLB con texturas y expresiones de producción. La versión femenina también necesita aprobación estética definitiva. No anunciar equivalencia hiperrealista 4K ni pruebas de GPU real a partir de un test sin WebGL.

## Próximas decisiones de producción

1. Preparar cada GLB final de Nexo con esqueleto, morph targets, ojos y boca expresivos, LOD, texturas PBR y sockets; el rig procedural queda como fallback offline.
2. Importar masculino/femenino a sus slots independientes y revisar visualmente ambos en Safari iOS y escritorio.
3. Confirmar políticas de voces: cambiar apariencia del robot **no debe cambiar automáticamente** las voces clonadas de Jean/Kendra ni los permisos de JANUS CORE.
4. Fusionar cambios apilados solo después de tests y revisión de las demás ramas; la PR #63 permanece en borrador.
