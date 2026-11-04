# Contrato GLB v1.0 — criaturas y robot de Janus

Este es el contrato técnico que debe cumplir un modelo 3D para entrar en el **hueco** de `janus-creature-slot`
(un archivo `.glb` por hueco: `lumi`, `bombo`, `musgo`, `nimbo` y `robot`). La fuente de verdad es el objeto
`CONTRACT` de `janus-creature-slot.js`; este documento lo describe y debe mantenerse igual que él.
(Hasta el 2026-11-04 este archivo estaba referenciado por el código y la interfaz pero no existía: error corregido, ver HANDOFF.)

Cómo se valida: al importar, el módulo lee el GLB y emite un informe **ok / avisos / error**. Solo `error` bloquea
(sin malla, o más de 300.000 triángulos). Los avisos cargan el modelo y listan lo que falta.

## Huecos

| id | Qué es | Dónde se ve |
|---|---|---|
| `lumi`, `bombo`, `musgo`, `nimbo` | las cuatro criaturas del Compañero | escena 3D del Compañero y, como forma, el robot del chat |
| `robot` | el robot de Janus (el que está junto al chat) | teléfono (junto al chat) y Sala |

El robot es **el mismo** que se transforma en cabeza, cara o criatura; un GLB en el hueco `robot` sustituye al procedural
solo en la forma «Robot». Si no hay GLB, todo sigue con el modelo procedural.

## Unidades y orientación

- Metros, eje Y hacia arriba, el modelo mira a +Z, origen en el suelo entre los pies.
- Altura recomendada 0,8 a 1,5 m (aviso si queda fuera). La escena lo escala sola a su altura de escenario.

## Huesos obligatorios (13)

`root, hips, spine, chest, neck, head, jaw, eye_L, eye_R, hand_L, hand_R, foot_L, foot_R`

## Sockets para accesorios (10)

Nodos vacíos con estos nombres, donde se acoplan gafas, gorros, collares, etc.:
`sock_head, sock_face, sock_ears, sock_neck, sock_back, sock_torso, sock_hand_L, sock_hand_R, sock_foot_L, sock_foot_R`

## Expresiones (morph targets)

- Obligatorias (8): `alegre, contento, triste, enojado, sorprendido, blink_L, blink_R, mouth_open`
- Opcionales: `pensativo, carinoso` y 14 visemas `v_aa, v_ee, v_ih, v_oh, v_ou, v_pp, v_ff, v_th, v_dd, v_kk, v_ch, v_ss, v_nn, v_rr`
  (si existen, la boca los usa al hablar; si no, usa `mouth_open`).

## Animaciones (clips)

- Obligatorias (6): `idle, saluda, celebra, piensa, camina, habla`
- Opcionales: `corre, escucha, triste, enojado, sorprendido, baila, dormir, sentado`
- Sin clips el modelo se ve quieto, con una respiración mínima.

## Presupuesto (rendimiento en iPhone/iPad)

| Concepto | Límite |
|---|---|
| Triángulos (LOD0) | 80.000 recomendado; **más de 300.000 se rechaza** |
| Huesos | 80 |
| Texturas | 16, de hasta 2048 px |
| Archivo | 15 MB |

## Formato y compresión

- glTF 2.0 binario (`.glb`).
- Solo **sin comprimir o Meshopt**. **No Draco, no KTX2/Basis**: el cargador incluido (`vendor/gltf-kit.js`) no los trae
  y el modelo no se leería. (Una versión anterior del encargo a ChatGPT pedía Draco/KTX2 y COLOR_0 para el viento: fue un
  error y se corrigió con un anexo; la especificación glTF usa COLOR_0 para teñir el color base.)

## Viento en pelo, plumas y musgo

Atributo de vértice **`COLOR_1`, canal R** = flexibilidad (0 anclado, 1 libre). El módulo aplica el viento en el sombreador.

## Lo que el módulo hace con el modelo

- No recolorea: el aspecto viene del GLB (`setLook` no hace nada en un GLB). Los accesorios se acoplan a los sockets.
- Estado de ánimo → morph targets con suavizado; parpadeo automático (`blink_L/R`); boca al hablar.
- Pose → clip (`idle`, `habla`, `piensa`, `celebra`, `saluda`; si camina, `camina`).
- Se guarda **solo en este dispositivo** (IndexedDB) y se recupera al recargar; no se sube a ningún sitio.

## Qué NO cubre todavía (PENDIENTE)

- Recolorear o cambiar materiales de un GLB desde el Vestidor (accesorios en sockets: fase 2).
- Medidas en iPhone/iPad reales (solo se midió por software con SwiftShader).
- Un GLB de verdad: los dos de `tests/fixtures/` son sintéticos, hechos para probar el contrato; no son criaturas.

## Casting NEXO masculino y femenino (2026-11-04)

El contrato GLB existente también se utiliza para los dos robots aprobados; **no se crea otro importador ni se duplican los visemas**.

- `nexo-masculino`: identidad visual inicial **Jean**.
- `nexo-femenino`: identidad visual inicial **Melanie**.
- Cada uno tiene un slot independiente y privado en IndexedDB local. `robot` sigue siendo el robot clásico y no se sustituye.
- Importar un GLB riggeado válido en cualquiera de estos slots sustituye únicamente la **malla procedural 3D de ese personaje**, manteniendo la misma cámara, controles táctiles, estados de escucha/conversación y expresiones.
- Los alias de casting pueden cambiar localmente: nunca otorgan autorización ni reconocimiento biométrico.
- La aprobación de las **imágenes de referencia** no equivale a validar la geometría real del GLB: el activo final debe cotejarse visualmente con ambas referencias aprobadas y comprobarse en iPhone antes de declararlo hiperrealista y productivo.
