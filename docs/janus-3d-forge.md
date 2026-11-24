# JANUS 3D FORGE — PILOTO DICIEMBRE 2026 Y AUTONOMÍA 3D

Estado: **CÓDIGO EN REVISIÓN**, misma PR #83 y repositorio oficial `jeanechandia-png/janus-core`. El módulo Forge es reutilizable y no sustituye `JanusHyper`, `JanusCreatureSlot`, el catálogo de avatares ni las dashboards aprobadas.

## Dos vías simultáneas, sin mezclar orígenes ni entrenamiento

**A. Piloto de financiación — hasta diciembre de 2026.** Se podrán usar seis GLB generados externamente (por ejemplo Rodin/Hyper3D) para la demostración de mediados de diciembre, siempre que existan los archivos, pasen compatibilidad y calidad y se revise el derecho aplicable a su exhibición. La compra de créditos o un mes de plataforma NO está autorizada automáticamente. **No están generados ni incorporados a través de esta PR**; el coste exacto tampoco está comprobado. No simular 3D usando un JPEG.

**B. Módulo propio — Janus 3D Forge.** Generar geometría 3D desde nuestros originales mediante un ejecutor local independiente, empezando por TRELLIS.2 cuando exista infraestructura compatible. Conservamos exportación glTF/GLB, rigging, visemas, animaciones, atuendos y pruebas para las seis identidades, sin acoplar el producto a un modelo. Evolucionar progresivamente con modelos y datos sobre los que tengamos derechos; **nunca utilizar outputs, API ni información interna de Hyper3D para entrenar, copiar o mejorar nuestro motor** (sus términos lo restringen).

## Identidades existentes, no crear nuevos slots

| Slot oficial | Referencia visual |
| --- | --- |
| `lumi` | Zorrita-polilla con alas y orejas grandes |
| `bombo` | Ajolote rosado |
| `musgo` | Piedrita cubierta de musgo y flores |
| `nimbo` | Nubecita con auriculares |
| `nexo-masculino` | Robot masculino Janus |
| `nexo-femenino` | Robot femenino Melanie |

La identidad y el casting proceden del catálogo y `packages/modules/companion`; no se reinterpretan desde el orden de una fotografía. No se altera `robot` (personaje clásico/histórico).

## Código escrito

- `packages/modules/janus-3d-forge/src/index.ts`: contrato puro de admisión de GLB (binario glTF 2.0, malla, límites de triángulos, extensiones incompatibles, SHA-256), avisos de huesos, expresiones, sockets y animaciones, origen de archivo, evidencia de derechos y registro inmutable de revisión. **Nunca marca aprobación visual automáticamente** ni acredita derechos contractuales.
- `scripts/janus-3d-forge.ts`: herramienta local `inspect` / `prepare`, no realiza red. Los archivos válidos se copian a `~/.janus/private/3d-forge/<slot>/<sha>.glb`, con recibo `.receipt.json`. Copias y recibos se crean sin sobreescribir y con permisos de archivo privados en Unix. No envía archivos a GitHub ni despliega.
- `sidecars/janus_3d_forge_trellis2.py`: ejecutor propio de generación de imagen original → modelo 3D vía TRELLIS.2 local, usando la API pública de su repositorio. `--check` inspecciona sistema/GPU sin bajar pesos. Por defecto **la inferencia no descarga pesos**: opt-in separado `--allow-model-download`. No instala dependencias. El GLB resultante es **malla estática**: necesitará rigging, morph targets, clips y control de tamaño antes de aceptación en `JanusCreatureSlot`.
- `tests/janus-3d-forge.test.ts` y `tests/janus-3d-forge-cli.test.mjs`: validaciones de GLB, origen, aviso de animación, límites, SHA, permisos, idempotencia y bloqueo de archivos defectuosos.
- Seguridad adicional: el CLI prohíbe preparar archivos privados dentro del árbol del repositorio público, y el generador TRELLIS local rechaza imágenes originales o GLB de salida ubicados en ese árbol.

## Operación local, sin conocimientos de programación

### 1. Comprobar el hardware disponible (sin pago ni descargas)

```bash
npm run forge:check
```

