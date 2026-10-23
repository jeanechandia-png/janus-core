# ADR-011 — Reconocimiento del hogar por voz y cara (comodidad, no autoridad)

Estado: propuesto en rama `claude/seneca-voice-lego` / `claude/school-gates-continuity`. Sustituye al antiguo nombre «ADR-009-speaker-recognition», renombrado porque el PR #39 ya usa ADR-009 (consentimiento de imagen y clonación) y ADR-010 (restauración de documentos).

## Decisión
1. **Identificar no es autenticar.** Los módulos `speaker-id` (voz) y `face-id` (cara) responden «¿qué miembro del hogar parece ser?» en conjunto cerrado y devuelven siempre `authorizes: false`. Una voz se puede clonar y una foto o pantalla puede engañar a una cámara; no hay prueba de vida en estos módulos. La autenticación del Founder sigue siendo ADR-005/006/007/008 (clave local + Face ID de la plataforma, 1:1, con liveness) y, en su caso, el candidato `voice-identity` (1:1 con anti-suplantación).
2. **Datos biométricos (RGPD/AVG art. 9):** consentimiento explícito y registrado; para menores, otorgado por un padre/tutor distinto del menor; finalidades limitadas a personalización y enrutado de contexto; revocable (`--revoke`) y borrable (`--forget`).
3. **Minimización:** solo el centroide de cada persona, cifrado con AES-256-GCM; nunca audio, fotos ni vectores individuales. Claves distintas para voz y cara (`JANUS_SPEAKER_VAULT_KEY`, `JANUS_FACE_VAULT_KEY`) fuera de SQLite y del código. La auditoría guarda decisión, perfil y puntuación, nunca embeddings.
4. **Fusión conservadora:** `fuseIdentityHints` combina voz y cara; si discrepan, gana el perfil más restringido (menor > adulto del hogar > propietario). Un «propietario» nunca anula un «menor».
5. **Perfil restringido:** si el resultado fusionado es un miembro del hogar que no es el propietario, la ejecución arranca con un Blueprint reducido a herramientas seguras del hogar (`seneca`, `marcus-aurelius`, `janus-school`), y Janus School usa el perfil infantil (sin lecciones del Founder ni guía de padres). Con `JANUS_HOUSEHOLD_STRICT=true`, una voz/cara detectada pero no identificada como propietario también queda restringida. Una orden escrita sin pista de voz/cara no cambia.
6. **Cara bajo demanda, no vigilancia:** la cara se identifica solo cuando un dispositivo con sesión envía una imagen a `POST /api/identity/face?sessionId=…`; la pista vale 5 minutos y solo se guarda si hay coincidencia. No hay captura continua. Requiere sesión autenticada, para no ofrecer un oráculo biométrico anónimo.
7. **Modelos conectables:** sidecars en loopback (SpeechBrain ECAPA para voz; InsightFace para cara), reemplazables tras `SpeakerEmbedder`/`FaceEmbedder`.

## Relación con otras piezas
- ADR-009 (PR #39): *síntesis* de voz/imagen del Founder con consentimiento. Aquí solo *reconocimiento*; son flujos separados.
- ADR-007/008: autenticación del Founder por Face ID (código fuente listo; sin probar aún en el iPhone físico).
- `candidate/voice-identity-module` (rama sin PR): verificación 1:1 con anti-suplantación; complementaria, no duplicada.

## POR CONFIRMAR
- Umbrales no calibrados con voces/caras reales; ningún sidecar se ha ejecutado en este entorno.
- Licencia de los pesos de InsightFace para uso comercial.
- Revisión legal del tratamiento biométrico de una menor (consentimiento paterno ya declarado por Jean).
- La PWA aún no tiene botón de cámara/inscripción: la interfaz aprobada no se altera sin autorización.
- Inscripción: requiere muestras reales de Jean y Kendra en el equipo host (`scripts/voice-enroll.ts`, `scripts/face-enroll.ts`).
