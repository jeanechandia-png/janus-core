# Nodo de Janus en la tablet Samsung (piloto temporal, solo Janus)

**Decisión de Jean (2026-10-23):** la tablet Samsung se usa **temporalmente y solo para Janus**, hasta tener un equipo propio que pueda estar siempre encendido.
**Fuera de alcance, sin cambios:** Infinity ChatBox (3 Kings) e IBA siguen como estaba previsto (hosting propio/Hostinger). Nada de clientes va a la tablet.
**Coste:** 0 € (hardware ya existente; Tailscale Personal es gratuito y de uso no comercial; Janus es asistente personal). Norma 7: no se compra nada.

## Qué se verificó (HECHO VERIFICADO)
- El núcleo usa `node:sqlite` (SQLite integrado en Node) y una sola dependencia de ejecución (`ws`); `tsx` solo arranca el TypeScript. No hay nada que compilar para Android.
- Termux publica `nodejs-lts` 24.18.0 y `nodejs` 26.4.0, ambos construidos con `--shared-sqlite` (fuente: `termux-packages/packages/nodejs*/build.sh`, 2026-10-23).
- Con Node 24.22.1: `npm test` 574 pruebas → 573 correctas, 0 fallos, 1 omitida; `tests/runtime-smoke.mjs` («runtime smoke ok», arranque real del servidor con autorización) y `tests/tablet-kit.test.ts` 5/5.
- **No verificado:** que el instalador funcione en el Android real de la tablet (modelo y versión por confirmar); que `tsx`/esbuild arranque ahí; autonomía de batería con Termux despierto.

## Qué hace el paquete (`scripts/tablet/`)
| Archivo | Función |
|---|---|
| `install-termux.sh` | Instala Node LTS y git, descarga Janus (`JANUS_REF`, por defecto `main`), instala dependencias, comprueba `node:sqlite` y `tsx`, crea carpetas privadas y un `janus.env` **sin secretos** (modo 600), y deja el arranque automático para Termux:Boot. Se puede repetir. |
| `start-janus.sh` | Supervisor: una sola instancia, mantiene la CPU despierta, reinicia el runtime si se cae (espera 5 s → 120 s), rota el registro (5 MB) y hace la copia diaria. |
| `backup-db.mjs` | Copia consistente de SQLite (`VACUUM INTO`) verificada con `integrity_check`; conserva 7. El envío a Drive (`JANUS_BACKUP_RCLONE_REMOTE`) está **inactivo** hasta que Jean autorice y configure un destino cifrado. |
| `status.sh` | Estado en lenguaje llano: ¿corre?, ¿responde `/health`?, última copia, espacio libre, últimas líneas del registro. Solo lee. |

La base de datos vive en `~/janus-data/` y los secretos en `~/janus-secrets/` (fuera del repositorio, nunca en SQLite ni en el código).

## Pasos en la tablet (copiar y pegar)
1. Instala **F-Droid** y, desde él, **Termux** y **Termux:Boot** (no uses la versión de Google Play: el propio README de Termux la marca como experimental y con fallos). Instala también **Tailscale**.
2. Ajustes de Samsung (los nombres cambian según la versión de One UI): Batería → Termux y Termux:Boot en «Sin restricciones»; quitar Termux de «Apps en suspensión»; si existe «Proteger batería» (límite del 85 %), actívalo; Wi-Fi: mantener activo durante la suspensión. Pon la tablet sin funda y en un sitio ventilado.
3. Abre Termux y pega:
   ```sh
   pkg install -y git && git clone --depth 1 -b claude/tablet-nodo-janus https://github.com/jeanechandia-png/janus-core.git ~/janus-core && JANUS_REF=claude/social-accounts-watch sh ~/janus-core/scripts/tablet/install-termux.sh
   ```
   (Mientras la pila de PR no esté fusionada, `JANUS_REF` apunta a la rama con todo el trabajo; después se cambia a `main`.)
4. Arranca y comprueba:
   ```sh
   sh ~/janus-core/scripts/tablet/start-janus.sh &
   sh ~/janus-core/scripts/tablet/status.sh
   ```
