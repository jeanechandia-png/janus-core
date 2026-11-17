# janus-stage-3d · Escenario 3D manipulable

Pieza LEGO v1.0.0. Una isla 3D donde **la criatura vive dentro de la escena**: camina hasta los objetos, los señala y reacciona; y **la niña manipula la misma escena** con el dedo. El render es una **función del estado** del módulo `scene-stage` (`stage.apply(state, events)`), así que la criatura y la niña mueven exactamente los mismos datos.

## Montaje
```html
<div data-stage3d data-id="kendra" aria-label="Escenario 3D"></div>
```
```js
JanusStage3D.hydrate(document);               // tras cada render del anfitrión
const st = JanusStage3D.get('kendra');
st.setCreature('lumi', lookHex);              // criatura (lego/janus-creatures-3d) con su aspecto
st.setWorld({ home: 'home:cabana', vehicle: null, decor: ['dec:planta'] });
st.setMode('escena');                         // 'mundo' = vista de la casa, el vehículo y la decoración
st.apply(sceneState, events);                 // escena de scene-stage; events anima canjes y aparición
st.on({ move(id, [x, z]) {}, tapProp(id) {}, tapCreature() {}, tapHome() {}, tapVehicle() {}, tapDecor(key) {}, tapEmpty() {} });
```
El lienzo se conserva por `data-id`: re-renderizar el HTML del anfitrión no reinicia la animación.

## Gestos
| Gesto | Efecto |
| --- | --- |
| Arrastrar un objeto | Lo mueve (callback `move`) |
| Tocar un objeto | Lo selecciona (`tapProp`) y muestra un aro |
| Tocar la criatura / casa / vehículo / decoración | Callbacks `tapCreature` · `tapHome` · `tapVehicle` · `tapDecor` |
| Arrastrar el vacío | Gira la cámara |
| Pellizcar / rueda | Zoom |

## Vistas
`amplia` (isla y aldea) · `mesa` (encuadra los objetos y la criatura) · `primer-plano` (el objeto elegido) · `mundo` (la casa y el vehículo). `st.setView(v)` fuerza una vista; `st.setView(null)` deja que la lección lleve la cámara. En vertical (móvil) los encuadres se ajustan para que quepa la criatura.

## Objetos de lección
`columna` (valor posicional, con canje 10↔1 animado) · `plato` y `caja` (galletas) · `tarta` (porciones) · `cartel` · `semaforo`. Los límites y la validación viven en `scene-stage`; los comandos externos (modelo de lenguaje, documentos, web) son **datos no confiables** y pasan por su lista blanca antes de llegar aquí.

## Ayudas de prueba
`st.screenOf(id)` (coordenadas en pantalla) · `st.propIds()` · `st.worldInfo()` · `st.stats()` (fps, objetos, vista, cámara).

## Límites conocidos (verdad)
- Verificado con renderizado por software (SwiftShader) en Chromium sin cabeza en tablet (1194×834) y teléfono (430×932): gestos, canje, vistas, tienda y persistencia. **Rendimiento real en iPad/iPhone sin medir.**
- Geometría procedural estilizada, no modelos glTF.
- En vertical, la criatura y los objetos se ven pequeños.

Dependencias: `vendor/three-r160.min.js` y, para la criatura, `lego/janus-creatures-3d`.
