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
