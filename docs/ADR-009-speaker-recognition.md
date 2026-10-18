# ADR-009 — Reconocimiento de hablante (comodidad, no autoridad)

Estado: propuesto en rama `claude/seneca-voice-lego`.

## Decisión
1. El reconocimiento de voz es una **pista de conveniencia** (`assurance: 'convenience'`). Nunca autentica ni autoriza: la voz se puede clonar o reproducir y no hay prueba de vida. Las acciones privilegiadas siguen exigiendo la autoridad del Founder (ADR-005/006/007/008).
2. Datos biométricos (RGPD art. 9): consentimiento explícito y registrado; para menores, otorgado por padre/tutor distinto del menor. Finalidades limitadas a personalización y enrutado de contexto. Revocable y borrable (`--revoke`, `--forget`).
3. Minimización: solo se guardan vectores (no audio) en una bóveda cifrada AES-256-GCM; la clave vive fuera de SQLite y del código (`JANUS_SPEAKER_VAULT_KEY`). La auditoría registra decisión, perfil y puntuación; nunca embeddings.
4. Perfil restringido: si la voz coincide con un miembro del hogar que no es el propietario (p. ej. Kendra), la ejecución arranca con un Blueprint reducido a `seneca` (herramientas seguras para el hogar). Voz desconocida/ambigua mantiene el comportamiento actual (sin privilegios por voz).
5. Modelo conectable: sidecar loopback (SpeechBrain ECAPA) detrás de `SpeakerEmbedder`; reemplazable.

## POR CONFIRMAR
- Umbral y margen no están calibrados con voces reales; el sidecar no se ha ejecutado en este entorno.
- La inscripción requiere muestras reales de Jean y Kendra en el host (`scripts/voice-enroll.ts`).
