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
| `infinity-interpreter` | Traducción contextual reutilizable (Connect como producto principal), glosario, registro y consentimiento explícito. | `infinity-interpreter-tool-adapter.ts` → herramienta `interpreter`; reutiliza Model Gateway y posteriormente STT/TTS |
| `janus-school` | Escuela offline: ruta de formación del Founder (10 unidades, glosario, repaso espaciado) y sesiones de matemáticas para niños con atención variable, con nivel de evidencia y sin diagnosticar. | `janus-school-tool-adapter.ts` → herramienta `janus-school` (perfil infantil restringido) |
| `business-knowledge` | Conocimiento vivo del negocio: productos, precios, IVA, equipo, FAQ e instrucciones; propuestas con lectura de confirmación en español, revisiones encadenadas por SHA-256, snapshots con checksum y estado de sincronización por consumidor. | `business-knowledge-tool-adapter.ts` → herramienta `knowledge` (`change.apply` y `snapshot.publish` privilegiadas: aprobación + Face ID) |
| `chat-attachments` | Botón «+» para compositores de chat: archivos, foto, escáner de QR/códigos de barras y documentos; perfiles `founder-admin`, `business-dashboard` y `kid`; lo adjunto son datos (nunca órdenes), enlaces escaneados sin abrir solos, tipo verificado por bytes. | `apps/runtime/server.ts` (`POST/GET /api/attachments`, `attachments` y `scans` en `/api/command`) y `apps/pwa` (`attach.js` generado con `npm run build:attach`) |
| `kid-dashboard` | Dashboard de una menor (Kendra): perfil personalizable por ella, PIN parental, filtro de contenido, horario y tiempo por actividad, YouTube solo aprobado, control de la casa por política del tutor, agenda con recordatorios, tareas y proyectos, intereses y planes aprobados, qué ponerse según el tiempo. Datos de menor: mínimos, tutor con visibilidad. | `apps/runtime/kid-routes.ts` (`/api/kid/*`, `/api/parent/kid/*`), `open-meteo-adapter.ts`, `apps/pwa` (`kendra.html`, `kendra.js`, `kendra-parent.js`) |
| `face-id` | Identificación facial de hogar en conjunto cerrado (comodidad, nunca autenticación). | `face-recognition-adapter.ts` → pista fusionada con la voz |
| `speaker-id` | Consentimiento, bóveda cifrada AES-256-GCM, identificación de hablante en conjunto cerrado. | `speaker-recognition-adapter.ts` → pista opcional `VoiceSpeakerHint` |

## Reutilizar en otro producto
Copiar la carpeta `packages/modules/<id>/` (o publicarla como paquete) y llamar a su `index.ts`. No requiere Janus.
