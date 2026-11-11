# janus-interpreter · pantalla del intérprete (LEGO 1.0.0-pilot)

Pareja de interfaz de `packages/modules/contextual-interpreter`. Dos botones grandes — **«Yo hablo»** y **«Habla la otra parte»** —,
traducción en letra grande, lectura en voz alta en el otro idioma, aviso de números a confirmar y acta descargable.

```js
JanusInterpreter.open({
  endpoint: '/api/cases/ID/interpret',      // o '/api/interpreter/turn' sin caso
  noticeEndpoint: '/api/interpreter/notice',
  headers: () => ({ 'content-type': 'application/json', authorization: 'Bearer …' }),
  title: 'Llamada', clientLang: 'es', otherLang: 'nl', counterpartRole: 'police officer',
  clientName: 'Nombre', labels: { client: 'Yo', other: 'Agente' },
});
```
Reutilizable tal cual en Infinity Connect (cambiando idiomas, etiquetas y endpoint).
