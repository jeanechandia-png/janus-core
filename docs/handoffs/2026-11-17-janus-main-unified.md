# JANUS — Handover cronológico unificado (17 noviembre 2026)

## ESTADO VIGENTE — producto único

- **Repositorio canónico y único:** `jeanechandia-png/janus-core` (público, sin secretos, biometría ni audio de referencia en Git).
- **Rama fuente para todo nuevo desarrollo:** `main`; recuperar el SHA remoto actual en cada sesión. No fijar `2fe56e0` o el SHA de este documento como HEAD permanente: evolucionará.
- **HECHO VERIFICADO por GitHub:** PR #82 (Claude JANUS Work) se fusionó en PR #81, y PR #81 se fusionó en `main` mediante commit `2fe56e06946a0747fef8074cf21c466ee70da7e3`, conservando los progenitores. El commit de desarrollo previo fue `9e9681fa0bacd26dced57436ff08d67b80b820ba`.
- **HECHO:** la suite Core CI del commit previo a la fusión en `main` pasó; comprobación de tipos, sintaxis, preparación de HTML y pruebas Core. **No declarar certificada** la instalación física ni el piloto por esa evidencia.
- **HECHO:** guardas anti-copia de PR #76 reutilizadas en `main`: `packages/core/src/continuity-guard.ts`, `scripts/continuity-guard.ts`, `tests/continuity-guard.test.ts`; comando `npm run continuity:guard`. Esto recupera la pieza concreta, **no equivale a fusionar toda PR #76**.
- **PENDIENTE:** validación real de las dashboards de CEO/Kendra/Work en iPhone/Samsung, conversación de voz local con modelo instalado y originales aprobados, GLB auténticos de cuatro criaturas y robots aprobados, integridad visual y rendimiento. No afirmar despliegue o funcionamiento 100 % a partir de mocks o HTML.
- **Voz provisional:** el propietario escuchó y aceptó la voz «Jean» en ElevenLabs el 17-nov-2026 para Janus. Es proveedor reemplazable. La voz definitiva local se construye exclusivamente con grabaciones originales propias; no con salidas TTS del proveedor. Audio, transcripción, tokens y claves solo privados.

## PR anteriores que aún requieren conciliación por alcance y fecha

**NO dar por incluidas todas las funcionalidades históricas por el solo hecho de haber unido #81, #82 y `main`.** En la revisión de ascendencia a 17-nov-2026 continúan divergentes:

- #64 órdenes vocales / estudio de voz, #68 adaptador ElevenLabs alternativo;
- #69 y #70 verificación de GLB e importación de originales privados;
- #75 una voz caricaturesca no humana compartida para las cuatro criaturas;
- #77 y #80 cámara local y piloto;
- #78 auditoría de piloto, #79 seguridad infantil conectada al envío;
- #76 política de bloqueo de copias (solo sus tres archivos de guard y scripts reutilizados hasta la fecha).

Se deben inspeccionar **los cambios relevantes** comparando sus PR con el `main` de entonces y portar mejoras aprobadas de forma aditiva en orden cronológico; no fusionar ramas históricas enteras a ciegas ni sobrescribir cambios nuevos. Esta lista no es inventario completo de todas las PR.

## Protocolo obligatorio de cada agente (Claude, ChatGPT, Codex, Work)

1. Antes de editar, `git fetch origin`, verificar remoto, `origin/main`, estado y cambios locales no publicados. Si hay cambios de otro agente no empujados, protegerlos, no reiniciar ni reescribir.
2. Leer `START_HERE.md`, `docs/STATE.md`, este handoff y ejecutar `npm run continuity`; usar un checkout/ramificación de trabajo del **mismo repositorio** desde `origin/main`, ejecutar `npm run continuity:guard`. El guard bloquea edición directa en `main` a propósito; permisos explícitos excepcionales se documentan.
3. Inventariar qué piezas ya existen (Core, PWA `apps/pwa`, `prototypes/dashboard`, `packages/voice`, Kendra, `work`, LEGO); **extender**, no recrear ni anunciar una dashboard alternativa como oficial. Respeta las interfaces aprobadas y evita colocar datos privados en el repo público.
4. Registrar por commit SHA fuente, cambios, pruebas, acciones pendientes y clasificación VIGENTE/HISTÓRICO. Para integración a `main`, exigir pruebas y revisión razonable; no borrar rama o PR con trabajo no reconciliado. Captura de voz de menores requiere especial restricción/consentimiento y nunca sirve para pruebas públicas.

