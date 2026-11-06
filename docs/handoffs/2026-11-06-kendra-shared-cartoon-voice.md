# Transferencia JANUS — 2026-11-06 — Una voz caricaturesca para las criaturas

PROYECTO: JANUS CORE, repositorio canónico `jeanechandia-png/janus-core`
RAMA DE TRABAJO: `chatgpt/kendra-one-cartoon-voice-20261106`
BASE VERIFICADA AL INICIO: `chatgpt/kendra-catholic-family-habits-20261106` @ `988806765c7cc256bbcc4ff88dc79ca38ace5a7b`
ESTADO: trabajo integrado en la rama del repositorio real; NO fusionado con producción.

## Cronología, estado y precedencia
1. HISTÓRICO: módulo `janus-cartoon-voice` y panel «Hablar» admitían cuatro perfiles de voz y estilos separados por especie.
2. INSTRUCCIÓN VIGENTE 2026-11-06: criaturas con voz **caricaturesca, no voz humana**. No confundir nunca su voz con JANUS/Nexo ni con voces clonadas.
3. INSTRUCCIÓN POSTERIOR VIGENTE 2026-11-06: **una sola voz para todas las criaturas**, sin necesidad de crear una por especie.
4. IMPLEMENTADO EN ESTA RAMA: mismo `voiceId`, mismo timbre nativo seleccionado y perfil base; muestra de diálogo y personalidad de cada criatura preservadas; estilo de voz único y persistente en `ST.comp.voiceStyle` con compatibilidad histórica no destructiva.
5. POR CONFIRMAR: que el timbre sea verdaderamente caricaturesco y no humano. Web Speech es una aproximación nativa; requiere muestra de voz aprobada y validación auditiva en iPhone/Safari. No declarar 100 % ni publicar una voz humana como sustituto definitivo.

## Preservado
- Dashboards A/B, criaturas y modelos 3D, vestidor, estrellas, aprendizaje, estados, expresiones.
- Identidad de Nexo/Founder totalmente independiente.
- Voz local-first sin consumo de API externa desde el LEGO.
- Seguridad y evidencias para contenidos delicados de Kendra en la rama base; esa tarea tiene sus propios criterios aún pendientes.

## Archivos modificados
- `prototypes/dashboard/lego/janus-cartoon-voice/janus-cartoon-voice.js`
- `prototypes/dashboard/src/companero.js`
- `prototypes/dashboard/tests/kendra-cartoon-voice.test.cjs`
- `prototypes/dashboard/lego/janus-cartoon-voice/README.md`
- Este handoff.

## Pruebas/criterios
- Igual identidad, mismo pitch/rate/volume base y mismo timbre seleccionado para Lumi, Bombo, Musgo y Nimbo.
- Preview, estilos y estado de silencio preservados.
- No alterar voz de Nexo.
- JS syntax, tests unitarios, build A/B y CI del PR deben verificarse por sus resultados reales.
- Prueba auditiva en iPhone/Safari con una voz de caricatura aprobada **pendiente**.

## Siguiente acción
Revisar checks del PR apilado; validar una muestra de timbre caricaturesco genuino y conectar un único adaptador TTS si se autoriza. No fusionar ramas apiladas ni desplegar sin el gate de aprobación. Todas las decisiones cronológicas se preservan en Git; la última instrucción aprobada gobierna lo vigente.
