# janus-oraciones · Oraciones en su lengua original

Pieza LEGO v1.0.0 (24 nov 2026, orden del Founder). Es la **fuente única** de los textos. La app de Kendra usa un espejo idéntico en `apps/pwa/approved-3d/janus-oraciones.js`, y la prueba `tests/oraciones.test.cjs` falla si los dos difieren.

## Qué contiene
| Oración | Idiomas | Para quién |
|---|---|---|
| Padre Nuestro | latín, **griego (original escrito, Mt 6, 9-13)**, hebreo (traducción de Delitzsch), español | Founder; Kendra en español, y en latín solo si lo pide |
| Ángel de la Guarda (*Angele Dei*) | latín (original), español | Founder |
| Ángel de mi guarda (versión infantil) | español; latín opcional (*Angele Dei*) | Kendra |
| San Miguel Arcángel | latín (original, León XIII), español | Founder |
| Jesusito de mi vida, Al acostarme, Bendición de la mesa, Ave María | español | Kendra (el Ave María también para el Founder) |

Cada texto en idioma extranjero lleva su **pronunciación** y su **traducción**, y cada texto lleva su fuente.

## Verdad
- El Padre Nuestro se escribió en **griego**. Jesús probablemente lo dijo en **arameo**. El hebreo es una **traducción** del siglo XIX, no el original.
- El *Angele Dei* y la oración a San Miguel se compusieron en **latín**.
- Ningún aparato trae voz latina: se lee con voz italiana, la más parecida a la pronunciación eclesiástica.
- La voz real en la tablet está **sin comprobar**.

## Uso
```js
JanusOraciones.forAudience('founder');                 // lista
JanusOraciones.langsFor('pater', 'kendra', latinOptIn); // ['es'] o ['la','es']
JanusOraciones.speak('pater', 'la', { onEnd });          // false si el aparato no puede
```
