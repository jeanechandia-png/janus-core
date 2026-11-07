# JANUS Pilot Camera — LEGO reutilizable local-first (2026-11-06)

Una única pieza modular `janus-pilot-camera.js` + `janus-pilot-camera.css`. Se incluye dentro de los **dos builds vigentes A Obsidiana / B Platino** sin modificar las criaturas ni sustituir arte aprobado.

## Integración real
- Founder: botón discreto **📷 Cámara** en A/B, visible salvo dentro de Kendra.
- Kendra: botón independiente **📷 Mi cámara** en la pestaña Compañero, ambas pieles.
- `JanusPilotCamera.open('founder'|'kendra')` abre una **sesión nueva aislada**. `close()` apaga pistas y revoca URLs.
- Captura de vídeo solo por permiso explícito del navegador, sin micrófono; alternativa `input type=file capture=environment` para dispositivos que bloquean cámara en vivo.
- Imagen JPEG recomprimida (máx. 1440 píxeles lado mayor), memoria efímera y **descarga manual**. No se guarda automáticamente en IndexedDB, localStorage, chat, galerías o servidores.
- No usa servicios terceros, modelos de imagen, créditos, reconocimiento facial ni biometría. No reutiliza la cola de adjuntos `JanusAttach`: no mezclar fotografías entre la cuenta Founder y el espacio infantil.
- Cierre automático del flujo al cambiar de ruta o salir de la página. Detiene vídeo si la página pasa a segundo plano.
- La garantía es **del código de esta pieza**. El navegador/sistema operativo puede aplicar sus propias políticas y permisos.

## Revisión infantil
Para Kendra hay aviso claro de privacidad y de pedir asistencia a un adulto para guardar. El módulo **no** autoriza publicar/enviar una fotografía a modelos ni otras cuentas. No es videollamada, identificación facial, monitoreo ni intercambio de imágenes.

El chat infantil ahora evalúa `JanusChildSafety.assess(msg)` antes de responder, con indicaciones no diagnósticas y aviso **local** al panel Papá para incidentes importantes. **No hay notificación enviada al teléfono del Founder**: antes la interfaz insinuaba lo contrario y fue corregida. Los textos sensibles completos no se guardan en los avisos.

## Probar
```bash
cd prototypes/dashboard
node --test tests/pilot-camera.test.cjs
node build.cjs
node build.cjs --skin b
PLAYWRIGHT_MODULE=../../node_modules/playwright node tests/e2e-pilot-camera.cjs
```

Las pruebas web usan una cámara **simulada**, no sustituyen prueba física de iPhone/Safari. En `file://` y vistas embebidas la cámara en vivo puede no estar disponible; para el piloto usar HTTPS aislado.

## Estado / criterios antes de aceptar piloto real
- CÓDIGO INTEGRADO en PR #77: botón Founder, Kendra, interfaz, prueba de captura aislada, guard de menores.
- CI: verificar ejecución del HEAD antes de afirmar aprobado.
- PENDIENTE: iPhone físico (permisos, vídeo, fotos, fallback, cerrar/reabrir, ahorro de energía, iOS), aislamiento de perfiles del lado servidor y autenticación real.
- PENDIENTE de identidad visual final: GLB hiperrealistas aprobados 0/4; modo artístico ilustrado de respaldo es **piloto técnico**, nunca 3D definitivo.
- PENDIENTE: TTS local realmente caricaturesco (Web Speech modulado solo aproximación). Voz humana/clon no se usará como sustitución no aprobada.
- PENDIENTE: incorporar el Model/Tool Gateway CORE productivo en el chat visual (el actual depende de adaptadores de demostración/externos). Sin conexión, el resto de controles deterministas no debe caer.

El prototipo QA usa únicamente **datos de ejemplo** y es un entorno de revisión, **no una cuenta privada para datos reales**. No publicarlo como producto completo.
