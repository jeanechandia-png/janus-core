# janus-3d · Robot y micrófono de oro en 3D real

Pieza LEGO v1.0.0. Dos objetos three.js con material de oro físico (metal, clearcoat) y entorno de estudio propio:

- **`bot`** — el robot de Janus: cabeza esférica con visor mate y **una sola cara**, orejas, antena, cuerpo, brazos con hombro, codo y **manos**, piernas con **pies**. Flota, parpadea, mueve la boca cuando `Janus3D.state.talking`, saluda con la mano y da pasos suaves.
- **`mic`** — micrófono vintage de oro con **ondas permanentes** (más rápidas y brillantes cuando `Janus3D.state.listening`).

Ambos **giran con el dedo** (inercia y vuelta suave a la pose inicial) y reaccionan al toque.

## Montaje (HTML del anfitrión)
```html
<div data-3d="bot" data-id="bot-dash" data-tap="#trabajo/janus"></div>   <!-- toque → navega -->
<div data-3d="mic" data-id="mic-sala" data-tapact="mic"></div>           <!-- toque → ACTS.mic() -->
```
Después de cada render: `Janus3D.hydrate(document)`. El lienzo se conserva por `data-id`, así que re-renderizar no reinicia la animación.

## Formas (v1.1) · el MISMO robot se transforma
El robot del chat no se sustituye por otra sección: cambia de forma, con la misma escena, el mismo arrastre y el mismo toque.
| Forma | Qué es |
|---|---|
| `robot` | El robot original. Si hay un GLB en `JanusCreatureSlot` con id `robot`, se usa ese (el hiperrealista). Con ánimo: ojos, sonrisa y color cambian. |
| `cabeza` | Solo la cabeza del robot (visor oscuro) con ojos y boca expresivos montados en el cristal (`JanusFace3D` en modo `mount`). |
| `cara` | Ojos y sonrisa flotantes, sin cuerpo ni visor. |
| `lumi` `bombo` `musgo` `nimbo` | Las criaturas (procedurales o GLB importados), con el aspecto del Vestidor. |

API: `Janus3D.setForm(f)` · `form()` · `setMood(m, secs)` (`alegre|contento|triste|enojado|sorprendido|pensativo`; con `secs` es temporal, sin `secs` fija) · `mood()` · `setLook(look)` · `setEyes('#hex')` · `refresh()` (tras importar o quitar un GLB) · `react(secs, mood)` · `state.still = true` (pose neutra fija, para capturas).
Automático: pensando → pensativo; hablando → boca animada; tocar → alegre y celebra 2 s.
Los controles (`src/avatar.js`) están en la Sala y en el botón ✦ del robot del dashboard del teléfono. La forma y el color de ojos se guardan en `ST.settings.form` / `ST.settings.eyes`.
En la piel B (Platino), la cara flotante y las criaturas conservan sus colores (el giro de tono solo afecta al robot dorado).

## Estado (lo activa el anfitrión)
`Janus3D.state.talking` (voz de Janus) · `.listening` (dictado) · `.thinking`.

## Degradación
- Sin WebGL, el contenedor muestra `<img class="j3d-fb">` y conserva `data-go` / `data-act`.
- Un lienzo oculto o fuera de la vista activa no se dibuja.

## Reutilizar con otro cliente
Cambiar `gold()` (color y rugosidad) y el color del brillo de los ojos; el resto es geometría. El saludo y el texto viven en el anfitrión (`src/briefing.js`).

## Límites conocidos (verdad)
- Medido solo con renderizado por software (SwiftShader) en Chromium sin cabeza: composición y animación correctas; **rendimiento real en iPhone/iPad sin medir**.
- Es geometría procedural con material físico, no un modelo escultórico glTF.

Dependencia: `vendor/three-r160.min.js` (three.js r160, MIT).
