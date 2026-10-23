# Editor visual de flujos («Flujos»)

Pantalla táctil (iPhone, tablet, escritorio) para **preparar borradores de flujos** sobre el motor real de Janus
(`packages/automation`). Un solo archivo HTML, sin red, sin servidor y sin gastos (norma 7).

> Vive en `apps/` y no en `packages/modules/` a propósito: consume el motor de Janus (catálogo de nodos, validación,
> plantillas), así que **no es un módulo LEGO autónomo** (los módulos LEGO no importan nada fuera de su carpeta).

## Qué hace

- **Lienzo de nodos**: tocar para seleccionar, arrastrar para mover, conectar en dos toques (salida del nodo → nodo de destino;
  si el nodo tiene ramas —`logic.if`, `logic.switch`, `ai.classify`— primero se elige la rama; la rama de error aparece si el
  nodo tiene «Si falla: rama de error»). Disposición vertical (móvil/tablet) u horizontal (pantalla ancha). Deshacer/rehacer.
- **Paleta**: los 24+ tipos de nodo del motor, agrupados. Los que necesitan algo que aún no existe se marcan **«en reposo»**
  (construidos, pendientes de activación; no son un fallo y no obligan a comprar nada).
- **Plantillas reales del motor** (briefing matinal, alerta de dron, triaje de correo, investigación con fuentes, llegada a casa).
- **Detalle por nodo**: parámetros (texto, número, sí/no, JSON), conector y acción, objetivo del agente, riesgo, reversibilidad,
  aprobación (el editor aplica los invariantes del motor: riesgo alto o irreversible ⇒ aprobación obligatoria), tiempo límite,
  reintentos, «si falla», credenciales (solo referencias), desactivar.
- **Problemas** en español, tomados de `validateAutomationWorkflow` y `AutomationNodeRegistry.checkNode` (el editor no tiene
  reglas propias que contradigan al motor; una prueba comprueba que las plantillas del motor salen sin errores).
- **Orden previsto** (pasos, pausas por aprobación o espera) sin ejecutar nada.
- **Archivo**: exportar/importar borradores `janus-flow-draft` (JSON). Importar siempre deja el flujo como borrador y rechaza
  claves peligrosas. Un valor con forma de clave (sk-, ghp_, AKIA, PEM, Bearer, JWT…) **bloquea la exportación y el guardado local**.
- **Entorno simulado** (hoy / conectado / todo): el runtime todavía no publica su catálogo real, así que el editor lo simula y lo
  rotula. Cuando exista, se sustituye por la lectura real (ver «Siguiente paso»).

## Lo que NO hace

No publica, no ejecuta, no llama a conectores, no guarda secretos, no usa red. Publicar y ejecutar siguen siendo del motor, con
aprobación del Founder.

## Uso

```bash
node scripts/build-flow-editor.mjs            # → dist/flow-editor/janus-flujos.html (no se versiona)
node scripts/flow-editor-e2e.mjs [capturas/]  # prueba en navegador real (necesita Playwright + Chromium)
node --import tsx --test tests/flow-editor-model.test.ts tests/flow-editor-build.test.ts tests/secret-shape.test.ts
```

## Estructura

| Archivo | Papel |
|---|---|
| `src/model.ts` | Lógica pura (sin DOM, reloj ni red): catálogo, edición, conexiones, disposición, análisis, importar/exportar. |
| `src/browser.ts` | Pantalla: `mountFlowEditor(root, opciones)`. Todo texto de un borrador se escapa antes de pintarse. |
| `src/icons.ts` | Iconos Lucide (licencia ISC), los mismos del dashboard. |
| `web/flow-editor.css` | Estilo Obsidiana (negro y oro). |
| `web/main.ts` | Punto de entrada del HTML autónomo. |

El borrador se guarda en `localStorage` del dispositivo (solo comodidad; nunca si contiene algo con forma de clave).

## Siguiente paso (no hecho)

Servir este HTML desde el runtime y leer su catálogo real (`builtinNodeManifests` con el entorno verdadero) para sustituir el
entorno simulado; guardar borradores en SQLite y publicarlos con aprobación del Founder. Requiere decidir dónde vive la pantalla
(`apps/pwa` no se toca sin autorización expresa).
