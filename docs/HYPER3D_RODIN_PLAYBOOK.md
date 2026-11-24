# Hyper3D Rodin → Janus · guía de generación de las seis figuras (24-nov-2026)

Para: Jean (Founder). Objetivo: generar en Rodin las 4 criaturas de Kendra y los 2 robots Nexo, y que lleguen a Janus, a la dashboard de Kendra y a la tuya **subiendo cada archivo una sola vez**.

Etiquetas: **HECHO** (visto o probado), **INFERENCIA**, **RECOMENDACIÓN**, **POR CONFIRMAR**.

## 1. Las seis figuras (identidades ya existentes, no se inventan otras)

| Ranura | Figura | Referencia |
| --- | --- | --- |
| `lumi` | Zorrita-polilla con alas y orejas grandes | recorte aprobado de la lámina de Kendra |
| `bombo` | Ajolote rosado | ídem |
| `musgo` | Piedrita cubierta de musgo y flores | ídem |
| `nimbo` | Nubecita con auriculares | ídem |
| `nexo-masculino` | Robot Janus | imagen aprobada «Janus 02 Nexo» |
| `nexo-femenino` | Robot Melanie | imagen aprobada de Melanie |

**RECOMENDACIÓN:** usa como referencia el original aprobado, sin redibujarlo ni «mejorarlo». Un sujeto por imagen, fondo liso. Para los robots, pose de pie con brazos algo separados (pose A), porque facilita ponerles esqueleto después. Hyper3D aconseja referencias en pose A/T y varias vistas (documentación consultada el 24-nov; reconfirmar en pantalla).

## 2. Qué elegir en Rodin (pantalla «Gen-2.5 · thinking effort»)

HECHO (captura del 24-nov, 16:43):

| Nivel | Tiempo | Lo que muestra la pantalla |
| --- | --- | --- |
| Extreme-High | ~80 s | Pide **suscripción** |
| High | ~40 s | «Recomendado para activos de alta calidad»; sin «Free Preview» |
| **Medium** | ~20 s | **«Character creation»** y **«Free Preview»** |
| Low | ~9 s | «Free Preview» |
| Extreme-Low | ~4 s | «Free Preview» |

- **RECOMENDACIÓN: Medium para la primera prueba** (Nexo-Janus). Si falta detalle, High para las versiones finales.
- **POR CONFIRMAR:** qué cubre exactamente «Free Preview» (ver sin gastar créditos, pero quizá descargar sí cuesta). Antes de cualquier cobro de créditos, comprobar el coste que muestra Rodin.
- Si Rodin pregunta por el número de caras: opción baja o media. Janus acepta hasta 300.000 triángulos y 15 MB; lo ideal en iPhone es 80.000 o menos (HECHO, `janus-3d-forge`).
- Descargar en **GLB**.

## 3. Orden de trabajo

1. Generar **solo Nexo-Janus** con Medium y mirar la calidad.
2. Si sirve, seguir con Melanie y con las cuatro criaturas, una a una.
3. Descargar cada GLB y subirlo desde el panel de Janus (sección 4).
4. Revisarlo en la vista 3D y pulsar **Aprobar** o **Rechazar**.

## 4. Subida y reparto (código de esta rama)

Panel **«Biblioteca de personajes 3D»**: en la app del Founder, botón «Instalar JANUS 3D original»; en las dashboards A/B, menú «JANUS 02 NEXO · 3D» (requiere sesión de Founder).

- Elige el origen (Hyper3D Rodin / Janus local / otro), sube el `.glb` en la fila de la figura y pulsa **Ver** → **Aprobar**.
- Cada subida se valida con 3D Forge (falla cerrado), se guarda con su huella SHA-256 y su recibo, y nace **«pendiente de revisión visual»**.
- **Founder:** ve la última versión subida con el aviso «3D · revisión visual pendiente».
- **Kendra:** su tablet descarga **solo lo aprobado**, lo verifica por huella y lo guarda para usarlo sin conexión. Si luego rechazas, se retira de su tablet en la siguiente sincronización.
- Una versión nueva pendiente **no** quita la aprobada que ya ve Kendra.
- Alternativa por terminal: `npm run forge:prepare -- --input X.glb --slot musgo --origin hyper3d-rodin --pilot-use-until 2026-12-31`. Con `JANUS_CHARACTERS_DIR=~/.janus/private/3d-forge` el servidor incorpora esos archivos (`adoptStaged`).

