# janus-creatures-3d · Criaturas 3D personalizables

Pieza LEGO v1.0.0. Cuatro criaturas originales de InfinitySeed (**Lumi**, **Bombo**, **Musgo**, **Nimbo**) construidas con geometría de three.js r160. Se dibujan **dentro de la escena 3D** (no son una imagen encima) y se pueden vestir como en un juego: color de pelo y de detalles, ojos, ropa y accesorios.

> **Personalizar es solo estético.** Cada criatura mantiene su silueta, su movimiento (Lumi revolotea, Bombo rebota, Musgo guiña, Nimbo flota) y, en el módulo `companion`, su carácter y su voz.

## Uso
```js
const rig = JanusCreatures3D.build('lumi', '#FFD36A');   // id + color del brillo
scene.add(rig.root);
rig.setLook({ fur: '#FBE7C6', accent: '#C9B6E8', eyes: '#F2A33A',
              outfit: 'camiseta', outfitColor: '#8EC8FF', accessoryColor: '#F6C453',
              accessories: { cabeza: 'gorro', cara: 'gafas-redondas', cuello: 'bufanda', espalda: 'mochila' } });
// en cada fotograma:
rig.update(t, dt, { pose: 'habla', walk: 0, excite: 0.2 });
```
Normalmente no se usa directamente: lo monta `janus-stage-3d`.

## Catálogo de aspecto (cerrado)
| Hueco | Ids |
| --- | --- |
| cabeza | gorro · corona · lazo · copa · flor · diadema |
| cara | gafas-redondas · gafas-estrella · gafas-sol · antifaz |
| cuello | bufanda · pajarita · perlas · medalla |
| espalda | mochila · alas-hada · estrellas |
| prenda | camiseta · jersey · vestido · peto · capa (o ninguna) |

Los **colores** llegan ya como hex: la traducción de ids (`melocoton`, `lila`…) a hex la hace el anfitrión con `SWATCHES` / `EYES` del módulo `avatar-look`. Un id desconocido se ignora, nunca rompe el dibujo.

## Poses
`idle` · `habla` · `piensa` · `celebra` · `senala` · `saluda`. `ctl.walk` (0..1) anima los pasos; `ctl.excite` sube la energía del movimiento propio; `ctl.pointYaw` gira el cuerpo hacia lo que señala.

## Añadir una criatura
Una entrada en `SPECIES` (proporciones: cabeza, cuerpo, si flota) y sus rasgos propios dentro de `build` (orejas, cola, cara…), con su persona en el módulo `companion`. Las prendas y los accesorios se colocan sobre el cuerpo y la cabeza de cada especie, así que el catálogo no cambia. **Pendiente:** hoy los rasgos de cada especie están escritos a mano en `build`; una especie nueva exige tocar ese código (no es solo datos).

## Límites conocidos (verdad)
- Verificado con renderizado por software (SwiftShader) en Chromium sin cabeza: composición, poses y accesorios correctos. **Rendimiento real en iPhone/iPad sin medir.**
- Es geometría procedural estilizada, no un modelo glTF esculpido.

Dependencia: `vendor/three-r160.min.js` (three.js r160, MIT).
