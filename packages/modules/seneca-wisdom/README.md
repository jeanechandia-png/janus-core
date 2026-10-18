# seneca-wisdom (LEGO module)

Séneca como conocimiento reutilizable para gestión del estrés: vida, obra, doctrina, citas verificadas y ejercicios prácticos.

**Es una pieza independiente.** No importa nada de Janus ni de ningún otro paquete; no usa red ni secretos. Cualquier producto (Janus, IBA, Infinity ChatBox…) puede copiar o importar esta carpeta y envolverla con un adaptador fino.

## Uso

```ts
import { selectGuidance, dailyReflection, getProfile } from './src/index.js';

const g = selectGuidance('Estoy agobiado pensando en lo que pasará mañana');
g.reply;            // texto en español listo para enviar
g.quotes;           // citas con status de verificación
dailyReflection();  // idea + ejercicio del día (rotación determinista)
getProfile('life'); // 'overview' | 'life' | 'works' | 'doctrine' | 'modern_psychology' | 'limits'
```

## Reglas de verdad (Protocolo de la Verdad)

| Estado | Significado |
|---|---|
| `verified-primary` | Texto latino y localización leídos en edición de fuente primaria. |
| `locus-unverified` | Sentencia clásica de Séneca; localización no re-verificada. |
| `attributed-unlocated` | Circula como suya pero no se localizó el pasaje. **No presentar como cita literal.** |

La frase «Para ser feliz debes liberarte de dos cosas: el miedo a un mal futuro y el recuerdo de un mal pasado» está en estado `attributed-unlocated`. Su idea es coherente con Ep. 5.7–9 y 13.4–5 (verificadas).

## Seguridad

Si el texto del usuario contiene lenguaje de autolesión/suicidio, `selectGuidance` devuelve `mode: 'support_first'` sin citas ni ejercicios. El módulo no diagnostica ni sustituye a un profesional.

## Pruebas

`tests/lego-seneca-wisdom.test.ts` y `tests/lego-module-boundaries.test.ts` (que falla si el módulo importa algo externo).
