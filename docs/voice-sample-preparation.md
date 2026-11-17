# Preparar una muestra de voz original para Janus — local-first

**Estado:** herramienta de preparación reproducible, no clonación ni despliegue.

La voz de Janus ya dispone de los adaptadores TTS local y ElevenLabs y del evaluador de independencia (`docs/voice-local-runtime.md` y `docs/voice-elevenlabs-provider.md`). No hay que duplicar el adaptador. Este script cubre el paso previo: convertir una grabación original del propietario en una referencia PCM, conservando prueba de origen y **sin subirla a ningún proveedor**.

## Uso

1. Conservar el audio original en una carpeta privada, fuera de Git. Identificar los segundos exactos del tramo hablado con el consentimiento del titular, excluyendo golpes, instrucciones leídas y otras voces.
2. Desde la raíz de `janus-core`, con `ffmpeg` y `ffprobe` instalados:

   ```bash
   npm run voice:sample -- --input="/ruta/privada/original.m4a" --output="/ruta/privada/jean_ref.wav" --start=18.5 --end=113
   ```

3. Escuchar el resultado completo y corregir las marcas de recorte si hay frases incompletas. Guardar aparte una transcripción **literal y validada** que coincida con el fragmento seleccionado. El programa no genera ni afirma que tenga esa transcripción.
4. El programa crea `.wav` y `.wav.manifest.json` locales: fuente y salida SHA-256, recorte exacto, formato y transformación. No contiene audio sintético ni graba secretos. Mover la referencia aprobada a `voices/private/` (ignorado por Git) y seguir `docs/voice-local-runtime.md` para la voz Qwen Base.

## Parámetros y garantías

- `--input`, `--output`, `--start` y `--end` son obligatorios; números en segundos. Recorte válido de 10 a 180 segundos dentro de la duración real de la grabación.
- El resultado es WAV sin pérdida, PCM s16le mono a 24 kHz. Se aplica solamente filtro pasa-altos 70 Hz, pasa-bajos 11 kHz y fundidos de borde cortos; sin eliminación agresiva de ruido, normalización ni modificación de tono.
- No sobrescribe el original ni archivos de salida preexistentes. Rechaza URL remotas. Necesita únicamente herramientas locales; no usa cuentas, tokens ni red.
- El manifiesto describe la **preparación**, no certifica que la voz sea del titular ni que el archivo esté listo para entrenamiento. Consentimiento, contenido, limpieza audible y transcripción exacta requieren revisión humana.
- No usar audio sintetizado por ElevenLabs como entrenamiento del motor local. El activo portable es la grabación real original.
- `npm run voice:sample:test` ejecuta los ensayos aislados del preparador; también forman parte de `npm test`.

## Integración opcional de voz temporal en Janus

Si el titular aprueba una voz clonada concreta después de escucharla, poner su ID de ElevenLabs en `JANUS_ELEVENLABS_VOICE_ID` **solo en la configuración privada del host**; nunca fijarlo en código público. Mantener `JANUS_TTS_PROVIDER=local` salvo autorización de nube y mantener el mapeo del adaptador, control de gasto, CredentialBroker y respaldo local ya existentes. Esta preparación por sí sola **no activa** una voz ni prueba el iPhone físico.

## Validación pendiente en un host real

Audio/reference SHA-256 del corpus privado; transcripción revisada; confirmación por voz del titular; modelo Qwen Base en disco; `voice:independence`; arranque físico; ciclo de voz PWA desde iPhone; prueba sin conexión. No declarar la función finalizada ni desplegada hasta medir esas compuertas.
