# Dashboard de Kendra (módulo `kid-dashboard`)

Fecha: 2026-11-04 · Estado: módulo, rutas, app propia, panel de padres y pruebas **implementados y verificados** (suite + navegador real). Lo que depende de aparatos o cuentas (Tuya, tele, búsqueda de planes en internet) está **en reposo** y se dice abajo.

## Qué pidió el Founder (2026-11-04)
Un acceso independiente para su hija (menor): su propio dashboard/app, personalizable por ella (nombre, icono, compañero), con chat (escribir o dictar), «+» (archivos, foto, escáner), bloqueo parental, sin contenido explícito, YouTube controlado, visibilidad para él mientras sea menor (qué hace y cuánto tiempo), una ventanita en su dashboard, control de la casa (luces, ventilador, calefacción), «ponme YouTube / la tele / Netflix», agenda con recordatorios, tareas y proyectos del cole, sus intereses, ofertas y planes de la zona, y el tiempo con consejo de ropa.

## Cómo está montado
| Pieza | Dónde | Notas |
|---|---|---|
| Lógica pura | `packages/modules/kid-dashboard/` | Sin red ni disco. Importa solo `node:` y su carpeta (lo exige `tests/lego-module-boundaries.test.ts`) |
| Rutas | `apps/runtime/kid-routes.ts` | `/api/kid/*` (ella) y `/api/parent/kid/*` (tutor) |
| Persistencia | `packages/core/src/sqlite-store.ts` | Tablas `kid_*` en SQLite local. Solo se guarda el **hash** del token y del PIN |
| Tiempo | `packages/adapters/src/open-meteo-adapter.ts` | Open-Meteo, sin clave; atribución CC BY 4.0 mostrada |
| App de ella | `apps/pwa/kendra.html`, `kendra.js`, `kendra.css`, `kendra.webmanifest` | Instalable; CSP propia (solo lo propio + `youtube-nocookie.com`) |
| Panel de padres | `apps/pwa/kendra-parent.js` | **Un solo código, dos sitios**: tarjeta en tu dashboard (sesión de Founder) y área con PIN en la app de ella |
| «+» | módulo `chat-attachments`, perfil `kid` | 8 MB, 3 archivos, enlaces escaneados **nunca** pulsables |

### Dos puertas, dos credenciales
- **Ella**: dispositivo emparejado con un código de 8 caracteres (10 min, un solo uso) → token `kdv_…`. Solo habla con `/api/kid/*`. **Nunca** es autoridad de Founder (hay prueba que lo comprueba).
- **Tutor**: tu sesión de Founder, o el dispositivo de ella desbloqueado con el PIN (10 min). Cambiar el PIN, emparejar y desactivar dispositivos exigen **tu sesión de Founder**, no el PIN.

## Cómo se pone en marcha (desde el iPhone del Founder)
1. En el dashboard de Janus → tarjeta **Kendra** → *Abrir su panel* → *Crear PIN parental*, y ajustar horario, zona, casa y vídeos.
2. *Emparejar un dispositivo nuevo* → aparece un código.
3. En el aparato de ella, abrir `https://<dirección de Janus>/kendra`, escribir el código. Para instalarla como app: «Añadir a pantalla de inicio».
4. Fuera de `localhost` hace falta **HTTPS** (cámara, y tu inicio de sesión de Founder). En la tablet: Tailscale (ver `docs/tablet-node.md`).

## Garantías que impone el servidor (no la pantalla)
- Horario y topes (ocio total y por actividad: chat, YouTube, tele, intereses). Cole, agenda y casa no se cortan por tiempo. Aviso amable unos minutos **antes** del corte.
- Filtro de entrada y salida (es/en/nl): lo adulto se bloquea y avisa al tutor; autolesión o contacto de extraños → alerta con mensaje que la lleva a un adulto. Los textos adjuntos también pasan por el filtro.
- **Vídeo**: solo vídeos que apruebas (enlace + nombre), en un iframe `youtube-nocookie.com` con `sandbox` (sin ventanas ni navegación fuera). Lo que pide y no está aprobado llega a tu panel como petición.
- **Casa**: interruptor general apagado por defecto; habitaciones y tipos de aparato permitidos por ti; calefacción con rango (10–24 °C) y permisos aparte para apagar/encender. Solo existen órdenes para luz, ventilador y calefacción; un enchufe cuenta únicamente si se llama «ventilador» (o lleva esa etiqueta). Cerraduras, cámaras, alarmas y cocina **no tienen ninguna orden posible**, aunque estuvieran en el inventario.
- **Contenido de la web**: todo lo que Janus encuentre (planes, ofertas) entra como `pending`; ella solo ve lo aprobado y sin enlaces.
- **Voz**: el compañero habla con la voz **local** del aparato; nunca se envía su texto a una voz en la nube de pago (regla de menores).
- **Qué ves tú**: tiempos por actividad (hoy y 7 días), avisos del filtro, peticiones. **No** ves sus conversaciones salvo que actives «conversaciones completas», y ella lo sabe.
- Su personalización (nombre, icono, color, compañero) es de listas cerradas o validada; sin enlaces ni arrobas en el nombre.

