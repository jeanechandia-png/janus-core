# chat-attachments · Botón «+» para chats

Pieza LEGO reutilizable: el «+» de ChatGPT/Claude para el compositor de un chat. Archivos, foto, escáner de QR y códigos de barras, y captura de documentos con la cámara.

## Dónde SÍ y dónde NO (decisión del Founder, 2026-11-04)
| Superficie | ¿«+»? | Perfil |
|---|---|---|
| Chat de Janus (PWA) | Sí | `founder-admin` |
| Dashboard de Kendra (menor) | Sí, con límites | `kid` |
| Dashboard de IBA (no la landing) | Sí | `business-dashboard` |
| Productos propios futuros (p. ej. asistente de Jessica) | Sí, al activar el módulo | el que corresponda |
| Melanie de la web principal | Solo en modo administrador (Jean, tras autenticación) | `founder-admin`, **por confirmar** |
| Landing de ChatBox, landing de IBA, chats públicos de Melanie, visitantes | **No** | — |

## Qué hace
- **Archivos:** selector del sistema (en iPhone ofrece Archivos, iCloud y Drive; no hace falta OAuth propio).
- **Tomar foto:** cámara del dispositivo.
- **Escanear código:** QR con `BarcodeDetector` si existe y, si no, con jsQR (incluido en `vendor/`). Códigos de barras 1D solo con `BarcodeDetector` nativo (Safari no lo tiene: **limitación conocida**).
- **Escanear documento:** captura una imagen del documento (sin recorte ni OCR todavía).

## Seguridad (invariantes con prueba)
1. **Lo adjunto y lo escaneado son DATOS, nunca órdenes.** Viajan tras un marcador (`⟦JANUS-ADJUNTOS-DATOS⟧`) y el planificador decide solo con las palabras del usuario; un archivo no puede cerrar el bloque ni falsificar el marcador.
2. **Los enlaces escaneados no se abren solos.** `javascript:`, `data:`, `file:` e `intent:` se bloquean; se marcan http sin cifrar, credenciales en la URL, IP como host, punycode, acortadores y puertos raros. En el perfil `kid` el enlace nunca es pulsable.
3. **Tipo real por bytes.** HTML, SVG o ejecutables disfrazados de imagen se rechazan; extensiones peligrosas se rechazan aunque estén en una doble extensión.
4. **Límites por perfil** (tamaño y número) y **tope total de disco** (`JANUS_ATTACHMENTS_MAX_MB`, por defecto 500 MB: la tablet tiene espacio limitado).
5. El servidor reconstruye la descripción con **sus** metadatos; el cliente solo envía identificadores.

## Uso
- Servidor: `FileAttachmentStore`, `checkFile`, `bytesMatchDeclaredType`, `classifyScan`, `describeAttachmentsForMessage`.
- Navegador: `npm run build:attach` genera `apps/pwa/attach.js`; `mountAttachMenu({ host, profile, uploadUrl, headers })`. La cámara exige HTTPS o `localhost`.
- Endpoint de Janus: `POST /api/attachments` (solo Founder) y `GET /api/attachments/:id`.
- Pruebas: `tests/chat-attachments.test.ts`, `tests/attachments-endpoint.test.ts`; navegador real con cámara simulada: `node scripts/attach-smoke.mjs`.

## Límites honestos
- iPhone Safari real **no probado** (la prueba usa Chromium con cámara simulada y un QR real).
- HEIC se admite como tipo pero no se convierte ni se previsualiza.
- Sin OCR ni recorte de documentos; sin análisis antivirus (se bloquean tipos, no se escanea malware).
- Google Drive solo a través del selector del sistema.
