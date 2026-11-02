# Handoff — Compañero 3D dentro de la escena (2026-11-02)

Ramas (sin fusionar, a la espera de Jean):
- `claude/companion-escena-3d-modulo` (sobre `main` @ 9b38f41): 4 módulos LEGO + adaptador + pruebas.
- `claude/companion-escena-3d` (sobre el final de #43 @ 9086eb8): vista del dashboard + 2 piezas 3D en `prototypes/dashboard/lego/`.

## Qué pidió Jean
La criatura **no** es una imagen plana encima de la pantalla: forma parte de la escena 3D, se personaliza (ropa, accesorios, pelo, ojos) sin perder su carácter, vive en un entorno con casa/coche/moto que se compran, ayuda a Kendra con el tema elegido siguiendo las mismas bases que un profesional (sin sustituirlo), manipula la escena para mostrar lo que explica y Kendra puede manipular toda la escena. Kendra le pone nombre. Todo debe ser **módulos reutilizables** (norma operativa).

## Arquitectura (LEGO)
| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| `companion` | `packages/modules/companion` | carácter fijo de cada criatura, tutor de mates, seguridad (nunca cuerpo/peso, avisos a papá) |
| `avatar-look` | `packages/modules/avatar-look` | catálogo cerrado de aspecto: colores, ojos, ropa, accesorios |
| `star-shop` | `packages/modules/star-shop` | estrellas por esfuerzo (tope diario 12, idempotente), tienda, casa/vehículo/decoración |
| `scene-stage` | `packages/modules/scene-stage` | escena como datos, lista blanca de comandos, manipulación de Kendra, lecciones con representaciones concretas |
| adaptador `companion-kit` | `packages/adapters/src/companion-kit.ts` | compone los cuatro; reglas que cruzan módulos (vestirse exige ser suyo; el filtro de cuerpo vale para todo texto de la escena) |
| `janus-creatures-3d` | `prototypes/dashboard/lego/` | dibuja las criaturas (three.js r160) |
| `janus-stage-3d` | `prototypes/dashboard/lego/` | dibuja y maneja la escena; la criatura camina, señala y reacciona |

Los módulos no importan nada fuera de su carpeta (lo impone `tests/lego-module-boundaries.test.ts`). El dashboard consume el adaptador empaquetado: `prototypes/dashboard/vendor/companion.js`.

## HECHO VERIFICADO
- `janus-core`: `tsc` limpio; **612 pruebas, 611 pasan, 1 omitida (previa), 0 fallos**.
- Dashboard (Chromium sin cabeza con SwiftShader), tablet 1194×834 y teléfono 430×932: ver `prototypes/dashboard/HANDOFF.md` (sección 2026-11-02) y `prototypes/dashboard/tests/e2e-companero.cjs`.
- Seguridad: el nombre que Kendra le pone a la criatura pasa por el filtro de cuerpo/peso (hueco hallado hoy: «Gordi» pasaba; corregido y con prueba).

## ERROR → CAUSA → IMPACTO → LECCIÓN → PREVENCIÓN → CAMBIO → VERIFICACIÓN
- **ERROR:** un nombre como «Gordi» se aceptaba. **CAUSA:** el filtro buscaba `gorda/gordo/gordita` con límite de palabra y `renameCreature` no lo usaba. **IMPACTO:** la criatura lo dice en cada frase; esas frases pasan por el mismo filtro y se habrían bloqueado, o se habría normalizado un apodo de cuerpo. **LECCIÓN:** todo texto que el niño elige y que luego se pronuncia es entrada no confiable. **PREVENCIÓN:** `renameCreature` rechaza lo que no pasa `isBodySafe`; el patrón cubre diminutivos. **CAMBIO:** `encourage.ts`, `profile.ts`, prueba en `tests/companion.test.ts`. **VERIFICACIÓN:** prueba nueva en verde.
- **ERROR (preview):** en la piel B, las muestras de color del vestidor cambiaban de color (el traductor de paleta reescribe los atributos `style`). **CAUSA:** el color real iba en `style="--c:#…"`. **CAMBIO:** el color va en `data-hex` y se aplica por JS tras pintar. **VERIFICACIÓN:** captura en piel B.
- **ERROR (preview):** en vertical, la criatura quedaba cortada. **CAUSA:** el estrechamiento de la cámara de la vista «mesa» pensado para la vista amplia. **CAMBIO:** en vertical la vista «mesa» se ajusta al contenido con margen. **VERIFICACIÓN:** captura en 430×932.

## Se retira
La importación de clips animados a IndexedDB (versión plana rechazada). No hay migración: lo guardado en un dispositivo queda sin usarse.

## PENDIENTE / POR CONFIRMAR
- **POR CONFIRMAR:** rendimiento en iPad/iPhone reales (solo medido por software); revisión de las lecciones y de la economía de estrellas por un profesional; efecto de las estrellas dentro de una app (evidencia directa limitada).
- **PENDIENTE:** número en recta (Rec. 4 IES/WWC 2021006); voz propia de cada criatura (hoy voz del navegador; ElevenLabs sin créditos → gasto al final, norma 7); especie nueva de criatura exige tocar `build()` (no es solo datos); en vertical la criatura se ve pequeña.
- **ADR:** no se numera uno para evitar colisión (hay huecos y reservas 009–010 y 012). Proponer ADR al fusionar.

## Reproducir
```
cd janus-core && git checkout claude/companion-escena-3d-modulo && npm ci && npx tsc --noEmit -p . && node --import tsx --test
cd prototypes/dashboard   # rama claude/companion-escena-3d
node build.cjs && node build.cjs --skin b
PLAYWRIGHT_MODULE=… node tests/e2e-companero.cjs        # SwiftShader; ver cabecera del fichero
```

## PRÓXIMO
1. Jean revisa el preview (tablet y teléfono) → aprueba o corrige.
2. Con su visto bueno: fusionar primero la rama de módulos, después la del dashboard; generar el ZIP (norma: solo tras aprobación).
3. Probar en el iPad y el iPhone reales (rendimiento y táctil).
