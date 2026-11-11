# contextual-interpreter · intérprete consecutivo con contexto (LEGO 1.0.0-pilot)

Pieza reutilizable de JANUS y base de **Infinity Connect**. Traduce **turno a turno** entre el cliente y la otra parte
(p. ej. un agente de policía) como lo haría un intérprete profesional:

- primera persona, fiel, sin añadir ni quitar, sin consejos ni opiniones;
- registro formal con autoridades (u / usted);
- glosario especializado (policía, justicia, alquiler) y glosario extra por caso;
- **números, fechas, horas, teléfonos y correos se comprueban en código**: si alguno no aparece en la traducción, sale en `confirm` para repetirlo en voz alta;
- si no entiende, devuelve `clarify` (petición de repetir en el idioma del hablante) en lugar de inventar.

No guarda nada, no importa nada de fuera y no lleva datos de ningún caso.

```ts
import { interpretUtterance, openingNotice } from './src/index.js';
const r = await interpretUtterance(modelo, {
  from: 'nl', to: 'es', speaker: 'counterpart', counterpartRole: 'police officer',
  text: 'Kunt u mij vertellen wanneer het incident plaatsvond?',
  brief: expedientePrivado,           // contexto: solo para desambiguar
  history: ultimosTurnos,             // lo guarda el anfitrión
});
// r.translation · r.confirm · r.uncertain · r.clarify
```

Primer montaje: casos privados del Founder en JANUS (prueba piloto / pre-lanzamiento). La voz (micrófono y altavoz) la pone el anfitrión.
