# Aprobaciones del Founder (2026-10-14)

Las acciones sensibles (escrituras externas, generaciones de pago, cambios de producción — ver `SENSITIVE_TOOL_ACTIONS`) ya no se aprueban solas ni fallan a ciegas: **esperan la decisión explícita del Founder**.

## Flujo
1. El planificador propone la acción → la política de acciones sensibles la marca como riesgo alto, irreversible y con aprobación.
2. El TaskRunner exige autoridad autenticada (acción privilegiada) y luego pide aprobación → la ejecución queda en `waiting_approval` y se crea una solicitud en la **cola de aprobaciones** (`packages/core/src/approval-queue.ts`).
3. El Founder decide en la PWA (panel «Aprobaciones») o vía API. Una sola decisión por solicitud (una segunda → 409). Sin respuesta en `JANUS_APPROVAL_TIMEOUT_MS` (15 min por defecto, mín. 30 s, máx. 24 h) → caduca y **no** se ejecuta. Cancelar la ejecución cancela sus solicitudes.
4. Cada transición queda en un recibo `founder_approval` (pendiente → aprobada/rechazada/caducada/cancelada), con quién decidió.

## API (solo Founder autenticado)
- `GET /api/approvals` → `{ pending, recent, timeoutMs }`
- `POST /api/approvals/{id}/decision` con `{ "approved": true|false, "note"?: "…" }`

## Inicio de sesión desde la PWA
- «Vincular este dispositivo» crea un par de llaves ECDSA P-256 con WebCrypto; la **llave privada no es exportable** y se guarda en IndexedDB del dispositivo. Janus solo conoce la llave pública.
- Registro: configurar la llave pública mostrada como `JANUS_FOUNDER_PUBLIC_KEY_PEM` en el equipo de Janus y reiniciar. (Si ya hay otra llave de Founder registrada, Janus la protege y no la sustituye en silencio.)
- «Entrar como Founder» usa el reto/firma existente (`/api/auth/challenge` → `/api/auth/verify`). Janus acepta ahora también la firma en formato IEEE P1363 que generan los navegadores (además de DER).
- El token de sesión vive en `sessionStorage` (se borra al cerrar la app). Solo funciona por HTTPS de confianza o en el propio equipo (política existente de transporte seguro).
