# Handoff integrado — JANUS CORE + dashboards A/B + evolución
Fecha: 2026-11-04 · Rama: `chatgpt/janus-integrated-review-20261104` · PR #59 (borrador).

## AHORA
**Fuente vigente**: rama de Claude `claude/elevenlabs-voice-provider`, extendida por PR #58 (premortem/postmortem) y el subárbol A/B de PR #56, sin sobrescribir fuentes de Claude. El graft fue realizado y se retiró el workflow temporal con permiso de escritura.

## HECHO EN CÓDIGO
- `npm run start:dashboards`: compila A/B usando código y assets propios; carga `.env.local` con el mecanismo existente de JANUS; arranca el runtime sin contratar servidores.
- Core sirve `GET /dashboard/a` y `GET /dashboard/b` en la **misma autoridad/origen** que PWA `/`, autenticación Founder y APIs `/api/command`, `/api/events`, `/api/runs/:id`. Sin tokens incrustados.
- El dashboard incluye `JanusGateway`: identifica `/health` auténtico, elige CORE antes de adaptadores remotos, y **no envía información privada a Claude si CORE rechaza el acceso**. Registra estado real completado/bloqueado/fallido. Las acciones de hogar no se declaran reales cuando no hay servicio; Core administra permisos.
- Identidades aprobadas: **JANUS** masculino, voz asignada del Founder (no confundirlo con Jean); **Melanie** femenina. Ojos/cejas/labios y animaciones 3D procedurales; GLB importable por persona. Criaturas Lumi/Bombo/Musgo/Nimbo siguen con el mismo catálogo reusable.
- `janus-evolution-guard`: 12 señales de premortem + postmortem reincidente + propuestas no autopublicables; SQLite de la misma memoria JANUS; endpoint autenticado `/api/evolution`.

## VERIFICAR
```sh
npm install
npm run typecheck && npm test
npm run dashboard:test
npm run dashboard:build
node tests/runtime-smoke.mjs
npm run start:dashboards
```
Desde el mismo dispositivo: `http://127.0.0.1:8787/` para la PWA, `http://127.0.0.1:8787/dashboard/a` y `/dashboard/b`. Si `PORT` es distinto, usar el puerto configurado. Iniciar sesión Founder en la PWA **en la misma pestaña y origen** antes de acciones administrativas. Los HTML standalone siguen siendo útiles offline, pero un `file://` **NO** es el servidor Core.

## PENDIENTE / BLOQUEADO
1. Comprobar último CI de PR #59 (typecheck, suite, smoke PWA/Core, E2E Chromium) y resolver fallos. No afirmar 100 % hasta pruebas.
2. No hay licencia/entrega verificada de los 2 GLB hiperrealistas riggeados con PBR, visemas, morph targets: mallas actuales son 3D procedurales. No presentar como igual al arte cinematográfico aprobado.
3. Voz ElevenLabs clonada (asignada a JANUS, no Jean), permisos Founder/Face ID, integraciones y acceso en iPhone requieren credenciales y prueba en hardware privado; sin datos/secretos en GitHub.
4. Si se publica acceso desde otros dispositivos, debe ser HTTPS confiable, no exponer el servidor/SQLite directamente en LAN ni activar acciones externas sin revalidación.
5. Mantener diseño femenino aprobado y la landing pública/IBA sin cambios. Sin fusión o despliegue de producción.

## REGLA DE CONTINUIDAD
El PRESENTE gobierna ejecución; el PASADO guarda causalidad; el FUTURO usa ambos. Cada cambio: premortem → pruebas locales/CI → gate de calidad → Founder autoriza → publicar → postmortem si falla → aprendizaje irreversible → nueva versión vigente. La CI es evidencia verificable; lo no probado se marca POR CONFIRMAR.
