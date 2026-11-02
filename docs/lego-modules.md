# Módulos LEGO reutilizables

Regla del Founder: cada pieza de Janus debe poder usarse en otros productos de InfinitySeed **sin afectar a Janus** y sin arrastrarlo.

## Contrato
- Carpeta autocontenida `packages/modules/<id>/` con `module.json`, `README.md` y `src/index.ts`.
- Un módulo solo importa librerías estándar de Node y archivos propios. Nunca importa `packages/core`, `orchestrator`, `gateways`, `voice` ni `apps`.
- Janus nunca importa un módulo directamente desde el núcleo: lo consume por un adaptador fino en `packages/adapters/` (o `apps/`).
- `tests/lego-module-boundaries.test.ts` hace cumplir ambas reglas. Si se rompe, falla la CI.

## Módulos actuales
| Módulo | Qué hace | Adaptador en Janus |
|---|---|---|
| `seneca-wisdom` | Vida, obra, doctrina, citas con estado de verificación y guía antiestrés (con modo `support_first` ante crisis). | `seneca-tool-adapter.ts` → herramienta `seneca` (solo lectura, local) |
| `marcus-aurelius-wisdom` | Vida, Meditaciones, doctrina, citas (texto contrastado con la traducción de G. Long; español libre) y ejercicios; mismo modo `support_first` ante crisis. | `marcus-aurelius-tool-adapter.ts` → herramienta `marcus-aurelius` (solo lectura, local) |
| `janus-school` | Escuela offline: ruta de formación del Founder (10 unidades, glosario, repaso espaciado) y sesiones de matemáticas para niños con atención variable, con nivel de evidencia y sin diagnosticar. | `janus-school-tool-adapter.ts` → herramienta `janus-school` (perfil infantil restringido) |
| `companion` | Criaturas con carácter fijo (movimiento, voz, forma de enseñar), ánimo sutil, tutor de matemáticas con parámetros, juego social y seguridad con aviso al tutor. | `companion-kit.ts` → paquete del dashboard (global `Companion`) |
| `avatar-look` | Pelo, ojos, prendas y accesorios de un personaje (catálogo cerrado, solo estético). | `companion-kit.ts` |
| `star-shop` | Estrellas por esfuerzo (tope diario, sin castigos), tienda, casa, vehículos y decoración. | `companion-kit.ts` |
| `scene-stage` | Escena manipulable por el guía y por quien aprende + lecciones de matemáticas con representaciones concretas (comandos validados por lista blanca). | `companion-kit.ts` |
| `face-id` | Identificación facial de hogar en conjunto cerrado (comodidad, nunca autenticación). | `face-recognition-adapter.ts` → pista fusionada con la voz |
| `speaker-id` | Consentimiento, bóveda cifrada AES-256-GCM, identificación de hablante en conjunto cerrado. | `speaker-recognition-adapter.ts` → pista opcional `VoiceSpeakerHint` |

## Reutilizar en otro producto
Copiar la carpeta `packages/modules/<id>/` (o publicarla como paquete) y llamar a su `index.ts`. No requiere Janus.
