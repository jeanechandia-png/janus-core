# JANUS — Traspaso a ChatGPT: figuras 3D (criaturas y robots) · 24 noviembre 2026

De: Claude (sesión `claude/biblioteca-3d-hyper3d`, PR #95 fusionado en `main`, `8e9926e`). Para: ChatGPT («Word» para Jean). Repositorio único y canónico: `jeanechandia-png/janus-core`.

Motivo: el uso de Claude del Founder está al 98 % y se reinicia el sábado (INFERENCIA, fecha POR CONFIRMAR), así que el trabajo sigue en ChatGPT. «Proyecto Llanos», dictado por voz, se interpreta como **JANUS** (INFERENCIA; confirmar con Jean).

Etiquetas: **HECHO VERIFICADO**, **INFERENCIA**, **RECOMENDACIÓN**, **POR CONFIRMAR**.

## 0. Reglas que mandan (no negociables)

1. **Prohibido hacer copias (orden de Jean, 24-nov).** Ni repositorios, ni módulos, ni dashboards, ni activos duplicados. Se evoluciona el único producto (`janus-core`) para que crezca de forma constante. Refuerza Normas 3 y 5 de Infinity Seed 6 y la «Norma de integridad del producto único» (`docs/operating-norms.md`).
2. **No reiniciar ni reducir lo válido.** No tocar ni rediseñar las dashboards, los robots ni las criaturas aprobadas (Norma 8, 10-nov). Las figuras nuevas entran **solo** por la biblioteca existente (§6).
3. **Nunca editar `main`**: rama + PR; fusionar solo con CI en verde.
4. **Norma 7: el gasto va al final y lo paga el Founder.** Cifras siempre en euros. No manejar datos de pago ni credenciales de Jean.
5. **Norma 11 (Verdad):** distinguir HECHO / INFERENCIA / RECOMENDACIÓN / POR CONFIRMAR; no declarar hecho nada sin recibo y lectura de comprobación; no inventar resultados.
6. **Los outputs de Hyper3D no se usan para entrenar un motor propio** (cada recibo lleva `trainingAllowedFromThisAsset: false`).
7. **Secretos fuera de SQLite y del código; el repositorio es público.** Los GLB viven fuera del repositorio (carpeta `characters/` junto a la base de datos o `JANUS_CHARACTERS_DIR`).
8. **Jean no domina la jerga:** pasos cortos, uno a uno, en español. Las vistas previas se entregan como **HTML clicable independiente**, comprobadas como él las ve (rechazó las vistas previas en Artifact/canvas). Trabaja desde un iPhone 16 Pro Max.

## 1. Estado

**AHORA:** continuar y cerrar las figuras (4 criaturas + 2 robots) y comprobar que toda instrucción dada en el chat de Claude y en el de ChatGPT está implementada (§8).

**HECHO VERIFICADO**
- Biblioteca central de personajes 3D (módulo `packages/modules/character-library`, rutas del Founder y de Kendra, panel en la PWA, sincronización por huella, retirada de lo rechazado): PR #95 en `main`, CI `dashboard` y `test` en verde; 908 pruebas, 907 PASS, 0 FAIL, 1 SKIP. Detalle: `docs/handoffs/2026-11-24-character-library-hyper3d.md` y `docs/HYPER3D_RODIN_PLAYBOOK.md`.
- Dos figuras reales de Rodin reducidas con el método de §5 y aceptadas por el inspector 3D Forge (válidas; 70 000 triángulos). Jean ya las recibió en el chat de Claude.
- Suscripción Creator de Rodin activa (la pagó Jean). Recordatorio en su iPhone para el 21-dic 10:00 (baja antes de la renovación).

**PENDIENTE**
- Identificar cada figura frente a su ranura (§3) y generar las que faltan: Lumi, Bombo, Nimbo y Nexo masculino (Janus); Musgo por confirmar.
- Jean debe subir y aprobar en su panel las dos figuras reducidas (nada de esto está aún en su biblioteca viva).
- Comprobar que la tablet de Kendra se actualizó (se actualiza sola desde `main` cada 30 min por `scripts/tablet/update-janus.sh`; **no verificado en el aparato de Jean**).
- Ajolote: el paso de color en Rodin dio una vista facetada de baja resolución; causa desconocida y sin archivo con color utilizable.
- Melanie no tiene color (solo geometría).

**BLOQUEADO**
- Saldo de Claude agotado hasta el reinicio semanal.
- Créditos de Rodin casi agotados (§4); más créditos o más meses son gasto de Jean (Norma 7).
- Rigging, expresiones y animaciones: paso aparte y de pago; decide el Founder.

**PRÓXIMO (en este orden)**
1. Pedir a Jean que suba Melanie y la criatura de piedra con musgo y las apruebe (§6); confirmar visualmente en su iPhone.
2. Con los créditos restantes, generar Nexo-Janus (la prueba que falta) y después las criaturas pendientes, siguiendo §4.
3. Reducir cada GLB nuevo con §5, subirlo y aprobarlo.
4. Completar la matriz de §8 con evidencia real.

## 2. Qué se pidió y qué ya existe

El Founder pidió instrucciones para generar en Hyper3D Rodin las cuatro criaturas de Kendra (Lumi, Bombo, Musgo, Nimbo) y los dos robots Nexo (masculino = Janus, femenino = Melanie), y poder anexarlos a Janus, a la dashboard de Kendra y a la suya, continuando siempre en el producto original. Las identidades ya existen (referencias aprobadas; tabla en el playbook §1): **no se inventan otras**.

## 3. Matriz de figuras (huellas SHA-256)

Todos los GLB salen de Rodin vía «Khronos glTF Blender I/O v4.3.47» y son figuras fijas (sin esqueleto, expresiones ni animaciones).

| Ranura | Original de Rodin | Reducido (el que se sube) | Estado |
| --- | --- | --- | --- |
| `nexo-femenino` (Melanie) | `base.glb`, 33 562 700 B, 1 000 000 triáng., sin textura. SHA `934de647fbb89624efb484adb2516df8a406e54111fb8c483fed0b87d51d71a1` | `nexo-femenino-melanie-70k.glb`, 1 261 004 B, 70 000 triáng. SHA `fe7575941cc1361ed9c54fd55d4ba59704c23a48a1ccd1d3e2c7f47ba74bdb17` | HECHO: reducido, válido en Forge, entregado a Jean. Sin color |
| `musgo` (probable; INFERENCIA, sin confirmar) | `base_basic_shaded.glb`, 44 884 892 B, 1 000 000 triáng., textura PNG de 6,7 MB. SHA `92383203af92f8cdb41e739bad3a61340a2aafb114bbc47578d29884cdf074b4` | `criatura-musgo-70k.glb`, 8 705 952 B, 70 000 triáng., con textura. SHA `9d228c4be5cab676addae8c68737f56662dd5aeaf449af601b5aad25013216f0` | HECHO: reducido, válido, entregado. Falta confirmar con Jean si es Musgo |
| sin identificar | `base_1.glb`, 36 392 520 B, sin textura. SHA `91d8eb7731d6a90fc8770ae05f6d6baaf9608769fcfa4539a148f3017b3a3a5e` | `figura2-70k.glb`, 1 260 352 B. SHA `cc2da0c10e7806bb1307bbf5d5df10ae86ca0740e43f2efb375f8d3867c69a7e` | NO entregado a Jean. Puede ser la criatura de piedra sin color; confirmar |
| `lumi`, `bombo`, `nimbo`, `nexo-masculino` | — | — | NO generados con color utilizable |

Descartado: un GLB gris de 45 928 B y 912 triángulos (`3e8e3eea-base.glb`), rechazado por Jean; nunca entró en la biblioteca.

**Cuidado con Bombo:** la figura aprobada es el **ajolote rosado**. El ajolote que Jean generó era una variante *steampunk* (INFERENCIA por lo hablado): comprobar que la referencia usada sea el ajolote rosado aprobado y no otra variante.

Los GLB reducidos **no están en el repositorio** (privados); Jean los tiene en el chat con Claude. Se pueden regenerar con §5 desde el original de Rodin («Mine»).

## 4. Procedimiento verificado en Rodin (el que funcionó en el iPhone de Jean)

1. Abrir el activo desde **Mine** y esperar a que termine de cargar: el panel **Pack** se activa solo entonces (antes sale atenuado y no responde).
2. Pack: formato **.glb**, geometría **Base Model**, material **Shaded** ✓ y **PBR** ✗ → **Download**. (HECHO: así se obtuvo `base_basic_shaded.glb`.)
3. **Evitar 8K**: bloqueó la página en el 95 % y la descarga volvió a empezar en el 99 %. Si ocurre, repetir el paso de Material sin 8K.
4. El color es un paso aparte (**Material**): el visor de solo geometría muestra colores de mapa de normales que no son la pintura.
5. «Shaded» da una textura de color horneada (aspecto plano, sin luz); «PBR» da mapas físicos. Para Janus sirve Shaded.
6. Esfuerzo de generación (captura 24-nov): Extreme-Low, Low y Medium con «Free Preview». **Descargar Medium exige suscripción**; Low y Extreme-Low se descargan gratis. Qué cubre exactamente «Free Preview»: POR CONFIRMAR.
7. Cada GLB descargado pesa 33–45 MB y 1 000 000 de triángulos: **hay que reducirlo** (§5) antes de subirlo (límite del Forge: 15 MB y 300 000 triángulos; ideal ≤ 80 000).

## 5. Reductor (método probado; vive fuera del repositorio)

Soldar vértices por posición (tolerancia 0), simplificar con meshoptimizer vía glTF Transform (razón = objetivo/actual, error 0,01), quitar NORMAL, quitar UV solo si no hay textura, recalcular normales suaves ponderadas por área. Rechaza archivos con esqueleto o animación. Instalación (fuera del repositorio): `npm i @gltf-transform/core @gltf-transform/functions meshoptimizer`. Uso: `node reduce-glb.mjs entrada.glb salida.glb [70000]`.

```js
// Reduce un GLB estático de Rodin (1 M de triángulos) a ~70 mil, conservando la textura si existe.
// Uso: node reduce-glb.mjs entrada.glb salida.glb [triangulos_objetivo=70000]
// Requiere (fuera del repositorio): npm i @gltf-transform/core @gltf-transform/functions meshoptimizer
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const [,, inp, out, target = '70000'] = process.argv;
const doc = await new NodeIO().read(inp);
const root = doc.getRoot();
if (root.listSkins().length || root.listAnimations().length) throw new Error('Solo figuras fijas: con esqueleto o animación hace falta otro flujo');
const prims = () => root.listMeshes().flatMap((m) => m.listPrimitives());
const tris = () => prims().reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
const before = tris();
const hasTexture = root.listTextures().length > 0;
for (const p of prims()) { p.setAttribute('NORMAL', null); if (!hasTexture) p.setAttribute('TEXCOORD_0', null); }
await doc.transform(prune(), weld({ tolerance: 0 }));
await MeshoptSimplifier.ready;
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: Number(target) / before, error: 0.01, lockBorder: false }), dedup(), prune());
for (const p of prims()) { // normales suaves ponderadas por área
  const pos = p.getAttribute('POSITION'), P = pos.getArray(), I = p.getIndices().getArray(), N = new Float32Array(P.length);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { N[k] += nx; N[k + 1] += ny; N[k + 2] += nz; }
  }
  for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }
  p.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(N).setBuffer(pos.getBuffer()));
}
await new NodeIO().write(out, doc);
console.log(JSON.stringify({ trianglesBefore: before, trianglesAfter: tris(), keptTexture: hasTexture }));
```

**HECHO VERIFICADO (24-nov, 18:27):** con este script exacto, Melanie → 1 261 004 B y 70 000 triáng.; criatura con textura → 8 705 952 B y 70 000 triáng.; las huellas coinciden con las de §3 y 3D Forge da `valid: true` en ambas.

Lección (ERROR → CAUSA → PREVENCIÓN): conservar NORMAL y UV con soldadura tolerante deja la simplificación atascada en ~107 000 triángulos (las costuras bloquean). Se evita quitando NORMAL (y UV sin textura), soldando por posición y recalculando normales. `normals({overwrite:true})` de glTF Transform desuelda la malla y da sombreado facetado: no usarlo aquí.

**Decisión de Jean pendiente:** añadir `@gltf-transform/core`, `@gltf-transform/functions` y `meshoptimizer` como dependencias de desarrollo para convertirlo en el comando `forge:reduce` con pruebas y recibo (SHA original → SHA derivado). Hasta que lo autorice, queda como script externo documentado (no añadir dependencias sin su OK).

## 6. Subir, aprobar y repartir (código ya en `main`)

1. Founder abre la app → botón «Instalar JANUS 3D original» (en las dashboards A/B, menú «JANUS 02 NEXO · 3D», con sesión de Founder) → panel **Biblioteca de personajes 3D**.
2. Elige el origen (Hyper3D Rodin), sube el `.glb` reducido en la fila de la figura → **Ver** → **Aprobar** (o **Rechazar**).
3. Cada subida se valida con 3D Forge (falla cerrado), se guarda por SHA-256 con recibo y nace **pendiente de revisión visual**. Kendra recibe **solo lo aprobado**; si se rechaza después, se retira de su tablet en la siguiente sincronización. Una versión nueva pendiente no quita la aprobada.
4. Ranuras: `lumi`, `bombo`, `musgo`, `nimbo`, `nexo-masculino`, `nexo-femenino`. Límite de subida: 15 MB.
5. Alternativa por terminal: `npm run forge:prepare -- --input X.glb --slot musgo --origin hyper3d-rodin --pilot-use-until 2026-12-31`.

## 7. Costes y licencia

- Plan **Creator** (mensual, primer mes con descuento) contratado por Jean el 24-nov. Rodin muestra los precios en dólares; **el cargo real en euros lo confirma Jean** (anotado en `docs/dormant-capabilities.md`, Norma 7.4). Jean indica que el mes siguiente son **28 €**; la fecha exacta de renovación es POR CONFIRMAR (INFERENCIA: ≈24-dic, un mes tras el alta). Por eso el recordatorio es el 21-dic 10:00. Al cancelar, la membresía expira de inmediato (pantalla de facturación de Rodin; términos oficiales POR CONFIRMAR): **aprovechar los créditos antes de cancelar**.
- Saldo visto en facturación: 29,00 de 30,00 créditos del plan usados (97 %) y 4,50 créditos permanentes (0,50 retenidos). Es lo que queda para generar.
- **Licencia comercial de lo generado: POR CONFIRMAR.** La tarjeta del plan dice «Unlimited Export & Any Use», pero no se leyeron los términos reales. Hasta aclararlo, tratar todo como prueba/demostración (`--pilot-use-until 2026-12-31`).
- Rigging (`hyper3d/rigging` vía fal.ai): precio POR CONFIRMAR; decide el Founder.
- Segunda cuenta para aprovechar ofertas: solo con una persona o empresa real distinta y sus propios medios de pago, nunca para sortear límites de la oferta o de la cuenta (playbook §6).

## 8. Matriz de verificación — «¿están implementadas todas las instrucciones?»

Rellenar con evidencia real (comando, captura, huella o enlace). Quien no pueda comprobar algo lo marca POR CONFIRMAR; no lo da por hecho.

| # | Instrucción del Founder | Estado al 24-nov | Evidencia | Quién comprueba |
| --- | --- | --- | --- | --- |
| 1 | Instrucciones para generar en Rodin 4 criaturas + 2 robots | HECHO | `docs/HYPER3D_RODIN_PLAYBOOK.md`, PR #95 | ChatGPT lee y confirma |
| 2 | Anexar las figuras a Janus, a la dashboard de Kendra y a la suya | Código HECHO (PR #95, CI verde); **en aparatos reales NO VERIFICADO** | `tests/character-*.test.ts`; falta ver la tablet y el iPhone | Jean + ChatGPT |
| 3 | Continuar en el producto original, sin reiniciar | HECHO | todo en `janus-core`, `main` | ChatGPT (`git log`) |
| 4 | Implementar el código | HECHO | PR #95, 908 pruebas | ChatGPT (`npm ci && npm run dashboard:build && npm test`) |
| 5 | Ayuda en vivo con Rodin en el iPhone | HECHO en parte: 4 descargas, 2 utilizables | §3 | — |
| 6 | Aprovechar las ofertas de Rodin | Parcial: Creator contratado; segunda cuenta solo con persona/empresa distinta | §7 | Jean |
| 7 | Generar Lumi, Bombo, Nimbo, Nexo-Janus | PENDIENTE | §3 | Jean + ChatGPT |
| 8 | Confirmar identidad de cada figura frente a su ranura | PENDIENTE | §3 | Jean |
| 9 | Subir y aprobar las figuras en el panel | PENDIENTE | §6 | Jean |
| 10 | Prohibido hacer copias | VIGENTE (§0.1); sin copias creadas en esta sesión | `git status`, sin repos nuevos | ChatGPT en cada cambio |
| 11 | Cancelar Rodin antes de la renovación | Recordatorio puesto (21-dic 10:00); fecha de renovación POR CONFIRMAR | recordatorio en el iPhone | Jean |
| 12 | Traspaso a ChatGPT con las normas operativas | HECHO (este documento y el texto entregado a Jean) | este archivo | ChatGPT responde con §10 |

## 9. Hallazgos previos, no causados por este trabajo (verificados idénticos en `main` @44f1c6c)

- `404` en `/api/founder/private-cases`.
- Violación de CSP por WebAssembly en la página de Kendra (solo afecta a modelos comprimidos con meshopt; el reductor no los produce).
- Desbordamiento de `.topbar-actions` en vista móvil de 430 px (la emulación ensancha el diseño a 532 px). Tocarlo afecta a la dashboard aprobada: **solo con el OK de Jean**.
- Prueba en iPhone real y en la tablet de Kendra: pendiente.

## 10. Lo que ChatGPT debe responder a Jean antes de empezar

1. Qué puede y qué NO puede hacer sobre GitHub: leer el repositorio, crear ramas, hacer commits y PR, ejecutar pruebas, ver el CI. Si no puede empujar cambios, debe entregar parches o instrucciones y **no declarar nada como hecho**.
2. Confirmar que leyó `START_HERE.md`, `docs/STATE.md`, `docs/operating-norms.md` y este documento, y que acepta §0.
3. Proponer el primer paso concreto (§1 PRÓXIMO) y esperar el visto bueno de Jean para cualquier gasto, publicación o cambio visual.

## 11. Cómo reproducir y comprobar

```bash
git clone https://github.com/jeanechandia-png/janus-core && cd janus-core
npm ci && npm run dashboard:build && npm test      # 908 pruebas esperadas, 0 fallos
npm run continuity && npm run continuity:guard     # estado READY
```

Cierre de cada sesión: rama y commit, pruebas ejecutadas, cambios, pendientes y este mismo formato de traspaso.
