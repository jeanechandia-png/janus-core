# Janus en la tablet Samsung — instalación del mismo producto

Vigente: 17 de noviembre de 2026. Fuente única: `jeanechandia-png/janus-core`.

La tablet ejecuta el núcleo local y abre las pantallas existentes: `/dashboard/a`, `/dashboard/b` y `/kendra`. Se instala como PWA desde Chrome; no es un APK autónomo. Termux mantiene el núcleo, la memoria SQLite y los archivos privados en el mismo dispositivo. No se contrata ningún servidor ni proveedor adicional.

## Estado comprobado y límites

- La tablet se instala y se actualiza desde **`main`** (actualizado el 24-11-2026). La rama `chatgpt/janus-voice-evolution-hardening-20261117` (PR #83, abierta) **diverge** de `main` (62 commits propios, 137 por detrás): una tablet instalada desde ella no puede pasar a `main` por avance rápido hasta que esa PR se integre. No instalar desde ramas históricas ni desde previews HTML como si fueran el núcleo.
- Instalador: instalación inicial, actualización fast-forward, rechazo de trabajo local sin guardar y de retrocesos; memoria y claves conservadas. Compila A/B antes de abrir la app.
- Configuración local: clave de cifrado y VAPID generadas **en la tablet**, carpetas 700 y configuración 600. Nunca imprime valores. Repetir conserva las claves. Acceso del núcleo limitado a loopback.
- El botón «Descargar llave pública» usa la llave P-256 ya creada por la app; la privada permanece no extraíble en el navegador. El registro local rechaza llaves privadas, algoritmos distintos y sustituciones del propietario.
- PWA: manifiestos separados para Founder y Kendra; caché v21 incluye A/B y Kendra. Las API privadas quedan fuera de la caché. Abrir sin red no garantiza disponer de IA o voz sin modelos locales.
- **Pendiente de equipo real:** instalación Android/Termux, permisos de micrófono, arranque tras reinicio, batería y prueba de los 7 días. No hay tablet conectada a esta sesión.
- **Pendiente de configuración privada:** llave del propietario del dispositivo real, modelo conversacional, STT/TTS y conexiones a servicios que se quieran activar. Los adaptadores existentes no equivalen a servicios ya funcionando.
- **JANUS Work:** necesita el CSS privado aprobado de IBA (`work/skin.lock.json`). Si falta, `/work` devuelve 503; el instalador lo dice y no lo sustituye por otro diseño.
- **Robots y criaturas:** modelos finales y aceptación visual siguen separados y pendientes. No se presentan fixtures ni imágenes 2D como 3D definitivo.

## 1. Preparar la tablet

Instalar [Termux](https://f-droid.org/en/packages/com.termux/) y [Termux:Boot](https://f-droid.org/en/packages/com.termux.boot/) desde la **misma fuente**. Abrir ambas aplicaciones una vez. Quitar restricciones de batería de Termux y Termux:Boot en los ajustes de Samsung.

Fuentes oficiales comprobadas el 17-11-2026: [instalación Termux](https://github.com/termux/termux-app#installation) y [Termux:Boot](https://github.com/termux/termux-boot#usage). La compatibilidad del modelo y Android concretos se valida en el dispositivo.

## 2. Descargar y preparar Janus

Ejecutar en Termux. Se usa **solo** `~/janus-core`; si ya existe, el comando no clona otra carpeta:

```sh
pkg install -y git
if [ ! -d "$HOME/janus-core" ]; then
  git clone --branch main --single-branch https://github.com/jeanechandia-png/janus-core.git "$HOME/janus-core"
fi
JANUS_REF=main sh "$HOME/janus-core/scripts/tablet/install-termux.sh"
```

Si la instalación existente no contiene todavía este instalador, detenerla, guardar los cambios locales y actualizarla por fast-forward a la rama revisada; **nunca** `reset --hard`, `checkout -f`, borrar la carpeta ni crear otra instalación para eludir un conflicto.

El instalador no activa proveedores de pago. Si hay una configuración previa, la conserva. Si se utiliza JANUS Work, poner el archivo **privado** `iba-command-center.css` en `~/janus-secrets/` antes de repetir el instalador; su huella debe coincidir con `work/skin.lock.json`. No publicarlo en este repositorio.

## 3. Arrancar y abrir

```sh
sh "$HOME/janus-core/scripts/tablet/start-janus.sh" &
```

Abrir en Chrome de **esa tablet**: `http://localhost:8787/dashboard/a`. En el menú de Janus, «Instalar app». El acceso instalado abre el dashboard, no una landing. Mantener el mismo origen `localhost` al vincular e instalar: `localhost` y `127.0.0.1` tienen almacenamientos del navegador distintos.

## 4. Vincular al propietario sin editar código

1. En Janus: menú → Controles → «Vincular este dispositivo» → «Descargar llave pública».
2. En Termux, permitir acceso a Descargas y registrar ese archivo:

```sh
termux-setup-storage
cd "$HOME/janus-core"
node scripts/tablet/configure-local.mjs --founder-key "$HOME/storage/downloads/janus-founder-public.pem"
sh scripts/tablet/stop-janus.sh
```

Esperar a que `status.sh` indique «PARADO»; después:

```sh
sh scripts/tablet/start-janus.sh &
```

Volver a Controles y pulsar «Entrar como Founder». La llave privada nunca se descarga. El registro inicial no es Face ID: las acciones que exigen prueba biométrica conservan su comprobación adicional. No reemplazar una llave existente ni borrar SQLite si aparece un conflicto de identidad.

## 5. Comprobar la instalación

```sh
cd "$HOME/janus-core"
npm run tablet:check -- --runtime
sh scripts/tablet/status.sh
```

El diagnóstico comprueba SQLite, archivos, manifiestos y rutas reales; distingue modelo/voz pendientes de configurados. **No afirma una conversación real solo por leer configuración**. Antes de dar el producto por listo, probar acceso, crear un dato, reiniciar y comprobarlo, hablar/escuchar con los servicios elegidos y abrir A/B/Kendra sin conexión. JANUS Work y acceso desde otro equipo requieren además sus dependencias privadas y HTTPS autenticado.

## Actualización automática (orden del Founder, 24-11-2026)

Activada por defecto. El supervisor (`start-janus.sh`) ejecuta `scripts/tablet/update-janus.sh` 2 minutos después de arrancar y luego cada 30 minutos:

1. Descarga `main`. Si hay versión nueva y **continúa** la instalada, avanza (nunca retrocede ni fuerza; con cambios locales sin guardar no toca nada).
2. Reinstala dependencias solo si cambió `package-lock.json` y recompila los dashboards.
3. Si todo va bien, reinicia solo el runtime (unos segundos). La memoria (`~/janus-data`) y las claves (`~/janus-secrets`) no se tocan.
4. Si falla la red, las dependencias o la compilación, sigue la versión en marcha y lo reintenta en la vuelta siguiente. Todo queda en `~/janus-data/logs/janus.log` con la etiqueta `[actualizador]`.

En la pantalla, la app instalada (Founder y Kendra) pregunta por versión nueva cada 30 minutos y al volver a ella, y se recarga sola en un momento tranquilo: con la app oculta o tras 60 segundos sin tocarla (`apps/pwa/pwa-update.js`). Así no corta a Kendra en mitad de un juego.

Variables: `JANUS_UPDATE_EVERY_S` (segundos; `0` lo apaga) y `JANUS_UPDATE_REF` (por defecto `main`). El propio supervisor se renueva al siguiente arranque de la tablet.

**Requisito:** la tablet debe estar instalada desde `main` o desde una versión anterior de `main`. Si se instaló desde la rama de la PR #83, el actualizador lo detecta, no fuerza nada y lo registra («no continúa esta instalación»).

## Actualizar y detener sin perder memoria

```sh
sh "$HOME/janus-core/scripts/tablet/stop-janus.sh"
sh "$HOME/janus-core/scripts/tablet/status.sh"
# Cuando conste PARADO:
JANUS_REF=main sh "$HOME/janus-core/scripts/tablet/install-termux.sh"
sh "$HOME/janus-core/scripts/tablet/start-janus.sh" &
```

Las actualizaciones usan el mismo árbol y rechazan retrocesos o ramas divergentes. SQLite y adjuntos viven en `~/janus-data`; las claves, en `~/janus-secrets`. El supervisor reinicia el proceso si cae, mantiene una sola instancia, libera el wake-lock al parar y conserva las copias diarias existentes. Termux:Boot utiliza las mismas rutas, incluidas las personalizadas.

Piloto físico de 7 días: continuidad sin intervención, copias verificadas, recuperación tras corte de Wi-Fi, arranque después de reiniciar/desbloquear y batería/temperatura observadas. No se declara aprobado desde CI.

## Evidencia reproducible para el siguiente agente

```sh
npm run continuity:guard -- --base=main
npm run dashboard:build
npm run typecheck
npm test
npm run dashboard:test
npm run tablet:test
node tests/runtime-smoke.mjs
node tests/work-runtime-smoke.mjs
node tests/priority-case-runtime.mjs
# Requiere Playwright/Chromium de QA, no se instala en la tablet:
npm run tablet:browser
```

El workflow `Janus Core CI` ejecuta el último flujo en Ubuntu/Chromium: vincular mediante interfaz, descargar y registrar solo la llave pública, autenticar tras reinicio, persistir un caso cifrado y abrir las tres pantallas sin red. Los resultados del HEAD publicado se registran en `docs/STATE.md`; una ejecución no observada sigue pendiente.

## Voces de Jean y Melanie (18 noviembre)

Antes de instalar, descargar la configuración privada `assistant-voices.local.json` facilitada con esta entrega y ejecutar `termux-setup-storage`. El instalador la recoge de Descargas y la guarda en `~/janus-secrets/` con modo 600. La configuración contiene los dos IDs verificados, sin API key ni audio; nunca subirla al repositorio público. Si ya existía una, se conserva.

La clave de ElevenLabs se conecta en la configuración privada del mismo Janus (servicio `elevenlabs` del CredentialBroker). En Controles, entrar como Founder, elegir Janus/Melanie y usar «Probar voz». La salida hablada no necesita STT. El micrófono conversacional completo sigue dependiendo de su reconocimiento configurado. El límite de ambas voces es conjunto y sobrevive a reinicios.
