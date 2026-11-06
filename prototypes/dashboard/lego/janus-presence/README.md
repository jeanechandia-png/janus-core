# JanusPresence · módulo LEGO visual (2026-11-05)

Estado: **implementación fuente en rama de revisión**, no desplegada, no fusionada y sin garantía de calidad 4K/GLB. **No confundir** animación CSS/parallax de una imagen con un personaje 3D riggeado.

## Continuidad y precedencia

Se conserva el trabajo de Claude en `claude/companion-escena-3d` (escenario Three.js, mecánicas, vestidor, lecciones y cargador GLB), en lugar de restaurar los dashboards antiguos. Las imágenes autorizadas de Lumi, Bombo, Musgo y Nimbo ya estaban en `assets/creatures/*.jpg`; se reutilizan, no se regeneran ni se añaden servicios de pago.

Esta rama es **solo presentación visual** y no modifica la rama `feat/infinity-connect-contextual-interpreter`. La integración del intérprete contextual para Janus/Connect/otros productos continúa como pieza LEGO separada.

## Funcionamiento

- A Obsidiana y B Platino: personaje elegido por el Founder en la tarjeta de proyectos (✦ para cambiar). En la Sala de trabajo se ve grande como portada cuando aún no hay mensajes; se conserva el robot 3D en el panel derecho.
- Móvil: portada visible en todas las variantes A/B/C/A2.
- Kendra/Compañero: la imagen de la criatura **ya seleccionada** es protagonista de la escena en modo arte; botón **Explorar en 3D** entra en el escenario interactivo existente. Al iniciar una lección o el mundo, pasa automáticamente a Three.js; un GLB cargado en `JanusCreatureSlot` tiene prioridad.
- Preferencia de movimiento reducido desactiva parallax, respiración y reflejo animado. Ningún recurso visual necesita conexión.
- Las selecciones de Kendra y Founder **no se mezclan**. Founder: `ST.settings.presenceCreature`. Kendra: `ST.comp.creatureId` / `C.visualMode`. Se usa el mecanismo existente de estado local.

## Límites de lo realmente implementado

**Implementado en esta rama:** presentación de las 4 referencias aprobadas, integración en dashboards A/B y móvil, portada de Sala, selección aislada por perfil y cambio modo arte/3D en Kendra. El escenario 3D, poses, expresiones y cargador GLB **ya existían en la base**, no son avances nuevos de esta rama.

**Pendiente de producción cinematográfica:** cuatro mallas glTF/GLB finales hechas desde las referencias visuales aprobadas, pelaje/geometría real, esqueleto de 13 huesos, sockets, morphs faciales y visemas, gestos/animaciones, mapas PBR, viento de pelo/plumas/musgo, LOD, pruebas visuales de calidad 4K y FPS reales en iPhone/iPad. El contrato oficial se define en `../janus-creature-slot/CONTRATO.md`. Los GLB sintéticos en `tests/fixtures` solo comprueban estructura, no calidad visual. El módulo experimental `janus-hyper` sigue pendiente de aprobación y no se presenta como modelo final.

## Verificación

```bash
node tests/presence.test.cjs
node build.cjs
node build.cjs --skin b
# después: suites layout, skin, e2e companion, e2e slot con Chromium instalado
```

No se ha ejecutado esta suite en el dispositivo del Founder porque Remote Desktop Commander no tiene equipo conectado. Requiere comprobación visual en iPhone y escritorio y capturas antes de dar por terminada la experiencia.