5. Abre en el navegador de la propia tablet `http://localhost:8787`: `localhost` cuenta como entorno seguro, así que la app de Janus puede iniciar sesión ahí.

## Acceso desde el iPhone (PENDIENTE de resolver en la fase 2)
- Con Tailscale en la tablet y en el iPhone, el iPhone puede llegar a `http://<IP-de-Tailscale-de-la-tablet>:8787` sin abrir puertos del router.
- **Riesgo (INFERENCIA, por confirmar):** la app de Janus usa criptografía del navegador para iniciar sesión y vincular el dispositivo; fuera de `localhost` eso exige **HTTPS**. El diseño actual ya prevé un proxy HTTPS de confianza (`JANUS_AUTH_TRUST_SECURE_PROXY`, ver `docs/ios-founder-faceid-bridge.md`). Opciones: (a) HTTPS de Tailscale (MagicDNS + Serve), (b) Cloudflare Tunnel gratuito (expone un nombre público: requiere aprobación de Jean), (c) seguir solo con la tablet hasta resolverlo.
- El puerto 8787 escucha en todas las interfaces de la tablet (`0.0.0.0`): dentro del Wi-Fi de casa es alcanzable, protegido por la autorización de Janus. **No se abre ningún puerto en el router.** Endurecimiento opcional futuro: variable `JANUS_HOST` para escuchar solo en la IP de Tailscale (requiere un cambio pequeño en `apps/runtime/server.ts`).

## Corte de luz y de internet
| Situación | Qué pasa |
|---|---|
| Se va la luz | Lo normal es que el router también se apague (salvo que tenga batería): **sin internet**. La tablet sigue con su batería. |
| Tablet con batería, sin internet | Janus sigue funcionando en local y **no pierde nada** (SQLite en disco). No se puede llegar a ella desde el iPhone y fallan las llamadas externas (correo, calendario, clima, modelos). Janus las deja en cola y las **revalida al volver la conexión**. |
| Vuelve la luz | La tablet carga, el router arranca, el Wi-Fi y Tailscale se reconectan solos y Janus continúa. |
| La batería llegó a 0 | La tablet se apaga. Al encenderla hay que **desbloquearla una vez** (INFERENCIA: Termux:Boot arranca tras el primer desbloqueo); entonces Janus arranca solo. |
| Urgente durante el corte | Si el iPhone tiene datos móviles: «Punto de acceso» del iPhone, conectar la tablet a él y entrar por Tailscale (por probar). |
| Más adelante (gasto al final, Norma 7) | SAI pequeño para el router y el equipo definitivo; no se compra ahora. |

## Seguridad (mínimo privilegio)
- Sin secretos en el paquete ni en SQLite; `janus.env` (600) en carpeta 700. Pantalla con bloqueo y cifrado del dispositivo.
- No se abre ningún puerto en el router. Las acciones externas sensibles siguen exigiendo la aprobación de Jean (cola de aprobaciones del núcleo).
- Las copias contienen datos personales: solo en la tablet; si se envían a Drive, con destino **cifrado** (rclone crypt) y con autorización previa.
- Tailscale Personal es de uso no comercial: vale para Janus personal; si el nodo atendiera a Infinity, habría que revisar la licencia (POR CONFIRMAR).

## Piloto de 7 días (criterios para decidir)
1. Janus encendido los 7 días sin intervención (`status.sh` en marcha cada vez que se mire).
2. Al menos 6 copias verificadas en `~/janus-data/backups/`.
3. Prueba de corte simulado: apagar el Wi-Fi 10 minutos y encenderlo → Janus sigue y se recupera.
4. Prueba de reinicio: reiniciar la tablet, desbloquear una vez → Janus vuelve solo.
5. Batería y temperatura razonables (sin hinchazón, sin calor anormal).
Si falla alguno, no se pierde nada: se detiene con `pkill -f start-janus.sh` y los datos quedan en `~/janus-data/`.

## Cómo volver atrás
`pkill -f start-janus.sh` y borrar `~/.termux/boot/janus-start.sh`. Los datos y secretos no se tocan.
