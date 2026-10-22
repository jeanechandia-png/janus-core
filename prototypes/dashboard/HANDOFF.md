# HANDOFF — Dashboard Janus (A Obsidiana + B Platino)

Actualizado: 2026-10-22 00:20 (Europe/Amsterdam) · Rama: `claude/dashboard-obsidiana` · Autor: sesión Claude.
Leer antes: `START_HERE.md`, `docs/STATE.md`, `prototypes/dashboard/README.md`.

## AHORA
Dashboard A (Obsidiana) interactivo terminado y verificado. Jean añadió dos requisitos nuevos (abajo, PENDIENTE 1 y 2), que son el siguiente trabajo.

## HECHO (verificado)
- A interactivo: 11 vistas de detalle; todas las zonas abren detalle (`data-go`), acciones (`data-act`), ajustes persistentes.
- Clima/bici: Open-Meteo en vivo (sin clave), geolocalización/búsqueda de ciudad, veredicto ida/vuelta, salida sugerida, kit de ropa; umbrales ajustables. Ejemplo si no hay red.
- Datos reales (instantánea 2026-10-21 22:16): Google Calendar principal → «Mi día»; GitHub janus-core (9 PR abiertos, 10 CI en verde) → «Janus».
- Pruebas: `tests/layout.cjs` TODO OK en 1194x834, 1366x1024, 1920x1080 (sin scroll/recortes) y 390x844 (columna sin desbordes); modo live simulado OK; `tests/clicks.cjs` sin errores JS y persistencia OK.
- Privacidad: nombres personales como marcadores; datos reales solo en `local/` (gitignored).

## HECHO 2026-10-22 (iteración visual 3D)
- Capa `src/depth.css` + `src/depth.js`: paneles con volumen e inclinación al dedo, reflejo especular, entrada en profundidad, medalla giratoria, gráficas sobre plano en perspectiva con cinta extruida, barras prisma, tubos de vidrio, donut como disco 3D, embudo 3D, semana familiar con escala horaria.
- Iconos: emojis sustituidos por iconos vectoriales grabados en oro (`src/icons.js`, generado con `tools/gen-icons.cjs` desde lucide-static, ISC).
- Tipografías incrustadas (`assets/fonts`, OFL vía @fontsource): nítidas e idénticas offline.
- Vista previa navegable: `node build.cjs --artifact <ruta>` genera la variante sin esqueleto para publicar como Artifact privado.

## REGLA LEGO (Jean, 2026-10-22 15:22)
Toda mejora de Janus debe poder montarse en otros productos (landings, web, IBA, ChatBox) y propagarse: si se actualiza una pieza, las superficies que la usan la heredan.
- Mecanismo existente en el núcleo: Assistant Control Plane (perfil padre `infinity-landing-assistant`, superficies `landing.infinity-group|chatbox|iba` con `tracking=current`) + Reusable LEGO Library (ver docs/STATE.md).
- Primera pieza extraída: `lego/janus-activity/` v0.1.0 (medallón del logo con actividad + Mini-Jano), sin dependencias, con `manifest.json` y `demo.html`. Pendiente: registrarla en la LEGO Library y en el perfil padre.
- Próximas piezas: sala de trabajo (`src/sala.js` → `lego/janus-workroom/`) con adaptadores (envío al núcleo, proyectos, voz) y el micrófono de Melanie (`isg-voice`) conectado a la voz de Janus.

## HECHO 2026-10-22 (sala de trabajo)
- Decisión de Jean: **solo el medallón del logo** con efecto de actividad + **Mini-Jano en la conversación, donde llega la respuesta, solo mientras Janus la genera** (nada de medallones repetidos; corregido por Jean 15:28).
- `#inicio` (portada: micrófono vintage, Hablar/Escribir/Proyectos/Dashboard), `#trabajo` (proyectos | chat voz+texto | estado y proyecto), tarjeta «Proyectos» en el dashboard → sala. Respuestas simuladas y rotuladas; acciones que publican/envían/borran/gastan piden visto bueno.

## HECHO 2026-10-22 15:50 (premium hiperrealista)
- Pieza LEGO `lego/janus-gold/` v1.0.0 (reutiliza el oro aprobado de la PWA): letras JANUS y títulos de sección en mayúsculas 3D de oro (Cinzel 900, extrusión, bisel especular, horizonte reflejado, barrido de luz que sigue al dedo); botones de oro con relieve, destello y luz al tocar; iconos acuñados (canto de oro, esmalte, cristal, destello animado, relieve metálico SVG) que se iluminan al tocar.
- `src/premium.css`: luz cinematográfica (haces cálidos animados + viñeta), cantos de oro pulido en todos los paneles (divisiones marcadas), líneas internas doradas, cifras en oro 3D.
- Mini-Jano articulado (hombro, codo, cadera, rodilla): camina y trabaja con brazos y piernas, voltereta con brazos arriba y rodillas recogidas, mano al mentón al pensar, saludo con el antebrazo al pedir visto bueno.

## HECHO 2026-10-22 16:10 (teléfono)
- Jean: en teléfono las tarjetas de borde a borde eran innecesariamente grandes. Ahora el teléfono tiene su propio tablero (`src/phone.js`, `src/phone.css`): clima compacto + acceso «Hablar con Janus» + 10 widgets en 2 columnas con cifra clave y mini gráfica; cada widget abre su vista de detalle. Alto total en 430x932: ~1.130 px (antes ~3.100 px).

