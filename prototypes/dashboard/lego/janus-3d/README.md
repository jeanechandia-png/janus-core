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