## Pruebas

```bash
npm run typecheck
npm test
npm run dashboard:build
npm run dashboard:test
node tests/runtime-smoke.mjs
```

Pruebas navegador físico, GLB y audio real se cierran solo con evidencia real. **No afirmar completado** si solo se ejecutó CI de simulación.

## Ruta de continuación

PR #81 y #82 son HISTÓRICO fusionado. El `main` remoto es VIGENTE. Próxima prioridad: conciliación selectiva de seguridad Kendra (#79), voz compartida (#75), importador visual GLB (#69/#70), cámara (#80), guard de piloto (#78), después verificación en dispositivos reales. No activar proveedores, comprar créditos, ni desplegar sin compuertas y consentimiento del propietario.

## Actualización 17-nov-2026 — orden verbal y archivos para evolucionar todos los productos

**Nueva instrucción expresa del Founder:** JANUS mismo debe recibir por voz y chat archivos de los seis personajes (Lumi, Bombo, Musgo, Nimbo y dos robots), validarlos e integrarlos en los destinos reales aprobados; también debe ejecutar actualizaciones de web, landing y productos autorizados de InfinitySeed Group a través de sus repositorios y adaptadores propios, manteniendo continuidad entre agentes. No pedir al usuario que escriba código como procedimiento habitual.

**HECHO:** la instrucción se ha fijado en `START_HERE.md`, Norma 10 de `docs/operating-norms.md` y contrato `docs/VOICE_DRIVEN_PRODUCT_EVOLUTION_CONTRACT.md` con proceso, controles y pruebas de aceptación. **POR CONFIRMAR:** la orquestación completa voz → archivos → código → preview → aprobación → despliegue en equipo real; la existencia de componentes separados no es prueba end-to-end. **PRÓXIMO:** conectar módulos vigentes sin duplicar motor ni producto, preservar privacidad/sesión y validar primero en el repositorio Janus; después realizar piloto sobre otro producto del ecosistema con su propia autorización.

## Continuación de implementación 17-nov-2026 — rama de revisión sobre este mismo producto

**Base verificada:** `main@9112ad54cc623b1f09993d2e0c21228abd42ecea`; **rama de trabajo:** `chatgpt/janus-voice-evolution-hardening-20261117` (MISMO repositorio; no es un segundo producto, landing ni dashboard). **Estado de esta adición:** código escrito; pendiente aprobación/merge, CI y validación real.

Se extiende `GitHubAdapter` con `branch.create` para preparar ramas `janus/change-*` o `janus/evolution-*`: exige base/SHA exactos, revalida la rama, no pisa una rama existente, no hace merge ni despliega. `sensitive-action-policy` exige aprobación del Founder y `ToolGateway` exige permiso auditado e idempotencia para acciones `create`. El runtime anuncia la capacidad, sin configurar tokens nuevos. Pruebas de éxito, duplicado y SHA obsoleto añadidas.

`JanusEvolutionGuard.premortem` pasa a **60 meses** por defecto y evalúa tres nuevos riesgos: voz/adjuntos a cambio real, delegación y recuperación de subagentes, y portabilidad de proveedores de infraestructura. Una comprobación queda `unknown` hasta existir prueba verificable. El código **no** acredita todavía la ejecución de extremo a extremo de voz → adjuntos → assets → código → preview → publicación, ni certifica GLB, clones locales de voz, apps móviles o compatibilidad futura.

**Siguiente ciclo recomendado:** obtener CI y revisar diff; conciliar seguridad infantil #79 y assets/voz/cámara pendientes en orden cronológico; conectar el orquestador al pipeline existente y validar con GLB auténticos bajo Founder, con rollback. Conservar historial y no forzar la fusión.


## Continuación por instrucción del Founder — Fable 5.2 como referente de capacidades (17-11-2026)

**ALCANCE:** construir y perfeccionar capacidades *equivalentes en comportamiento* dentro del JANUS oficial, con modelo y herramientas sustituidos por adaptadores propios. Uso inicial interno; comercialización futura posible pero no decidida por el Founder. No se dispone de pesos ni de un procedimiento público para reproducir exactamente el modelo propietario. No copiar código/pesos/prompt oculto ni entrenar con contenido de terceros sin autorización y derechos. No declarar «clonado» al modelo.