## TELÉFONO — POR DECIDIR (Jean, 22-oct 16:08)
- RECHAZADO: tablero de widgets/botones (no es un dashboard; la información debe verse de una sola vista).
- Presentadas 3 opciones con toda la información a la vista (`src/phonev.js`, `?tel=a|b|c`): A Terminal (bandas densas, ~1,15 pantallas), B Cuadrantes (2 columnas con listas y gráficas, 1 pantalla), C Cronología (día por carriles personal/__HIJA__/empresa con clima por hora + KPI + estado, 1 pantalla). Por defecto A hasta que Jean elija. No publicar vista interactiva hasta su elección.

## PENDIENTE (orden de prioridad)
1. **Opción B también implementada (petición de Jean, 2026-10-22).** Janus debe ofrecer **dos dashboards: A Obsidiana y B Platino**.
   - Recomendación: un solo núcleo (datos, modelo clima, router, acciones, vistas) y dos «pieles»: `dash-a.js`+`theme-a.css` y `dash-b.js`+`theme-b.css`. Las vistas de detalle deben heredar el tema activo.
   - Selector A/B persistente (ajuste `skin`) visible en la cabecera y en la vista «Datos/Ajustes»; el build puede generar los dos HTML y uno combinado.
   - Base visual de B: `reference/design-b-platino.cjs` (estático). Debe cumplir las mismas reglas que A (una pantalla sin scroll en tablet/escritorio, columna en teléfono, todo clicable, REAL/EJEMPLO).
2. **Sección «Proyectos» (petición de Jean, 2026-10-22)** — falta en ambos diseños.
   - Tarjeta en el dashboard (sin romper la regla de una pantalla: rebalancear la cuadrícula) + vista `#proyectos` con detalle extenso.
   - Por proyecto: icono, nombre, ámbito (empresa/personal), estado (activo / próximo / en pausa), fase, % avance, próximo hito y fecha, responsable(s), riesgos/bloqueos, enlaces (repo, PR, documentos). Filtros por estado y ámbito; gráfico de avance y línea de tiempo.
   - Proyectos conocidos a confirmar con Jean (POR CONFIRMAR, no inventar estados): Janus, Infinity ChatBox (piloto 3 Kings), IBA, web institucional InfinitySeed, línea de productos Gumroad, patrocinio Potensic, Marketing 360 con dron.
   - Fuentes reales candidatas: `jeanechandia-png/infinity-chatbox-platform/INFINITYSEED_PROJECT_REGISTRY.md` (registro canónico), GitHub (repos/PR/CI), Google Calendar. Sin fuente → marcar EJEMPLO.
3. **Sala de trabajo (petición de Jean, 2026-10-22 15:06)** — POR DECIDIR entre opciones presentadas (Artifact «Janus · Sala de trabajo»):
   - Landing Janus: micrófono 3D de Melanie (pieza visual `isg-voice` 2.1.0 de `infinity-chatbox-platform`, rama `fix/chatbox-visual-parity-20260927`; micro WebGL en `infinityseed-group-website@feature/v8-premium-continuity-20261012:assets/js/infinityseed-mic3d.js`) **conectado a la voz propia de Janus, no al agente de Melanie**; botón «Escribir» y «Proyectos».
   - Sala de trabajo tipo Claude/ChatGPT: chat de voz + texto, lista de proyectos, señal de actividad. Distribuciones 1/2/3; señales A ondas, B medallón, C Mini-Jano robot, D núcleo, E hilo de fases. Recomendado: distribución 3 + B + E, C opcional.
   - Dashboard: tarjeta «Proyectos» que abre la sala con el proyecto seleccionado (se une a PENDIENTE 2).
   - La PWA (`apps/pwa`) ya tiene orbe de voz y campo de texto; tocarla requiere autorización explícita de Jean.
4. Reconectar Gmail (lo hace Jean en claude.ai → Ajustes → Conectores) → alimentar Prioridades y Clientes.
5. Datos vivos sin intervención: llevar adaptadores a JANUS Core/PWA (Google Workspace y GitHub ya existen en el core). **Requiere autorización de Jean** (toca `apps/pwa`).
6. Calendario «Familia» vacío → cuando Jean lo llene, alimentar la zona familiar.
7. Meta (alcance/reels), ingresos (empresa sin registrar → ejemplo), chatbots: sin conector.

## BLOQUEADO / LIMITACIONES
- La llamada real a Open-Meteo y Safari/iPad no se verificaron desde el sandbox (sin internet general); solo con simulación.
- `gh` GraphQL devuelve 403 en este entorno → usar `gh api` REST.
- Gmail: conector en `needs_reconnect`.

## NORMA OPERATIVA (Jean, 2026-10-22)
Tras CADA actividad: enviar preview (capturas tablet y teléfono de A y B + los HTML). Nunca cerrar solo con código o traspaso.

## PRÓXIMO (primer paso del siguiente agente)
Refactorizar a núcleo común + piel A (sin cambiar el resultado visual de A: comparar capturas antes/después), añadir piel B interactiva, luego la sección Proyectos en ambas. Ejecutar las pruebas en las mismas resoluciones y entregar a Jean **cada HTML por separado** (no previsualización Artifact) con una captura de cada uno.

## Cómo regenerar la instantánea real (no se sube al repo)
- Calendar: herramienta MCP Google Calendar `list_events` (calendario principal y «Familia», 8 días) → `local/real.js` (`ev: [{d,h,dur,e,t,amb,note}]`).
- GitHub: `gh api repos/jeanechandia-png/janus-core/pulls?state=open` y `gh api repos/jeanechandia-png/janus-core/actions/runs?per_page=10`.
- Nombres: `local/names.json` → `{"__HIJA__":"…","__CLIENTE_IBA__":"…","__CONTACTO_FIRMA__":"…"}`.