El upstream de TRELLIS.2 pide Linux y NVIDIA >=24 GB VRAM para inferencia. Si no se cumplen, esta ruta se queda bloqueada hasta contar con un equipo compatible; JANUS debe seguir sirviendo las dashboards y los GLB importados offline.

### 2. Crear primer GLB propio (solo cuando la infraestructura sea compatible)

Instalar TRELLIS.2 de forma separada **después** de revisar sus dependencias/licencias. Con pesos previamente disponibles:

```bash
python3 sidecars/janus_3d_forge_trellis2.py \
  --input /ruta/privada/original-musgo.png \
  --output /ruta/privada/musgo.glb
```

El argumento `--allow-model-download` permite pedir una descarga explícita del modelo si se autorizó y es necesario. No subir referencias privadas a repositorios públicos.

### 3. Importar un GLB temporal o propio para revisión

```bash
npm run forge:inspect -- --input /ruta/privada/musgo.glb

npm run forge:prepare -- \
  --input /ruta/privada/musgo.glb \
  --slot musgo \
  --origin hyper3d-rodin \
  --pilot-use-until 2026-12-31
```

Para salida propia, usar `--origin janus-trellis2-local`. El origen debe ser **verídico**. `--rights-evidence` solo sirve para registrar una revisión de derechos ya realizada, no la hace JANUS automáticamente.

### 4. La compuerta final ya existe en la PWA

Usar el control actual del Founder para importar un GLB desde un archivo privado. `apps/pwa/approved-presence.js` llama a `JanusCreatureSlot.inspect` y `load`, guarda el resultado localmente en IndexedDB y muestra la etiqueta **«revisión visual pendiente»**. Validar cara, volumen, accesorios, expresión y movimiento en iPhone/iPad; no sustituir modelos aprobados ni publicar nada sin aprobación.

**Importante:** la admisión inicial de Forge solo comprueba la estructura. Un GLB sin esqueleto, expresiones o clips puede pasar el preflight estático, pero **será rechazado por la compuerta PWA**, que aplica requisitos más exigentes. Rodin y TRELLIS no garantizan esas prestaciones por sí solos.

## Biblioteca central de personajes (24-nov-2026)

`packages/modules/character-library` guarda cada GLB una sola vez (huella SHA-256 + recibo de este módulo) y lo reparte a la app del Founder, a las dashboards y a la tablet de Kendra; ver `docs/HYPER3D_RODIN_PLAYBOOK.md`. La biblioteca admite además **figuras fijas** (malla válida sin rig, como las de Rodin) como nivel «parcial», con aviso hasta la aprobación visual del Founder, y a Kendra solo le llega lo aprobado. La importación manual de arriba conserva la compuerta estricta.

## Evidencias y criterios de cierre

- **Hasta mediados de diciembre:** seis GLB finales identificados por SHA, derechos de demostración confirmados, revisión individual de compatibilidad/estética, prueba física, presentación de inversores sin assets falsos.
- **Propio (fases posteriores):** preflight de GPU real; primera inferencia TRELLIS.2 real, exportación local verificada, optimización a <15 MB/<300k tris, rig/morphs/clips, pruebas comparativas contra los seis originales, integración voz→solicitud→preview→aprobación.
- **Comercialización de módulos:** posible en el futuro y NO restringida por este plan; verificar licencias de cada dependencia, datasets y activos antes de distribuir. La tecnología JANUS CORE sigue siendo independiente.

## Referencias oficiales

- TRELLIS.2: https://github.com/microsoft/TRELLIS.2 (código/pesos MIT; dependencias con licencias independientes; Linux NVIDIA >=24GB VRAM).
- Condiciones Hyper3D: https://hyper3d.ai/legal/terms (prohibición de usar el servicio para construir/entrenar soluciones similares o competidoras).
- Contrato de recepción canónico: `prototypes/dashboard/lego/janus-creature-slot/CONTRATO.md`.
- Referencias de personajes oficiales: `docs/APPROVED_CHARACTERS_PWA_2026-11-06.md` y `apps/pwa/approved-presence.js`.

No se han comprado créditos, obtenido modelos privados, instalado GPU, ejecutado inferencia, verificado licencias de un plan concreto ni publicado dashboards en esta entrega.
