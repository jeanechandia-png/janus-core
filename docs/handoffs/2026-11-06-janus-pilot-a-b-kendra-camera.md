# Handoff JANUS — 2026-11-06 — Piloto Obsidiana / Platino / Kendra + cámara local

Proyecto/repo canónico: `jeanechandia-png/janus-core` (no crear copias).
Estado: **PILOTO TÉCNICO QA VERIFICADO, NO PRODUCCIÓN**. PR #77 draft, base #75; sin fusionar a main.
Último código verificado: `d2bb416ea992f0278da2aa4bd2d8f0f4d29d7c0d`.
Norma: JANUS CORE autoridad, propio/local/gratuito primero; no créditos, compras ni proveedores externos. No cambiar dashboards ni criaturas aprobadas.

## AHORA / HECHO
1. Se reutilizan ambas pieles del dashboard: A Obsidiana, B Platino; HTML autoincluido sin dependencia de red para la interfaz. Cámara Founder visible en ambos.
2. Tercera salida independiente `node prototypes/dashboard/build.cjs --skin b --profile kendra` → `prototypes/dashboard/dist/Janus-Kendra-Piloto.html`. Navegación fijada a compañero infantil; no renderiza widgets del Founder. Su almacenamiento propio usa `janus.preview.kendra.v1` en lugar de la clave del Founder. No consulta automáticamente FinOps del Founder ni clima remoto. Solo demos/datos ejemplo.
3. LEGO `janus-pilot-camera` compartido: permiso de cámara por gesto, vídeo sin audio, captura JPEG local, guardado manual, eliminación y cierre de stream; `founder` y `kendra` con sesiones independientes. Nunca sube la foto ni la adjunta a la cola global de mensajes. `file://` puede bloquear `getUserMedia`; ruta HTTPS de QA aislada y alternativa `<input capture>`.
4. `JanusChildSafety.assess(msg)` se ejecuta en el handler real de mensajes del compañero infantil, antes de una respuesta ordinaria; aviso local para adulto en temas urgentes/acoso, sin registrar texto sensible íntegro. NO hay alertas externas ni supervisión remota.
5. Vista técnica QA en rama `gh-pages` bajo `qa/janus-pilot-2026-11-06/`: `index.html`, `obsidiana.html`, `platino.html`, `kendra.html`. GitHub Actions confirma publicación del archivo en git; apertura física en Safari aún pendiente. Nunca insertar datos reales en esa ruta pública.
6. Tests verificados en SHA anterior:
   - Janus Core CI `42291344305`: success.
   - JANUS creatures + A/B/Kendra Chromium E2E `42291344299`: success, logs contienen:
     `PASS A-Obsidiana · Founder camera, Kendra camera, safety alert`;
     `PASS B-Platino · Founder camera, Kendra camera, safety alert`;
     `PASS Kendra-only · no Founder UI, own storage, own camera, local child safety`.
   - Publicación de QA `42291336522`: success.
   - E2E se ejecutó con cámara simulada de Chromium; **no** es ensayo de hardware real.
7. Entregables QA GitHub Actions: HTML A/B/Kendra (`janus-creatures-a-b-offline`, artifact 13540171668), capturas (`janus-kendra-mobile-a-b-screens`, artifact 13540830046). ZIP de los tres HTML descargado en conversación SHA256 `4a2d64641451828df2bf868ee7f9485ff980b13e482a7f5a664ef753843df742`.

## PENDIENTE / BLOQUEADO
- Confirmar físicamente Safari/iPhone: permiso de cámara en HTTPS, captura, cambio de app, guardado, cierre, rendimiento y uso offline.
- Autenticación y aislamiento real de cuentas Founder/Kendra del lado servidor, así como notificaciones al tutor, requieren otro gate antes de piloto privado con datos reales. Separar HTML/localStorage **no equivale a control de acceso**.
- Arte GLB hiperrealista aprobado 0/4; se usa arte ilustrado aprobado como fallback honesto. La voz genuinamente caricaturesca no humana propia sigue pendiente de prueba auditiva.
- Las dashboards son previsualizaciones con ejemplos; el chat visual aún requiere verificar conexión productiva a JANUS CORE local, no declarar autonomía total.
- PR #76 local-first/gasto deshabilitado está en rama distinta; **NO** mezclar ciegamente los archivos de política 7 vs 19 registros de ramas. Integrar cronológicamente, retener las referencias y comprobar regresiones.
- PR #77 mantiene las dependencias #75→#71→#70→#69→#67→#63→#53→#43; verificar integración total sin forks.
- Landing/web principal no modificadas ni desplegadas. No hacer release sin pruebas de privacidad y arte aceptado.

## PRÓXIMO
Validar piloto desde iPhone real por HTTPS, confirmar acceso seguro y cómputo local, revisar imágenes aprobadas y 3D; reconciliar pila con main preservando registros actuales. La versión anterior pasa a HISTÓRICO cuando se acepte una nueva.