## Privacidad del repositorio
El repositorio es **público**. Aquí solo hay código y ejemplos genéricos: **ningún dato real de ella** (ni fecha de nacimiento, ni zona, ni agenda, ni centros o citas, ni conversaciones). Todo eso vive en la base SQLite local del equipo de Janus (`kid_*`) y en `config/home-devices.local.json`, fuera de Git. Los intereses por defecto del módulo son ejemplos genéricos y se editan desde su app.

## Configuración
`config/home-devices.local.json` (fuera de Git; plantilla `config/home-devices.example.json`), `JANUS_HOME_DEVICES_PATH`, `JANUS_KID_CHAT_MODEL=off`, `JANUS_KID_MAX_MODEL_CALLS_PER_DAY`, `JANUS_KID_WEATHER=off`. Zona (nombre, latitud, longitud) y todo lo demás: desde el panel de padres.

## Pruebas
`node --import tsx --test tests/kid-dashboard.test.ts tests/kid-routes.test.ts tests/open-meteo-adapter.test.ts` y `node scripts/kendra-smoke.mjs <carpeta>` (Chromium real: empareja, personaliza, chatea, apunta agenda y tarea, abre un vídeo aprobado, prueba la casa y el PIN, y falla si la consola muestra errores).

## Límites honestos (léelos antes de fiarte)
1. **Casa y tele en reposo (POR CONFIRMAR).** No hay claves de Tuya ni inventario real: las órdenes se entienden, se validan contra tu política y se **registran, pero no actúan** («Todavía no estoy conectado…»). La tele y Netflix, igual (modelo de tele sin confirmar).
2. **El filtro de palabras es una primera capa**, no una garantía. Tampoco se puede verificar desde aquí qué vídeos «relacionados» ofrece YouTube dentro del reproductor: por eso solo hay lista aprobada y `rel=0`. Mira lo que apruebas.
3. **El PIN de 4 cifras es débil frente a alguien que copie la base de datos**; su defensa es el bloqueo progresivo y que el PIN solo abre el área de padres. Contra alguien con acceso al aparato manda el emparejamiento (puedes desactivar el dispositivo al instante).
4. **No probado en iPhone/iPad ni en la tablet real**: la prueba de navegador fue Chromium. Safari no tiene `BarcodeDetector` (los códigos de barras 1D quedan limitados; el QR sí funciona con jsQR); HEIC no se convierte.
5. **Dictado**: usa el reconocimiento del navegador, que envía el audio al fabricante (Apple/Google). Es una decisión tuya; se puede quitar el micrófono.
6. **Texto de ella → proveedor del modelo.** Con modelo configurado, lo que escribe llega a ese proveedor (con la regla del sistema infantil). `JANUS_KID_CHAT_MODEL=off` lo evita (quedan respuestas de reserva).
7. **Recordatorios solo con la app abierta** (no hay notificaciones push todavía).
8. **Mismo origen que tu Janus**: si inicias sesión de Founder en el aparato de ella, tu sesión (que vive en `sessionStorage`, se borra al cerrar) comparte origen con su app. Usa otro aparato o perfil de navegador para ti.
9. **Si ella está fuera de casa**: los aparatos son de tu casa; apaga el interruptor general de la casa en el panel (es manual).
10. **Su zona** (para el tiempo y los planes) está **sin fijar (POR CONFIRMAR)**. Los nombres de variables extra de Open-Meteo (sensación térmica, probabilidad de lluvia, UV) se validan al primer uso real; si faltan, el consejo se degrada sin romper.
11. **Datos de una menor**: mínimos, locales y con tutor con acceso. La edad de consentimiento digital en los Países Bajos (16, INFERENCIA) y el encaje con RGPD están **sin verificar con fuente primaria**.
12. **Interfaz solo en español.** Neerlandés: pendiente (el filtro sí cubre es/en/nl).
13. La carpeta de adjuntos (`attachments/`) **no** está en `backup-db.mjs`: copiarla aparte.
