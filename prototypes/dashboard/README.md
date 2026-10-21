# Dashboard Janus — prototipos A (Obsidiana) y B (Platino)

Estado: **prototipo funcional fuera de `apps/pwa`** (la PWA aprobada no se toca sin autorización de Jean).
Rama de origen: `claude/dashboard-obsidiana` · Fecha: 2026-10-22.

## Qué es
Un HTML autónomo (un solo archivo, sin servidor) que Jean abre en tablet, escritorio o teléfono.
- **A · Obsidiana** (negro + oro, 3D): **elegido por Jean** y totalmente interactivo — cada zona abre una vista detallada.
- **B · Platino** (claro, cristal): diseño estático de una pantalla en `reference/`. **Jean pidió que Janus tenga las dos opciones (A y B)**: hay que llevar B al mismo nivel funcional que A (ver `HANDOFF.md`).

## Estructura
```
build.cjs              ensambla dist/Janus-A-Obsidiana-interactivo.html
src/lib.js             utilidades, fechas, estado (localStorage janus.preview.A.v1)
src/weather.js         Open-Meteo en vivo + generador de ejemplo + modelo de riesgo bici
src/data.js            datos de EJEMPLO (etiquetados como tal en la UI)
src/real.example.js    instantánea pública de ejemplo (Calendar/GitHub)
src/dash.js            pantalla principal (zonas data-go)
src/views.js           11 vistas de detalle (clima, día, familia, prioridades, janus, ingresos,
                       alcance, chatbots, contenido, clientes, datos)
src/app.js             router por hash, acciones (data-act), refresco clima 15 min
src/base.css, views.css  estilos en px de referencia 1194x834 → convertidos a rem en build
reference/             diseño B Platino (estático) + lib estática compartida
tests/layout.cjs       sin scroll ni recortes en tablet/escritorio; teléfono sin desbordes
tests/clicks.cjs       interacción e2e + persistencia tras recarga
local/   (gitignored)  real.js (instantánea real) y names.json (nombres reales)
dist/    (gitignored)  salidas
```

## Privacidad (repo PÚBLICO)
Los nombres personales del código están como marcadores (`__HIJA__`, `__CLIENTE_IBA__`, `__CONTACTO_FIRMA__`) y
el build los sustituye desde `local/names.json`. Los eventos reales del calendario solo viven en `local/real.js`.
Nunca subir `local/`, capturas con datos reales ni secretos.

## Uso
```bash
node build.cjs                      # A → dist/
node reference/design-b-platino.cjs # B estático → dist/
PLAYWRIGHT_MODULE=<ruta playwright> CHROME_PATH=<chromium> node tests/layout.cjs offline 1194x834,1366x1024,1920x1080,390x844
node tests/layout.cjs live 1194x834   # Open-Meteo simulado
node tests/clicks.cjs
```

## Reglas de diseño acordadas con Jean (no negociables)
1. Tablet/escritorio: **todo en la primera pantalla, sin desplazamiento**, adaptado al ancho; sin espacios muertos.
2. Teléfono (`max-width:47.5em` o `max-height:31.25em`): **una columna con desplazamiento**.
3. Muchos iconos y gráficos, poco texto; iconos se iluminan al tocar/pasar.
4. Toda zona visible es funcional y abre una vista de detalle extensa.
5. Personal/familiar separado de empresa (ámbitos `p`/`f`/`e`).
6. Cada módulo indica **REAL** o **EJEMPLO** (Protocolo de la Verdad). Euros, enfoque europeo.
7. Entrega: cada diseño en un HTML independiente y descargable (no previsualización Artifact).
8. **Preview SIEMPRE**: al terminar cada actividad, enviar a Jean capturas (tablet 1194x834 y teléfono) + los HTML. Sin preview la entrega se considera incumplida.
