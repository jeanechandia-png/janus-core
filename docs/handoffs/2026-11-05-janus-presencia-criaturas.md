# JANUS — continuidad de criaturas protagonistas (2026-11-05)

## Fuente de verdad y orden cronológico

1. Antiguo dashboard Obsidiana/Platino, estado y escenas existentes; no restaurar versiones históricas.
2. Claude implementó el `Compañero 3D`, `JanusStage3D`, `JanusCreatures3D` y `JanusCreatureSlot` (rama `claude/companion-escena-3d`, PR #53).
3. Las referencias de cuatro personajes aprobados son **Lumi, Bombo, Musgo, Nimbo** (archivos JPEG originales en `prototypes/dashboard/assets/creatures`). Materiales y carácter: Lumi zorro dorado alado; Bombo ajolote coral; Musgo piedra/musgo; Nimbo corderito-nube.
4. La línea de trabajo `feat/infinity-connect-contextual-interpreter` contiene el intérprete contextual reutilizable como módulo de otros productos y no se altera aquí.
5. 2026-11-05: nueva rama `chatgpt/janus-presencia-criaturas-cinematica-20261105` parte del HEAD más reciente de `claude/companion-escena-3d`, añade `JanusPresence`, lo conecta a A/B, Sala, teléfono y Kendra. Ningún despliegue ni merge automático.

## Estado

- **HECHO EN CÓDIGO:** módulo visual LEGO aislado; referencias embebidas offline; A/B y smartphone; portada Sala; Kendra modo arte/3D; respetar GLB existentes; preservación de estados y contexto; smoke test fuente.
- **PENDIENTE DE VALIDAR:** ejecución de smoke test, render HTML, pruebas E2E y capturas desde equipo autorizado.
- **BLOQUEADO POR AUSENCIA DE ACTIVOS:** modelos finales hiperrealistas con rig/expresiones/pelaje movido por viento. 2.5D/CSS no debe presentarse como 4K 3D.
- **PRÓXIMO:** ejecutar pruebas del `prototypes/dashboard`, verificar en iPhone y escritorio; recibir/generar GLB conformes al contrato a partir del diseño aprobado, reimportarlos por slots locales, probar FPS/LODs y finalizar control de calidad. Evaluar fusión con PR #56 Nexo y ramas #59/#61 evitando sobrescritura (trabajo de otros agentes concurrentes).

## Registro preventivo

Riesgo: reclamar “3D 4K terminado” cuando solo hay fotos 2D y mallas procedurales no aprobadas. Prevención: etiquetar en UI los recursos según tipo real, conservar `GLB` como fuente de verdad del rig y exigir modelos finales, capturas y pruebas E2E antes de cambiar el estado. Diseño responsive con `prefers-reduced-motion`; no introducir datos infantiles reales en repositorio público.

## Implementación adicional y pruebas (mismo día)

- Módulo `janus-fur-wind`: pelos, briznas de musgo y fibras de nube en **geometría Three.js real** mediante `InstancedMesh` con deformación progresiva de puntas por vertex shader. Bombo continúa sin pelaje. Fibras físicamente iluminadas y teñibles con el Vestidor.
- Integración `janus-creatures-3d`: Lumi (cabeza, tronco, cola), Musgo (7 grupos de musgo), Nimbo (cuerpo, cabeza y cúmulos), viento controlado mediante `cpWind` y preferencias de movimiento reducido; el contrato GLB sigue intacto.
- Regulador FPS de densidad de fibras en `janus-stage-3d`: baja gradualmente por debajo de 24 FPS sostenidos, recupera por encima de 48 FPS sostenidos, sin cambiar silueta, actividades, memoria ni modelo de criatura. El modo móvil usa menor presupuesto inicial.
- Nueva CI `.github/workflows/janus-creatures-ci.yml` valida sintaxis JS, `tests/presence.test.cjs`, `tests/fur-wind.test.cjs`, builds HTML autosuficientes A/B y sus scripts. Además publica un ZIP temporal de HTML de revisión.
- **Evidencia CI satisfactoria** sobre commit `35b30d0e6caec09b4818c29af5705dd31f52158e`:
  - JANUS creatures 3D — verification: [run 42091227182](https://github.com/jeanechandia-png/janus-core/actions/runs/42091227182) = success.
  - Janus Core CI: [run 42091227215](https://github.com/jeanechandia-png/janus-core/actions/runs/42091227215) = success.
- **Revisión visual local**: HTML exportado desde Actions abierto en Chromium vía `page.set_content`, vistas A/B escritorio 1194x834 y móvil 390x844, y ruta Compañero/Kendra. Sin errores JS de página. Las capturas no validan el movimiento 3D porque el navegador de este entorno bloqueó WebGL, por lo que no se atribuye aprobación visual 3D.
- **Pendiente real**: 4 modelos GLB finales esculpidos/riggeados con acabado cinematográfico, pruebas GPU reales iPhone/iPad, mediciones de FPS/color/LOD y aprobación visual del Founder. El movimiento GPU implementado es geometría **procedural**, no sustituto del acabado de VFX deseado.

Estado: implementación en PR #63 (borrador). No fusionada, no desplegada. Conserva la rama de interpretación contextual `feat/infinity-connect-contextual-interpreter` intacta.

## Continuidad — identidad de Kendra y personalización individual

- **Separación de roles vigente:** las cuatro criaturas viven en el universo de Kendra. Son sus compañeros ficticios, **no** representan ni hablan como Jean ni sustituyen la figura paterna; el robot masculino aprobado `Nexo` es el personaje previsto para el dashboard del Founder. No confundir identidades en reutilizaciones posteriores.
- **Nombre de la usuaria:** toda interacción del compañero se dirige a **Kendra** (no `__HIJA__`, `hija` ni `papá` como vocativo); `newKitProfile` usa la clave de perfil `kendra`. La pestaña «Papá» de avisos familiares permanece independiente del personaje.
- **Nombre de criatura:** la función heredada `Companion.renameCreature` se reutiliza; el Vestidor añade un control de nombre visible, validación y confirmación; renombrar sigue disponible desde la banda de la escena. Estado `ST.comp.names[creatureId]`, separado por criatura, persistido mediante `saveState`, sin costes, pérdida de objetos ni alterar personalidad.
- **Aspecto propio:** paleta de pelaje/piedra/ojos y ropa permanecen en `ST.comp.looks[creatureId]`. Los nuevos peinados/forma de fibras se guardan en `ST.comp.furStyles[creatureId]`; nombres y estilos de una especie no sobrescriben los de otra.
- **Morfología:** Lumi cambia longitud y curvatura de hebras, Musgo cambia su fibra vegetal, Nimbo su pelusa/nube. Bombo no tiene pelo: el mismo selector cambia el tamaño de sus **branquias**; se conserva su piel húmeda.
- **Alcance 3D actual:** el shader de `JanusFurWind` aplica deformación GPU real en los modelos procedurales. Los GLB externos no reciben automáticamente este cambio de forma, salvo que implementen una interfaz compatible; la calidad cinematográfica/4K real de los GLB aprobados sigue por validar.
- **Pruebas:** `tests/kendra-identity.test.cjs` cubre vocativos, perfil correcto, renombres aislados, escapar el nombre en la tarjeta aprobada, apariencia propia por especie e independencia de estrellas. `tests/fur-wind.test.cjs` verifica uniformes de longitud y rizo. Ambas se ejecutan dentro de `.github/workflows/janus-creatures-ci.yml`.
- **Próximo:** conservar esta regla de identidad en cualquier futuro adaptador de conversación, TTS, IA o animación facial. No fusionar personajes Founder/Kendra; revisar visualmente en dispositivos con WebGL real, sin presentar arte estático como 3D riggeado final.

## Avance de la misma PR — experiencia viva en bordes, Nexo exclusivo, colección de moda

### HECHO
- Nuevo LEGO `lego/janus-edge-companion`: un renderer Three.js transparente, montado en `document.body`, paseo vertical limitado al margen de pantalla y arrastre de un lateral al otro, nombre visible, foco de teclado, mirada/pupilas reactivas, respuesta a toque, saludar/reír/celebrar, pausa de paseo, preferencias de movimiento reducido y límite de FPS/densidad. Al entrar en una lección o «Mi mundo» se oculta sin perder progreso; el motor existente `JanusStage3D` continúa con objetos, vehículos y minijuegos.
- Kendra usa presencia 3D en borde **por defecto cuando WebGL es viable**; puede escoger «Escena» (antiguo 3D), «Arte» (imagen aprobada) o «3D vivo». Fallback a imagen si WebGL falla, sin romper los textos, actividades ni el Vestidor.
- `JanusCreatures3D`: control de mirada sobre iris/pupilas/brillos, inclinación sutil de cabeza, el conjunto de expresiones faciales que ya existía y viento/movimiento de fibras.
- **Separación de identidades:** Founder muestra exclusivamente el robot Nexo mediante `Janus3D` (procedural o GLB `robot`), en A/B, Sala y móvil. Kendra conserva sus cuatro criaturas. La vieja acción `presenceNext` queda como no-op para no volver a mezclar identidades.
- Nuevos artículos comprables mediante **estrellas ganadas**: 8 prendas con formas 3D diferenciadas (2 vestidos, 2 chaquetas, 2 sudaderas, 2 capas) y 4 variantes de calzado; en Nimbo se representan como aros flotantes anatómicamente adaptados. Se mantienen casas, moto, coche, cohete, premios y economía idempotente sin dinero real. El Vestidor permite combinar ropa y zapatos; nombres, pelaje y artículos no se pierden al cambiar de criatura.
- Limpieza incremental de geometrías y materiales al cambiar prendas y destruir rigs, para evitar acumulación en WebGL.
- CI extendida: `tests/edge-companion.test.cjs` prueba con dobles de WebGL/DOM el lifecycle, arrastre y callbacks; `tests/kendra-fashion.test.cjs` prueba catálogo, precios, compra, propiedad, idempotencia y compatibilidad. Se mantienen tests de identidad, pelaje, presencia y builds offline.

### EVIDENCIA
- Commit de código `c1beaf896d2b813fc8505803d229c19b592d5b33`: [JANUS creatures 3D verification](https://github.com/jeanechandia-png/janus-core/actions/runs/42097430741) = success y [Janus Core CI](https://github.com/jeanechandia-png/janus-core/actions/runs/42097430647) = success.
- HTML A/B descargados y abiertos mediante Chromium usando `page.set_content`. Verificado: vista «Compañero», Vista «Vestidor» con vestido de gala y zapatos, Founder con tarjeta Nexo, **sin errores JavaScript**. La política del navegador de pruebas bloquea WebGL: entrada 3D cae correctamente al arte estático. **No se afirma validación de render GPU real ni fidelidad visual 4K.**

### PENDIENTE / BLOQUEADO
- Nexo aprobado: sigue faltando el archivo GLB modelado/riggeado del robot para reproducir exactamente la imagen de referencia; el widget usa `Janus3D` procedural.
- Criaturas Kendra: los modelos GLB finales con 4K, shaders de pelo, expresiones, calzado/conjuntos VFX, sockets y LOD, pendientes.
- Revalidar en GPU real (iPhone/iPad/escritorio): oclusión de controles durante arrastre, sombras, FPS, memoria, audio y accesibilidad.
- Reconciliar `vendor/companion.js` del prototipo con las fuentes TypeScript de avatar-look/star-shop; no están en la rama base de Claude. No promover a producción hasta reconciliación y pruebas del catálogo upstream.
- Revisar dependencias de ramas y fusionar PR #63; no se ha desplegado.

### PRÓXIMO
1. Importar/ensayar GLB con contrato `JanusCreatureSlot`; medir rendimiento y corregir encaje de accesorios.
2. Pruebas visuales en dispositivo físico antes de activar la experiencia GPU por defecto fuera de prototipos.
3. Integración definitiva con backend local-first y perfiles Kendra/Founder diferenciados, preservando aprendizaje y compras.
