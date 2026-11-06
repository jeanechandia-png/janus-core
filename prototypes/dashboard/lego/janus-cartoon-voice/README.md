# JANUS Cartoon Voice — LEGO compartido para Kendra

## Decisión vigente · 2026-11-06
**Una sola identidad de voz caricaturesca para todas las criaturas.** Lumi, Bombo, Musgo y Nimbo mantienen gestos, personalidad, respuestas, nombres y muestras de texto propios, pero **comparten el mismo timbre/preset de voz**. No se deben contratar ni generar cuatro voces distintas. Una variación individual futura requeriría una decisión posterior del Founder.

**Nunca usar la voz de JANUS/Nexo, una voz clonada del Founder o de una persona real como identidad vocal de estas criaturas.** El módulo es un LEGO independiente del runtime vocal de Janus.

## Implementación
- `JanusCartoonVoice.sharedVoice.voiceId = "cartoon-shared-v1"` fija una identidad para todas las especies.
- `profile(creatureId, style, mood)` conserva el ID para sincronizar gestos y frases, pero usa el mismo preset vocal base. Las emociones pueden modificar temporalmente prosodia, **no elegir otra voz**.
- `voiceFor` escoge la misma voz española para cualquiera de las criaturas y prioriza una voz local del sistema operativo, cuando exista.
- `ST.comp.voiceStyle` conserva **un estilo común**, con migración no destructiva desde el valor previo de `voiceStyles[creatureId]` cuando falta el campo nuevo. Los valores históricos no se borran.
- `setAdapter({speak, stop})` mantiene el punto de integración para un único motor TTS local especializado. El adaptador recibe `profile.voiceId` y no debe asignar voces por especie.
- Silenciar, escuchar una muestra, texto visible, gestos y callbacks se conservan.

## Diferenciar caricatura real de aproximación del navegador
El proveedor actual es **Web Speech del navegador** con voz española y modulación de velocidad y tono: **aproximación caricaturesca**, no una voz neuronal/cartoon auténtica ni garantía de timbre no humano. Una voz de caricatura claramente no humana necesita un **activo o modelo TTS especializado**, la aprobación auditiva correspondiente y una prueba en Safari/iPhone. **No declarar cumplido el criterio de voz auténticamente no humana** hasta esa validación. No gastar en otro proveedor por defecto.

Para no depender de cuotas ajenas ni enviar contenido infantil inadvertidamente, el navegador **solo puede seleccionar una voz en español marcada explícitamente `localService === true`**. Si no existe, el motor devuelve `local-voice-unavailable` y conserva el texto sin lanzar audio. El módulo infantil solo acepta adaptadores declarados `localOnly: true`; la marca es un contrato técnico y necesita verificación del adaptador en el host, no una garantía criptográfica. Los proveedores externos deben pasar por el control de autorización y créditos del JANUS CORE, nunca por este componente del navegador.

La voz seleccionada por el navegador puede variar entre dispositivos, porque Janus no controla las voces instaladas del sistema; algunos navegadores pueden no declarar correctamente el atributo `localService`. No se almacenan grabaciones infantiles, no se copian claves al navegador y el LEGO no hace llamadas de red por cuenta propia. **No se ha probado calidad auditiva de voz de caricatura auténtica en iPhone**.

## Pruebas y continuidad
`node --test prototypes/dashboard/tests/kendra-cartoon-voice.test.cjs` cubre voz única, timbre y preset constantes, emociones, callbacks, limpieza, silencio, fallback, aislamiento del Founder y persistencia de estilo compartido. El pipeline de criaturas mantiene los builds de dashboards A/B sin sustituir diseños ni activos aprobados.

**Histórico (no vigente):** la primera implementación asignaba cuatro presets de pitch/rate/voz y estilos por especie. Se preserva su código anterior en el historial Git, pero **queda sustituido** por la decisión posterior de una voz compartida.

### Regla de coste heredada (2026-11-06)

Desarrollar y validar motor TTS propio/local y voz caricaturesca compartida antes de contemplar proveedores por créditos. Los modelos de pago nunca se activan por detectar una clave y no hay fallback automático desde el módulo infantil. Se conserva el texto siempre como salida segura.
