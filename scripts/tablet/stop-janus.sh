#!/data/data/com.termux/files/usr/bin/sh
# Para solo el supervisor de esta instalación; no borra memoria ni secretos.
set -eu
DATA_DIR="${JANUS_DATA_DIR:-${HOME}/janus-data}"
LOCK="$DATA_DIR/janus.lock"
PID="$(cat "$LOCK/pid" 2>/dev/null || true)"
case "$PID" in ''|*[!0-9]*) printf 'Janus no tiene un supervisor activo.\n'; exit 0 ;; esac
if kill -0 "$PID" 2>/dev/null; then
  # No mandar señales a un PID reutilizado por otro programa.
  case "$(tr '\000' ' ' < "/proc/$PID/cmdline" 2>/dev/null || true)" in
    *start-janus.sh*) kill -TERM "$PID"; printf 'Parada solicitada. La memoria y las claves se conservan.\n' ;;
    *) printf 'El PID ya no corresponde a Janus; no se detiene otro proceso.\n' >&2; exit 1 ;;
  esac
else
  printf 'Janus ya está parado.\n'
fi
