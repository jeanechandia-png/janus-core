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
