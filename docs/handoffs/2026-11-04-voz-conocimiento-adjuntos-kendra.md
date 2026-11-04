# Handoff — voz propia, conocimiento del negocio, «+» y dashboard de Kendra (2026-11-04)

Rama: `claude/elevenlabs-voice-provider` (sobre `main` @ 9b38f41). Cuatro entregas apiladas, una por commit (ver `git log`):
`feat(voice)` ElevenLabs temporal + independencia · `feat(knowledge)` conocimiento por voz con Face ID · `feat(attachments)` botón «+» · `feat(kid)` dashboard de Kendra.

## Decisiones del Founder registradas hoy
- Su voz clonada en ElevenLabs (`Jean`) es la voz de **Janus únicamente** (no chatbots de clientes). ElevenLabs es un puente: Janus debe poder clonarla por sí mismo **desde sus grabaciones originales**, nunca desde audio generado por el proveedor.
- Janus por voz administra el conocimiento del negocio (precios, IVA, productos, equipo, instrucciones) con propuesta → lectura de confirmación → Face ID → aplicar → publicar → cada consumidor confirma.
- «+» (archivos, foto, escáner QR/barras/documentos): Janus, dashboard de Kendra, dashboard de IBA, productos propios futuros y Melanie de la web principal **solo en modo administrador** (Jean, autenticado). **No** en landing de ChatBox/IBA ni en Melanie pública.
- **Janus vive temporalmente en la tablet Samsung** (Termux; `docs/tablet-node.md`) hasta adquirir equipos propios en un par de meses. Se descarta contratar servidor por ahora (norma 7).
- Dashboard independiente para su hija (menor), con control del tutor, casa, agenda, tareas, intereses, planes y tiempo.

## HECHO (VERIFICADO)
- `npm run typecheck` limpio · `npm test` **642 pasan, 0 fallan, 1 omitida** · `node tests/runtime-smoke.mjs` ok · `node scripts/attach-smoke.mjs` ok (Chromium + cámara simulada leyendo un QR) · `node scripts/kendra-smoke.mjs` ok (Chromium: emparejar, personalizar, chat con filtro, agenda, tarea, vídeo aprobado, casa latente, PIN, panel de padres; sin errores de consola).
- Kendra: módulo LEGO `packages/modules/kid-dashboard/` + `apps/runtime/kid-routes.ts` + tablas `kid_*` + `open-meteo-adapter.ts` + app `apps/pwa/kendra.*` + panel de padres compartido (`kendra-parent.js`) + tarjeta en el dashboard de Jean. Guía y límites: `docs/kid-dashboard.md`.
- Seguridad de menores: el token de ella (`kdv_…`) nunca es autoridad de Founder (prueba); el PIN no puede emparejar ni cambiar el PIN; el contenido de la web entra «pendiente»; vídeo solo aprobado; sin voz en la nube; sin datos reales de ella en el repositorio **público**.
- Se retiró de código y pruebas cualquier nombre de centro/cita de la niña (ejemplos genéricos).

## PENDIENTE
- **Casa y tele de Kendra** (en reposo): claves Tuya IoT + `config/home-devices.local.json` + ejecutor (`HomeExecutor`); modelo de tele y método de control. Hoy se entienden y se registran, **no actúan**.
- **Zona de Kendra** (lat/lon/localidad) para el tiempo y los planes: lo fija el tutor en el panel. Variables extra de Open-Meteo: validar en la primera llamada real.
- **Fotos de la web** (slots): enlazar adjuntos a huecos con nombre («¿Qué te parece?», «vuelo con los 360», equipo) en `business-knowledge` y publicarlos por el publicador existente. Mecanismo de fotos de la web principal: **POR CONFIRMAR**.
- **Modo administrador de Melanie en la web principal**: diseño con Janus en la tablet como autoridad (consulta saliente desde la tablet, sin puerto expuesto); **necesita tu aprobación antes de tocar la web o el widget en vivo**.
- **«+» en el dashboard de IBA** (`infinity-chatbox-platform`): localizar su dashboard (no la landing) y montar el módulo con perfil `business-dashboard`.
- Compra pendiente de decisión: destino de publicación del catálogo; precio del plan de ElevenLabs en euros y cláusula oficial de uso de la salida; activar el puente Face ID.
- Interfaz de Kendra en neerlandés; notificaciones push de recordatorios; copia de seguridad de `attachments/`.

## BLOQUEADO
- Nada bloquea el código: el empuje de la rama a `janus-core` **ya está hecho** (se resolvió autorizando el repositorio en la sesión). Falta solo la decisión de Jean sobre el PR.
- Prueba en iPhone/tablet reales: no disponible desde aquí (Chromium solamente).

## PRÓXIMO (sugerido)
1. Jean: decidir el PR de la rama; crear el PIN y emparejar la tablet de Kendra desde su tarjeta.
2. Fijar su zona y aprobar los primeros vídeos.
3. Slots de fotos + modo administrador de Melanie (con tu aprobación para la web en vivo).
4. «+» en el dashboard de IBA.

## Reproducir
```
npm ci && npm run typecheck && npm test
node tests/runtime-smoke.mjs && node scripts/attach-smoke.mjs /tmp/a.png && node scripts/kendra-smoke.mjs /tmp/kendra
```
