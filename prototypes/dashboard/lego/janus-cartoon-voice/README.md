# JANUS Cartoon Voice · LEGO Kendra

Módulo **local-first y reemplazable** que proporciona cuatro voces de personaje basadas en síntesis de voz del navegador, independientes de la voz de **JANUS Nexo**.

## Identidades y tonos

| Criatura | Voz caricaturesca | Pitch nativo | Rate nativo |
|---|---|---:|---:|
| Lumi | Hada aguda y chispeante | 1,72 | 1,12 |
| Bombo | Ajolote burbujeante y saltarín | 1,44 | 1,24 |
| Musgo | Duendecillo grave y bromista | 0,77 | 0,91 |
| Nimbo | Nube suave y soñadora | 1,27 | 0,90 |

Cada criatura admite los estilos `caricatura`, `traviesa`, `dulce` y `teatral` con modulación por estado emocional; valores acotados para evitar distorsiones extremas. Los valores indican la **prosodia**, no un timbre grabado de estudio. El motor no imita voces reales ni clona voces humanas.

## Integración de código

```js
const cartoon = window.JanusCartoonVoice;
cartoon.speak('¡Hola, Kendra!', 'bombo', {
  style: 'traviesa', mood: 'alegre', enabled: true,
  onStart: () => JanusEdgeCompanion.react('habla', 1.5, 'alegre')
});
cartoon.preview('musgo', { style: 'caricatura', force: true });
cartoon.stop();
```

`prototypes/dashboard/src/companero.js` conserva `ST.comp.voiceStyles[creatureId]` y `ST.comp.voiceEnabled` para aislar la selección de cada criatura y el control general de sonido. La pestaña «Hablar» permite elegir estilo, escuchar muestras y silenciar. La selección de Nexo masculino/femenino usa `ST.settings.nexoVariant`, **separado** de cualquier voz o dato de Kendra.

La voz disponible procede del sistema operativo/navegador y se priorizan voces `es-*` con `localService === true`. Algunas voces pueden depender del fabricante de dispositivo: el código del LEGO no abre conexiones ni manda datos deliberadamente a la red, pero **no puede garantizar trabajo 100% offline** si el sistema selecciona una voz remota. Cuando SpeechSynthesis falla, los mensajes permanecen legibles y utilizables.

### Motor reemplazable

```js
JanusCartoonVoice.setAdapter({
  speak({text,id,profile,onStart,onEnd}) { /* TTS local/neuronal futuro */ },
  stop() { /* cancelar el audio de esa sesión */ }
});
```

Este contrato permitirá conectar en el futuro un motor de TTS neuronal local con voces realmente de dibujos animados, sin modificar perfiles, pantallas ni economía; los secretos nunca se almacenan en SQLite ni en el navegador.

## Pruebas

`tests/kendra-cartoon-voice.test.cjs` valida cuatro voces diferenciadas, español local preferido, emociones, silenciamiento, prueba voluntaria, cancelación sin solapamiento, limpieza de texto, degradación sin TTS y separación de Nexo. Se ejecuta en `.github/workflows/janus-creatures-ci.yml`, junto al build A/B offline.

## Límites actuales

- **Hecho:** diferenciación vocal audible mediante controles nativos de velocidad y tono, botón de prueba, persistencia por especie, animación facial vinculada al inicio de TTS.
- **Por confirmar:** timbre real en Safari/iOS con voces instaladas, latencia y continuidad al re-renderizar en dispositivos físicos.
- **Pendiente:** cuatro voces **neurales** caricaturescas de calidad estudio, con diseño de personajes y control de prosodia/timbre. No afirmar que el motor del navegador alcanza calidad cinematográfica.
- **Pendiente gráfico independiente:** importar GLB masculino/femenino finales de Nexo aprobados con mallas/expresiones VFX, sin confundir cuerpos procedurales actuales con los renders definitivos.
