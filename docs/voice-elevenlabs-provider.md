## VIGENTE — 18 noviembre 2026 · dos voces del mismo Janus

Orden directa del Founder: **masculina = su clon Jean ya existente en ElevenLabs; femenina = la misma voz de Melanie**. Se verificó el clon propio con categoría `cloned`, género masculino y acento colombiano, y se leyó la configuración TTS del agente Melanie existente. No se creó otra voz ni se modificó el agente web.

- Perfiles estables: `janus` y `melanie`, seleccionables en Controles y en el menú A/B. Cambiar NEXO masculino/femenino cambia también el perfil de salida. La sesión PCM activa se reconecta al cambiar de perfil. Las reglas de autoridad y las voces de menores siguen separadas.
- `config/assistant-voices.local.json` (ignorado por Git) o `JANUS_ASSISTANT_VOICES_FILE` contiene los IDs exactos recuperados y los ajustes de Melanie. No incluye API keys ni grabaciones. La configuración privada de esta entrega se conserva por separado para trasladarla a la tablet.
- El perfil privado puede seleccionar `provider=elevenlabs`; `JANUS_TTS_PROVIDER=local` lo anula expresamente. Sin configuración privada ni esa variable, sigue local por defecto. La credencial continúa exclusivamente en `CredentialBroker`/bóveda/entorno privado.
- Se reutiliza **el adaptador existente**, con parámetros por voz y un presupuesto compartido. El runtime aplica por defecto **3000 caracteres/día UTC**; es un límite de uso, no una estimación en euros. La reserva es atómica y persiste en SQLite: cambiar de voz, hacer peticiones simultáneas o reiniciar no reinicia el cupo. Nunca guarda frases/audio/credenciales en el registro de consumo.
- `GET /api/voice/profiles` y `POST /api/voice/speak` requieren Founder; el cliente solo utiliza perfiles autorizados. La salida hablada funciona sin instalar STT; para conversación PCM completa, STT sigue siendo necesario. No se confunde «configurado» con audio real probado.
- El saludo/cambio de pantalla no genera audio de pago automáticamente. «Probar voz», el resumen pedido expresamente y la respuesta a una orden dictada usan el perfil elegido. Las respuestas del Core conservan la autorización del propietario y el respaldo local.
- Identidad exacta de Melanie = **mismo voice_id**, no una voz buscada por nombre ni otra clonación. Su agente usa `eleven_v3_conversational`; el adaptador HTTP TTS de esta entrega conserva `eleven_multilingual_v2` y los valores de estabilidad/similitud/velocidad recuperados. No se promete idéntica prosodia entre motores sin una prueba acústica. El modelo conversacional de Agents no se inserta a ciegas en el endpoint HTTP TTS.
- El diseño vocal C de septiembre y la antigua prioridad femenina se conservan como historia. La instrucción actual activa ambos perfiles y el clon propio masculino; no se reinicia la audición A/B/C ni se elimina aquel audio.

**HECHO:** pruebas de enrutado exacto, presupuesto persistente/concurrente y ruta HTTP real autenticada con TTS local simulado. **PENDIENTE:** credencial en el host de Janus y reproducción con las voces reales en la tablet. Consultar una voz en ElevenLabs no demuestra haberla instalado ni escuchado desde el runtime. No se sintetizó audio de pago durante esta verificación.

Lo que sigue es el registro histórico del 4-nov; prevalece este bloque en cualquier contradicción sobre una sola voz, necesidad de STT para salida o presupuesto solo en memoria.

# Voz de Janus: ElevenLabs como proveedor temporal + camino al clon propio

Fecha: 2026-11-04 · Estado: adaptador, respaldo local, independencia de voz y pruebas **implementados**; activación en producción **PENDIENTE** (necesita clave, `voice_id` y host con whisper.cpp).

## Decisión del Founder (2026-11-04)
La voz clonada de Jean en ElevenLabs sirve **hoy** como voz de Janus (solo Janus; no los chatbots de clientes). Pero hay que clonarla **por medios propios** para no depender del proveedor. ElevenLabs es un puente, no un cimiento (`packages/identity-lego/VOICE_INDEPENDENCE.md` en `feat/identity-lego-voice-face-20261102`, y norma de local-first).

## Hechos verificados (y su fuente)
| Hecho | Fuente |
|---|---|
| El clon alojado **no se puede descargar ni exportar** como archivo; solo se usa por API con tu clave | Centro de ayuda de ElevenLabs, «Can I export my voice clones?» (consultado 2026-11-04) |
| Los términos prohíben usar la **salida** de ElevenLabs como datos para entrenar modelos que compitan con ellos | Resumen de terceros (terms.law, términos «de marzo de 2026»). **POR CONFIRMAR** con el texto oficial; hasta entonces se aplica la prohibición por prudencia |
| Streaming TTS: `POST /v1/text-to-speech/{voice_id}/stream?output_format=pcm_24000`, cabecera `xi-api-key` | Documentación oficial de la API de ElevenLabs (consultada en la sesión del 2026-11-04) |
| `enable_logging` está activo por defecto; desactivarlo exige un plan con retención cero (Enterprise) | Documentación oficial (misma consulta) |
| Existe `GET /v1/voices/{voice_id}/samples/{sample_id}/audio`; la documentación no aclara si devuelve la muestra original subida | Documentación oficial. **POR CONFIRMAR** antes de apoyarse en ello |

**Consecuencia (INFERENCIA, derivada de lo anterior):** lo único portable son **tus grabaciones originales**. El clon propio se construye con ellas sobre el motor local (Qwen3-TTS, modo `voice_clone`, ya soportado por `sidecars/qwen3_tts_server.py`), **nunca** con audio generado por ElevenLabs.

