#!/data/data/com.termux/files/usr/bin/sh
# JANUS · nodo doméstico en una tablet Android (Termux). Instalación idempotente: se puede repetir sin romper nada.
# No contiene secretos y NO se activa sola: la ejecuta Jean en la tablet. Gasto: 0 €.
# Variables opcionales: JANUS_REF (rama/etiqueta, por defecto main), JANUS_REPO_URL, JANUS_APP_DIR, JANUS_DATA_DIR, JANUS_SECRETS_DIR.
set -eu

REPO_URL="${JANUS_REPO_URL:-https://github.com/jeanechandia-png/janus-core.git}"
REF="${JANUS_REF:-main}"
HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${JANUS_APP_DIR:-$HOME_DIR/janus-core}"
DATA_DIR="${JANUS_DATA_DIR:-$HOME_DIR/janus-data}"
SECRETS_DIR="${JANUS_SECRETS_DIR:-$HOME_DIR/janus-secrets}"
ENV_FILE="$SECRETS_DIR/janus.env"

say() { printf '\n== %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

case "${PREFIX:-}" in
  *com.termux*) : ;;
  *) [ "${JANUS_ALLOW_NON_TERMUX:-}" = "1" ] || fail "Esto debe ejecutarse dentro de Termux (instalado desde F-Droid o GitHub), no en otro sistema." ;;
esac

if [ "${JANUS_SKIP_PKG:-}" != "1" ]; then
  say "1/6 Programas del sistema (Node, git, curl)"
  pkg update -y
  pkg install -y nodejs-lts git curl
fi

say "2/6 Comprobando Node y su SQLite integrado"
node -e "const major = Number(process.versions.node.split('.')[0]); if (major < 22) { console.error('Node ' + process.versions.node + ' es demasiado antiguo (se necesita 22 o superior)'); process.exit(2); } require('node:sqlite'); console.log('Node ' + process.versions.node + ' con node:sqlite: correcto');" \
  || fail "Node no cumple los requisitos. Comprueba que Termux viene de F-Droid o GitHub (no de Google Play)."

say "3/6 Descargando Janus ($REF)"
if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$APP_DIR"
  git -C "$APP_DIR" init -q
  git -C "$APP_DIR" remote add origin "$REPO_URL"
fi
git -C "$APP_DIR" fetch --depth 1 origin "$REF"
git -C "$APP_DIR" checkout -q -f -B janus-tablet FETCH_HEAD
printf 'Versión instalada: %s\n' "$(git -C "$APP_DIR" rev-parse --short HEAD)"

say "4/6 Instalando dependencias (ws, tsx)"
( cd "$APP_DIR" && npm install --no-audit --no-fund )
( cd "$APP_DIR" && node --import tsx -e "console.log('tsx: correcto')" ) \
  || fail "tsx no arranca en este Android. Anota el mensaje de arriba: es el dato que hace falta para resolverlo."

say "5/6 Carpetas privadas y configuración"
mkdir -p "$DATA_DIR/logs" "$DATA_DIR/backups" "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  # Solo se ajusta dónde vive la base de datos; ningún secreto se escribe aquí.
  sed -i "s|^JANUS_DB=.*|JANUS_DB=$DATA_DIR/janus.db|" "$ENV_FILE"
  sed -i "s|^JANUS_TIME_ZONE=.*|JANUS_TIME_ZONE=Europe/Amsterdam|" "$ENV_FILE"
  printf 'Creado %s (vacío de secretos).\n' "$ENV_FILE"
else
  printf 'Ya existía %s: no se toca.\n' "$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

say "6/6 Arranque automático (solo si tienes Termux:Boot instalado)"
mkdir -p "$HOME_DIR/.termux/boot"
cat > "$HOME_DIR/.termux/boot/janus-start.sh" <<BOOT
#!/data/data/com.termux/files/usr/bin/sh
# Lo ejecuta Termux:Boot al encender la tablet (después de desbloquearla una vez).
sh "$APP_DIR/scripts/tablet/start-janus.sh" >/dev/null 2>&1 &
BOOT
chmod 700 "$HOME_DIR/.termux/boot/janus-start.sh"

printf '\nListo. Para arrancar ahora:  sh %s/scripts/tablet/start-janus.sh &\n' "$APP_DIR"
printf 'Para ver el estado:          sh %s/scripts/tablet/status.sh\n' "$APP_DIR"