Rutas (Founder, con sesión): `GET /api/characters`, `PUT /api/characters/:slot` (cuerpo = GLB; cabeceras `x-character-origin`, `x-character-pilot-until`), `GET /api/characters/:slot/:sha256.glb`, `POST /api/characters/:slot/review` y `/activate`. Kendra: `GET /api/kid/characters` y `GET /api/kid/characters/:slot/:sha256.glb` (solo aprobados).

## 5. Qué esperar de Rodin (importante)

- **HECHO (investigación previa):** Rodin entrega una malla estática con texturas PBR: **sin esqueleto, expresiones ni animaciones**. El contrato completo de `JanusCreatureSlot` exige 13 huesos, 8 expresiones y 6 animaciones.
- Por eso el GLB de Rodin entra como **nivel «parcial»**: se ve en 3D, quieto (respiración mínima), con aviso hasta que lo apruebes. **Es una decisión nueva de esta rama**: la importación manual antigua sigue exigiendo el contrato completo; solo la biblioteca admite figuras fijas aprobadas por ti. Reversible.
- **Para que se muevan** hace falta un paso aparte de esqueleto (rigging). Existe un servicio de Hyper3D vía fal.ai (`hyper3d/rigging`, de pago; precio **POR CONFIRMAR**) y la vía propia (TRELLIS.2 + rig, que necesita GPU compatible). Se decide después y con tu aprobación.

## 6. Coste y ofertas (Norma 7: el gasto va al final y lo paga el Founder)

- **HECHO:** oferta Black Friday vista el 24-nov: Creator anual $144 en lugar de $288, hasta 16 meses con bonus, vigente hasta el 8-dic-2026.
- **RECOMENDACIÓN:** para seis modelos de prueba no hace falta el prepago de 12 meses. Primero agotar los 5 créditos de la cuenta; si no basta, **un mes Creator cancelable** o créditos sueltos. Precios en euros **POR CONFIRMAR** al pagar (la pantalla de Rodin muestra dólares).
- **Segunda cuenta para aprovechar ofertas:** solo con una persona o empresa real distinta y sus propios medios de pago; no para sortear límites de la oferta o de la cuenta. Las condiciones de Hyper3D están **POR CONFIRMAR** (la página de licencias no se pudo leer en la sesión).

## 7. Licencia y entrenamiento

- **POR CONFIRMAR:** licencia comercial de lo generado con créditos gratuitos o con cada plan. Hasta aclararlo, tratarlo como **prueba/demostración**, con `--pilot-use-until 2026-12-31`.
- **HECHO (regla del repositorio):** los outputs de Hyper3D **nunca** se usan para entrenar un motor propio. Cada recibo lleva `trainingAllowedFromThisAsset: false`.
- Los GLB y referencias son privados: viven fuera del repositorio público (carpeta junto a la base de datos, `characters/`, o la indicada en `JANUS_CHARACTERS_DIR`).

## 8. Si algo falla

| Síntoma | Causa probable | Qué hacer |
| --- | --- | --- |
| «Modelo rechazado: …» | GLB con archivos externos, Draco/KTX2, sin malla o > 15 MB | Exportar de nuevo como GLB con todo incrustado y sin compresión |
| Se ve pero sin moverse | Es figura fija (Rodin sin rig) | Normal; ver sección 5 |
| Kendra no lo ve | Aún sin aprobar, o la tablet sin conexión | Aprobar en el panel; la tablet sincroniza al abrir la app y al recuperar conexión |
| No aparece el panel | Sin sesión de Founder | Entrar como Founder y reabrir el panel |