## Qué se implementó
| Pieza | Archivo | Para qué |
|---|---|---|
| Adaptador de nube | `packages/adapters/src/elevenlabs-tts-adapter.ts` | PCM 24 kHz en streaming; clave solo vía `CredentialBroker` (servicio `elevenlabs`); **solo** los `voiceId` de Janus mapeados salen a la nube; tope por petición y presupuesto diario de caracteres |
| Respaldo nube → local | `packages/voice/src/fallback-tts-gateway.ts` | Si el proveedor falla antes del primer audio, la misma frase se sirve en local; enfriamiento de 60 s; nunca mezcla dos voces en una frase |
| Independencia | `packages/voice/src/voice-independence.ts`, `npm run voice:independence`, `config/voice-corpus.example.json` | Evalúa si el corpus de grabaciones originales basta para el clon local; **rechaza** audio de proveedor; 5 compuertas para retirar al proveedor |
| Cableado | `apps/runtime/server.ts` | `JANUS_TTS_PROVIDER=elevenlabs` activa la nube con la voz local como respaldo; `/health` muestra proveedor, enfriamiento y caracteres usados |

## Reglas de seguridad aplicadas
1. **Local por defecto.** Sin `JANUS_TTS_PROVIDER=elevenlabs` nada sale a la nube. Janus arranca y funciona sin `ELEVENLABS_API_KEY`.
2. **Mapeo explícito.** Solo `JANUS_VOICE_ID` se mapea a `JANUS_ELEVENLABS_VOICE_ID`. Cualquier otro identificador (perfil de la niña, perfiles restringidos) falla con `voice_not_mapped` **antes** de salir y lo atiende la voz local. Un menor nunca usa TTS en la nube (ADR-009 regla 7 y `identity-policy.ts`, ambos en ramas del otro agente aún sin fusionar: `claude/likeness-voice-clone-standby`, `feature/voice-identity-consent-20261102`).
3. **Nube → local, nunca al revés.** No hay respaldo hacia la nube sin permiso explícito.
4. **Texto hablado = dato enviado a un tercero.** ElevenLabs recibe el texto de cada frase (proveedor en EE. UU. salvo que se use un `baseUrl` con residencia UE, p. ej. `api.eu.residency.elevenlabs.io`, aceptado por el adaptador). Con `enable_logging` por defecto, **conserva historial**. Por eso solo se envía el resumen hablado seguro (`safeSpokenRunSummary`), no datos de la ficha familiar ni secretos.
5. **Voz sintética no es evidencia de presencia ni autenticación** (ADR-009 r.7, ADR-011). Que suene como Jean no autoriza nada: las acciones privilegiadas siguen exigiendo autoridad autenticada.
6. **Gasto acotado** (norma 7): `JANUS_ELEVENLABS_MAX_CHARS` (por frase) y `JANUS_ELEVENLABS_DAILY_CHARS` (por día UTC, en memoria: se reinicia si el motor se reinicia). Precio del plan en euros: **POR CONFIRMAR**.

## Activar ElevenLabs (cuando el Founder lo ordene)
1. Poner `ELEVENLABS_API_KEY` en el gestor de secretos / `.env.local` (nunca en Git ni en chat).
2. `JANUS_TTS_PROVIDER=elevenlabs`, `JANUS_ELEVENLABS_VOICE_ID=<voice_id de «Jean»>` y `JANUS_VOICE_ID=<id de Janus>`. El mismo `JANUS_VOICE_ID` debe existir en `config/voices.local.json` para que el respaldo local pueda hablar.
3. `npm run integrations:check` y `/health` → `voice.streaming.tts` debe decir `elevenlabs-with-fallback`.
4. Hace falta whisper.cpp (`JANUS_STT_BASE_URL`) para la conversación completa; sin él, la voz de salida no se activa.

## Camino al clon propio (independencia)
1. **Recuperar o grabar originales de Jean:** 1–3 min, sala silenciosa, sin música ni eco, con transcripción exacta. Si aún tienes las muestras con las que clonaste en ElevenLabs (nota de voz del teléfono), esas valen: **son tuyas**. Si no, se vuelven a grabar. (No se usa audio que *genere* ElevenLabs.)
2. Guardarlas en `voices/private/` (ignorado por Git, fuera de SQLite) y rellenar **solo metadatos** en `voices/private/corpus.json` (plantilla: `config/voice-corpus.example.json`). `npm run voice:independence` dice si bastan.
3. Declarar una voz `voice_clone` en `config/voices.local.json` (`ref_audio` + `ref_text`) y descargar el modelo Base de Qwen3-TTS (ver `docs/voice-local-runtime.md`).
4. **Comparativa** local vs. nube con grabaciones independientes (calidad, latencia, CPU/RAM, coste) y prueba con el acceso externo bloqueado.
5. **Compuertas para retirar al proveedor** (`evaluateProviderRetirement`): síntesis local verificada sin red · flujo completo sin clave · consentimiento/revocación/aislamiento verificados · comparativa registrada · **aceptación del Founder**. Hasta entonces, no se da de baja nada.

## Límites honestos
- No se ejecutó audio real contra la API desde el código en esta sesión (sin clave en el entorno): las pruebas usan `fetch` simulado. Lo único real fue la muestra generada con el conector de ElevenLabs (2 tomas de ~28 créditos, autorizadas por el Founder).
- El formato `pcm_24000` y los nombres de modelo (`eleven_multilingual_v2`, `eleven_flash_v2_5`) son configurables; validar en el primer arranque real y en el reproductor del iPhone (la PWA recibe 24 kHz mono s16le por fragmento).
- Los umbrales de segundos del corpus (10 s mínimo, 60 s recomendado) son **criterio operativo de Janus**, no requisitos del motor.
- Sin host con whisper.cpp no hay conversación por voz completa.
