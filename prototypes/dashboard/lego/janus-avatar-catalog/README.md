# JANUS Avatar Catalog · LEGO visual reutilizable

**Estado:** implementado en rama, no desplegado automáticamente.

Una sola lista define los personajes y sus contratos. **Jean** es el *casting visual inicial* del robot NEXO masculino y **Melanie** el del NEXO femenino; no son identidades biométricas ni permisos. `JanusAvatarCatalog.label(id, aliases)` permite cambiar el alias por instalación, sin editar el diseño original.

También registra las criaturas ya existentes: **Lumi, Bombo, Musgo y Nimbo**. Las piezas de motor siguen separadas:

- `janus-avatar-catalog`: catálogo, casting inicial, variantes, poses, expresiones y contrato común.
- `janus-nexo-3d`: las dos mallas procedurales 3D (masculino y femenino), con gestos, ojos, boca, escucha y conversación.
- `janus-creatures-3d`: las cuatro criaturas ya implementadas; no se duplica su diseño.
- `janus-creature-slot`: un GLB de alta fidelidad por ID, persistido solo en el dispositivo, con informe del contrato.
- `janus-3d`: escenario WebGL, cámara, rotación táctil, selector y estado de voz/expresión.

## Contrato

Cada renderer entrega `{ root, update(t, dt, { pose, mood, talk, listening, walk }), setLook(look) }`; la escena no necesita conocer el origen o el proveedor del modelo. La forma elegida se guarda localmente en el dashboard. Los nombres son **presentación, no autenticación**.

Los conceptos 2D de Jean y Melanie sirven como referencias de aprobación; **no se consideran modelos 3D de producción**. Para alcanzar el nivel hiperrealista de las láminas hacen falta los GLB esculpidos, materiales PBR, rig facial y visemas dentro del contrato existente. El fallback procedural 3D permite interacción real mientras se reciben esos activos. No se usan fotografías proyectadas como sustitutos.

No se modifican automáticamente la web, la PWA principal, la landing de Melanie ni otros productos. Los módulos pueden montarse posteriormente como piezas LEGO con autorización del producto.
