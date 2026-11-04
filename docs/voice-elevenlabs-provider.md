# Voz de Janus: ElevenLabs como proveedor temporal + camino al clon propio

Fecha: 2026-11-04 · Estado: adaptador, respaldo local, inventario y preparación de clonación **implementados**. **LA CLONACIÓN DEL FOUNDER ESTÁ PENDIENTE** tanto en ElevenLabs como en JANUS local. Activación con voz real todavía no verificada (clave, `voice_id`, grabaciones originales, aceptación y host con whisper.cpp).

## Decisión del Founder (2026-11-04)
**Corrección expresa del Founder:** su voz todavía **NO está clonada ni en ElevenLabs ni en JANUS**. Si se crea con ElevenLabs, JANUS podrá usarla después de verificarla. El proveedor es una herramienta temporal de aprendizaje y referencia funcional; el objetivo final es **clonación local desde grabaciones originales autorizadas**, independiente de servicios externos. El hecho de tener cuenta Creator, crédito o un `voice_id` configurado no demuestra que la clonación exista. ElevenLabs es un puente, no un cimiento (`packages/identity-lego/VOICE_INDEPENDENCE.md` en `feat/identity-lego-voice-face-20261102`, y norma de local-first).

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
| Adaptador de nube | `packages/adapters/src/elevenlabs-tts-adapter.ts` | PCM 24 kHz en streaming; clave solo vía `CredentialBroker` (servicio `elevenlabs`); **solo** los `voiceId` de Janus mapeados salen a la nube; tope por petición y presupuesto diario de caracteres. Una voz temporal no se presenta como clon. |
| Inventario y creación controlada | `packages/adapters/src/elevenlabs-voice-management-adapter.ts` | Consulta de voces personales por API, y preparación de IVC con aprobación, hashes originales y no reintento. **No hay acción automática** de clonación ni audio enviado en esta entrega. |
| Estado verificable | `packages/voice/src/voice-clone-lifecycle.ts` | `pending` por defecto; un identificador, una suscripción o un modelo TTS no certifican un clon. Solo prueba de titularidad, síntesis y aceptación permiten marcarlo `verified`. |
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
