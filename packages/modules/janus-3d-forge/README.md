# janus-3d-forge · módulo LEGO reutilizable

JANUS 3D Forge **no es otra dashboard ni otro producto Janus**. Es el módulo propio de validación de modelos GLB, con posible comercialización independiente en el futuro. El CORE decide permisos, modelos, aprobación y publicación.

- `src/index.ts`: inspección estructural glTF 2.0 con bytes BIN reales, presupuestos iPhone, requisitos de `JanusCreatureSlot`, hashes, origen y recibo de calidad sin aprobación ficticia.
- `scripts/janus-3d-forge.ts` (host): CLI offline de admisión a almacenamiento privado local; no forma parte del módulo LEGO y no entrena modelos.
- `sidecars/janus_3d_forge_trellis2.py` (host): generador local opcional (imagen → GLB) con TRELLIS.2. No está disponible sin GPU compatible y sus dependencias.
- `docs/janus-3d-forge.md`: proceso del piloto de diciembre, seis identidades canónicas y compuertas.

**Importante:** un GLB que supere el preflight estructural sigue siendo solo candidato a preview; el cargador real de la PWA debe verificar rig, expresiones, animaciones y compatibilidad. La persona autorizada debe aprobar la apariencia visual. No se entrenará un modelo con los outputs de Hyper3D.

Los activos no se guardan en el repositorio público. No existe conexión automática voz→TRELLIS→rig→publicación validada en esta fase.
