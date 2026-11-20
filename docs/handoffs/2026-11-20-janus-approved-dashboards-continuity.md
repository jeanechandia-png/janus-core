# JANUS — Traspaso cronológico de dashboards aprobadas · 20 noviembre 2026

## Identidad: una sola fuente, sin copias

- **Repositorio canónico:** `jeanechandia-png/janus-core`.
- **Base verificada:** `main` @ `1abf4822038795a8731774395ec4323de8bee78f`, que incorpora PR #81/#82 (Claude Work) y PR #84/#85 (Puerta de la Verdad).
- **Pantallas canónicas (mismo runtime):** `/dashboard/a` = Obsidiana, `/dashboard/b` = Platino, `/kendra` = infantil, `/work` = colaborador y `/work/team` = equipo. No crear `/dashboard-2`, otro servidor ni una PWA que suplante la aprobada.
- **Fuentes:** `prototypes/dashboard/src`, `prototypes/dashboard/lego/janus-gold`, `apps/pwa/kendra.js`+`.css`, `prototypes/dashboard/work/`. `prototypes/dashboard/dist` es una salida del compilador y no debe convertirse en nueva fuente de verdad.
- **Orden histórico de autoría:** Claude `claude/dashboard-obsidiana`, `claude/companion-escena-3d` y `claude/work-dashboard-template`; integraciones Janus PR #81/#82 en main; antifactualidad #84/#85; avance paralelo de voz/seguridad PR #83. El diseño aprobado por el propietario no se sustituye por nuevas composiciones.

## Qué se corrigió en ESTE ciclo

El 19/20 noviembre la PR #83, `chatgpt/janus-voice-evolution-hardening-20261117`, recibió cambios visuales en diez archivos canónicos y pasó Core CI #44640040154, pero la PR #83 quedó **dirty**, dividida respecto de `main` (15 commits detrás, 62 delante), por lo que **no autorizaba** anunciar el diseño incorporado a main. Para evitar otro desarrollo estancado se trasladaron **solo** las diferencias visuales locales —contrastadas archivo a archivo con main— a la rama de integración `chatgpt/janus-approved-ui-continuity-20261120` desde el último main conocido. Esto NO constituye otra copia del producto: es un cambio Git normal dentro del MISMO repositorio dirigido a main.

Los diez archivos trasladados mantienen intactas las estructuras de las vistas aprobadas:
1. `prototypes/dashboard/tools/gen-icons.cjs` y `src/icons.js`: reutilizan objetos WebP 3D `GOLD.o`, material pulido existente `GOLD.i`, fallback explícito SVG en relieve metálico cuando no existe imagen 3D. **No afirmar 100 % iconos hiperrealistas**; los iconos sin imagen necesitan arte nuevo aprobado.
2. `prototypes/dashboard/lego/janus-gold/janus-gold.js` y `.css`: extienden el touch lighting de los componentes originales y hacen visible el barrido especular de CTA.
3. `prototypes/dashboard/src/depth.js`, `src/premium.css`, `src/dash-b.css`: aplican iluminación de tarjetas en Obsidiana, Platino y móvil, profundidad con el puntero y pestañas con reflejo, sin modificar distribución, nombres o rutas.
4. `apps/pwa/kendra.js` y `kendra.css`: iluminación local de tarjetas/botones y medallones de pestañas en su tema aprobado; misma API infantil `/api/kid/*`, criaturas aprobadas y aislamiento del Founder.
5. `prototypes/dashboard/work/work-extra.css`: mejora puramente aditiva de iluminación en la piel original bloqueada por `skin.lock.json` de Claude. No se cambió la plantilla `work-app.js` ni `work-team.js`.

**Control nuevo:** `tests/dashboard-brand-continuity.test.ts` verifica rutas, fuentes del compilador, material iconográfico, tacto/reflejo de A/B/Kendra/Work, motion reducido y contrato de plantilla original. Pruebas del código y CI deben comprobarse para el HEAD exacto antes de declarar integración.

## La imagen de Claude no es evidencia de JANUS

La captura enviada por el propietario enseña un reporte de **Infinity ChatBox**, **IBA** y **web InfinitySeed** (pruebas 587/587 y 766/766). El encabezado de una conversación `proyecto_janus` no acredita que se haya trabajado en `janus-core`; ningún informe de otro repo prueba el aspecto o funciones de la dashboard de Janus. Los productos permanecen separados; Janus solo integra por conectores oficiales y permisos.

## Estado y próximos controles

- Validar CI de esta rama y el PR dirigido a `main`; fusionar solo al pasar las verificaciones y no sobrescribir PR #83.
- Comprobar en runtime verdadero la navegación y cada CTA, persistencia, permisos y la correcta visualización táctil en iPhone/tablet física. El CI, incluso navegador simulado, no prueba aceptación visual real.
- Terminar la iconografía de objeto 3D donde hoy queda fallback SVG; no renombrar pictogramas por conveniencia ni sustituir criaturas/robots finales sin los GLB originales autorizados.
- **Pendiente separado:** resolver PR #83 contra main con reconciliación manual. Si los cambios visuales ya están en main, no duplicarlos ni reemplazar el main actualizado con los archivos antiguos de PR #83.
- Agente entrante: `git fetch origin` → comprobar HEAD remoto → leer `START_HERE.md`, `docs/STATE.md`, este handoff → `npm run continuity` y `npm run continuity:guard`; partir del **main actualizado**, no de 1abf482 fijo ni de un HTML aislado.

## Incidencias encontradas tras activar pruebas bloqueantes

El workflow anterior podia registrar `FALLOS` en `prototypes/dashboard/tests/layout.cjs` y continuar con exit 0; lo mismo pasaba cuando `tests/clicks.cjs` imprimía `FALLO`. Ambos scripts ahora devuelven error si hay incidencias, y `.github/workflows/dashboard-ci.yml` ejecuta el recorrido real de clics. El instalador de Chromium reutiliza el binario del runner si ya existe.

**Evidencia del primer CI estricto de A/B:** GitHub Actions #44643299230 encontró 4 desbordamientos en Obsidiana 1194×834, en Trabajo (`.pjc`), Ofertas (`.ofv` y otra `.cd`) y Clima (`.wxp`, `.wxt`); son cuatro rutas/escenarios que requerían scroll interno, no un cambio de composición. Corrección aplicada en `prototypes/dashboard/src/views.css` con desplazamiento interno limitado a desktop/tablet y barras de scroll de canto dorado. **No declarar la reparación comprobada hasta que CI del commit posterior pase**. Nunca volver a silenciar el exit code para simular éxito.
