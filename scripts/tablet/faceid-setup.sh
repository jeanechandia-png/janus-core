#!/data/data/com.termux/files/usr/bin/sh
# JANUS · abre durante 10 minutos el alta de la llave de acceso del CEO (Face ID del navegador) y la vuelve a cerrar.
# Uso:  sh faceid-setup.sh https://la-direccion-de-su-janus
# No contiene secretos. La primera llave solo se puede crear mientras esta ventana está abierta.
set -eu

HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
SECRETS_DIR="${JANUS_SECRETS_DIR:-$HOME_DIR/janus-secrets}"
ENV_FILE="${JANUS_ENV_FILE:-$SECRETS_DIR/janus.env}"
WINDOW="${JANUS_FACEID_WINDOW_SECONDS:-600}"
ORIGIN="${1:-}"

[ -f "$ENV_FILE" ] || { printf 'ERROR: no existe %s. Ejecuta primero install-termux.sh\n' "$ENV_FILE" >&2; exit 1; }
case "$ORIGIN" in
  "") : ;;
  https://*) : ;;
  *) printf 'ERROR: la dirección debe empezar por https://\n' >&2; exit 1 ;;
esac

set_env() {
  TMP="$ENV_FILE.tmp.$$"
  grep -v "^$1=" "$ENV_FILE" > "$TMP" || true
  printf '%s=%s\n' "$1" "$2" >> "$TMP"
  chmod 600 "$TMP"
  mv "$TMP" "$ENV_FILE"
}
restart() { pkill -f "scripts/start-local.mjs" 2>/dev/null || true; }
close_window() { set_env JANUS_ALLOW_PASSKEY_BOOTSTRAP false; restart; printf '\nAlta de Face ID CERRADA de nuevo.\n'; }

[ -n "$ORIGIN" ] && set_env JANUS_PASSKEY_ORIGINS "${ORIGIN%/}"
set_env JANUS_ALLOW_PASSKEY_BOOTSTRAP true
trap close_window EXIT
trap 'exit 130' INT TERM
restart
printf 'Alta de Face ID ABIERTA durante %s segundos.\n' "$WINDOW"
printf 'En el iPhone: abra la vista de equipo de JANUS, sección «Accesos», y pulse «Activar Face ID».\n'
printf 'Cuando termine puede pulsar Ctrl+C aquí: se cierra sola en cualquier caso.\n'
sleep "$WINDOW"