**Código implementado en la PR #83 existente** (`chatgpt/janus-voice-evolution-hardening-20261117`): `packages/orchestrator/src/flow-agent-adapter.ts` ahora admite el ciclo opcional de corrección acotada `produce → verify → revise → verify`, con máximo 3 correcciones, 0 por defecto (sin consumo adicional por omisión), verificador independiente, límite de salida, preferencia/exigencia local y auditoría por huellas y recuentos. Se preservan permisos, aprobaciones y fail-closed. Test en `tests/flow-agent-adapter.test.ts`.

**POR VERIFICAR:** CI del nuevo delta, conexión a ejecutores reales, comparativa de calidad, presupuesto de modelos, tareas de horas, recuperación tras reinicio en dispositivos y equivalencia observada frente a Fable. El uso actual de esta capacidad es interno; no se fija una prohibición de comercialización futura. No es una clonación neuronal ni una migración de JANUS a Anthropic.

**Fuentes públicas verificadas el 17-11-2026:** https://platform.claude.com/docs/en/models/fable-5-2/overview y https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2.

## Corrección posterior del Founder — destino comercial abierto (17-11-2026)

**VIGENTE:** JANUS debe inspirarse en las capacidades observables y públicas de Fable 5.2, construir una versión propia, perfeccionarla y adaptarla acumulativamente al software JANUS. El uso actual es interno; **la comercialización futura no está descartada ni aprobada**, se decidirá cuando corresponda. La redacción anterior «no comercial» pasa a HISTÓRICO como circunstancia temporal; no es una restricción arquitectónica, de licencia de nuestro propio código ni de distribución futura.

**PREVENCIÓN:** evitar copiar pesos, datasets restringidos, código propietario, marcas y prompts privados. Registrar procedencia, licencias de dependencias, permisos y benchmarks; antes de cualquier comercialización, revalidar compatibilidad legal y contractual con las fuentes realmente utilizadas. Reutilizar módulos existentes y gateways sustituibles, no crear un producto paralelo.

## Continuación — instalación de tablet en PR #83 existente

VIGENTE: retomar el HEAD remoto de `chatgpt/janus-voice-evolution-hardening-20261117`, leer el primer bloque de `docs/STATE.md` y `docs/tablet-node.md`. Se conserva el núcleo unificado y se endurece el kit Termux, el alta local del propietario y la caché de las dashboards reales. No se crean aplicaciones ni ramas nuevas. Las instrucciones de instalación de octubre quedan históricas.

La preparación técnica no acredita instalación física, conexión de modelos/voz, piel privada de Work ni personajes GLB. El nuevo job `tablet-browser` prueba la interfaz y persistencia con datos ficticios; no cerrar pendientes hasta observarlo. El historial local antiguo está protegido en stash y rama, no se reintroduce sobre la versión unificada.


## Continuidad 18-nov-2026 — JANUS 3D FORGE sin dependencia de Hyper3D

Objetivo vigente del Founder: demo con seis personajes 3D en diciembre para financiación a mediados de mes, preferiblemente usando los GLB externos solo como puente; desarrollar simultáneamente capacidad propia y reutilizable de generación 3D que sea un futuro módulo de InfinitySeed. No comercializar JANUS íntegramente por obligación: potencial comercial principal = módulos. Nunca entrenar el motor con Hyper3D ni extraer su lógica, y no comprar nada sin autorización.

Trabajo en **la misma PR #83** / `chatgpt/janus-voice-evolution-hardening-20261117`, sobre el Janus único. Existían `JanusHyper`, `JanusCreatureSlot` y `approved-presence.js`. Se incorporan `janus-3d-forge` (GLB BIN+SHA/provenance+preview-only), CLI de preparación local, sidecar independiente TRELLIS.2, tests y manual `docs/janus-3d-forge.md`. Se añadió `module.json` y `README.md` al descubrir que el contrato de módulos LEGO los exige (error CI inicial, corregido). Se endureció validación para bloquear GLBs con solo metadatos sin geometría BIN; no prometer que validación sintáctica demuestra calidad visual.

**Alcance no terminado:** no se generó ningún GLB real, no se ejecutó la inferencia de 4B parámetros sin GPU, no hay rig automático ni API de voz-Forge, no hay prueba física en iPhone, no hay contratación, merge ni despliegue. Revisar CI HEAD y no confundir el timeout de test tablet 401 del run intermedio con el módulo de 3D; no tocar flujos biométricos de Kendra sin causa verificable. Continuar de `docs/STATE.md` y esta PR; la presentación del piloto deberá distinguir 2D/preview y 3D riggeado listo.
