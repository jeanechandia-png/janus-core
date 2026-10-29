# stoicism-knowledge (LEGO module)

Estoicismo a fondo, para uso personal y de trabajo del Founder en Janus: **los doce libros de las Meditaciones de Marco Aurelio completos**, con resumen y pasajes clave en español, búsqueda en el texto, historia de la escuela, orígenes de la filosofía grecorromana, doctrina, relación con la psicología actual y ejercicios.

**Es una pieza independiente.** No importa nada fuera de su carpeta; sin red, sin secretos, sin dependencias. Hermana de `seneca-wisdom` y `marcus-aurelius-wisdom`, que siguen intactas con sus citas curadas.

## Qué contiene

| Archivo | Contenido |
| --- | --- |
| `src/meditations-text.ts` | Texto completo (525 párrafos, 12 libros) de la traducción inglesa de George Long (1862), edición Standard Ebooks. **Generado**; hash SHA-256 por libro, recomprobado por las pruebas. |
| `src/meditations-digests.ts` | Resumen en español de cada libro, temas y 142 pasajes clave con glosa; cada extracto en inglés es subcadena exacta del párrafo (lo comprueban las pruebas). **Generado**. |
| `src/meditations.ts` | `getBookDigest`, `getPassage`, `searchMeditations` (consulta en español o inglés → párrafos del texto). |
| `src/history.ts` | 18 figuras (de Sócrates a Hadot), fases de la escuela y cronología. |
| `src/origins.ts` | Orígenes grecorromanos: Jonia, Heráclito/Pitágoras, sofistas y Sócrates, Platón y Aristóteles, era helenística, Roma, antigüedad tardía, recepción moderna. |
| `src/doctrine.ts` | 12 temas de doctrina, 8 ejercicios, glosario griego (16 términos). |
| `src/psychology.ts` | Ellis, Beck, paralelos (como inferencia), contrastes, evidencia (preliminar) y límites. |
| `src/provenance.ts` | Procedencia del texto y fuentes consultadas, con qué se tomó (y qué no) de cada una. |
| `src/answer.ts` | Respuestas en español listas para enviar (≤ 2.900 caracteres) y `askStoicism(texto)`, que enruta el texto libre. |

## Uso

```ts
import { askStoicism, bookAnswer, passageAnswer, searchMeditations } from './src/index.js';

askStoicism('Resumen del libro 4 de las Meditaciones').reply;
passageAnswer(9, 31).reply;               // «Look down from above…» (párrafo 31 de la edición)
searchMeditations('muerte', { limit: 3 }); // párrafos con death/die/dying…
askStoicism('Estoicismo y psicología').reply;
```

## Reglas de verdad (Protocolo de la Verdad)

- **Doce libros** (nunca «tomos»). La numeración de párrafos es la **posición dentro de la edición**, no necesariamente la numeración estándar libro.sección (la edición separa los versos citados como párrafos propios).
- **Traducción:** el texto es la versión inglesa de Long; el griego no se consultó. Los resúmenes y glosas en español son **interpretación**, no traducción.
- Cada dato lleva su base: `verified-source` (contrastado en la fuente citada), `consensus-unverified` (estándar, no recomprobado), `inference` (paralelo propuesto aquí) o `unverified` (NO VERIFICADO). Las fechas de personas son de consenso salvo que se indique.
- **Psicología:** siempre «sí, hay un vínculo de inspiración»; nunca «directo» ni «profundo»; no es lo mismo que la TCC ni su origen; es una filosofía de vida, no una terapia; Janus no es terapeuta; ante dificultades reales, un profesional. La evidencia de programas basados en estoicismo se informa como preliminar (NO VERIFICADO como eficacia clínica).
- **Crisis:** ante lenguaje de riesgo responde `support_first`, sin citas ni filosofía.
- No es una herramienta clínica.

## Actualizar el texto

1. Clonar el repositorio de Standard Ebooks en el commit indicado en `src/provenance.ts` (o uno nuevo, que se anotará).
2. Regenerar `meditations-text.ts` y `meditations-digests.ts`; actualizar los hashes.
3. Ejecutar `npm test`: la prueba de integridad y la de extractos literales fallarán si algo no coincide.

## Integración en Janus

Adaptador fino: `packages/adapters/src/stoicism-tool-adapter.ts` → herramienta `stoicism` (solo lectura, local). **No** está en la lista de herramientas seguras del hogar (`HOUSEHOLD_SAFE_TOOLS`): es de uso personal. En instalaciones existentes requiere aprobación de Blueprint por el Founder (panel «Aprobaciones»).
