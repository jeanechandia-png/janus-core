# speaker-id (LEGO module)

Reconocimiento de hablante **local** para reconocer a miembros autorizados de un hogar o equipo (p. ej. Jean y Kendra) y **personalizar** la respuesta o elegir el contexto (personal/familiar).

**Es una pieza independiente.** No importa nada de Janus; solo APIs de Node y sus propios archivos. Cualquier producto puede usarla con un adaptador fino.

## Qué NO es

* **No es autenticación.** La voz puede clonarse o reproducirse y este módulo no tiene detección de vida. Todo resultado lleva `authorizes: false` y `assurance: 'convenience'`. Las acciones sensibles siguen exigiendo los factores fuertes del producto anfitrión (en Janus: ADR-005/006/007/008).
* **No identifica desconocidos.** Es de conjunto cerrado: solo compara con personas que dieron consentimiento y rechaza al resto como `unknown`.

## Datos y consentimiento (datos biométricos = categoría especial del RGPD)

* Las huellas de voz solo existen dentro de una bóveda **AES-256-GCM**; la clave de 32 bytes la aporta el anfitrión desde su almacén de secretos (nunca en código, SQLite, logs ni prompts).
* Solo se guarda el **centroide** de la huella. No se conservan las grabaciones ni los vectores por muestra.
* Todo registro exige un **consentimiento activo**. Un menor requiere el consentimiento de **madre/padre o tutor legal** (distinto del menor). Finalidades limitadas: `personalization` y `context_routing`.
* Retirar el consentimiento borra la huella; `forget()` borra al sujeto. La auditoría registra consentimiento, alta y borrado, **no** cada identificación.
* La grabación se procesa en un sidecar en **loopback**; los endpoints remotos se rechazan salvo `allowRemote` explícito.

> Esto es ingeniería de privacidad, no asesoría legal. Un tratamiento puramente doméstico/personal puede quedar fuera del RGPD (art. 2.2.c), pero si el producto anfitrión lo usa en un contexto profesional, conviene revisar base jurídica y evaluación de impacto.

## Uso

```ts
import { EncryptedVault, FileVaultStorage, HttpSpeakerEmbedder, SpeakerIdentifier, parseVaultKey } from './src/index.js';

const vault = new EncryptedVault(new FileVaultStorage('data/voiceprints.vault'), parseVaultKey(process.env.JANUS_VOICEPRINT_KEY));
const id = new SpeakerIdentifier({ embedder: new HttpSpeakerEmbedder({ baseUrl: 'http://127.0.0.1:8791' }), vault });

await id.grantConsent({ subject: { id: 'kendra', displayName: 'Kendra', role: 'household_minor' },
  grantedBy: { id: 'jean', displayName: 'Jean', relation: 'parent' }, purposes: ['personalization'],
  statement: 'Como padre y tutor legal autorizo el reconocimiento y almacenamiento local de la voz de Kendra.' });
await id.enroll('kendra', [pcm1, pcm2, pcm3]);       // PCM16 mono 16 kHz
const r = await id.identify(utterancePcm);           // { decision: 'match' | 'ambiguous' | 'unknown' | 'insufficient_audio', ... }
```

## Calibración (obligatoria antes de confiar)

Los umbrales de `SpeakerPolicy` son valores coseno **dependientes del modelo**. El informe de alta (`minPairSimilarity`, `meanPairSimilarity`) sirve para calibrarlos con grabaciones reales. El sidecar `sidecar/speaker_embed_server.py` está escrito pero **no se ejecutó** donde se creó este módulo (sin pesos de modelo).

## Pruebas

`tests/lego-speaker-id.test.ts` (con un extractor sintético) y `tests/lego-module-boundaries.test.ts`.
