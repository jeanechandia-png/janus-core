#!/data/data/com.termux/files/usr/bin/sh
# JANUS · supervisor para la tablet: mantiene el runtime encendido, lo reinicia si se cae (con espera creciente),
# rota el registro y hace la copia diaria de la base de datos. Una sola instancia a la vez.
# Variables opcionales: PORT, JANUS_APP_DIR, JANUS_DATA_DIR, JANUS_SECRETS_DIR, JANUS_BACKUP_EVERY_S (0 = sin copias),
# JANUS_RESTART_MAX_S (espera máxima entre reinicios, por defecto 120).
set -u

HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${JANUS_APP_DIR:-$HOME_DIR/janus-core}"
DATA_DIR="${JANUS_DATA_DIR:-$HOME_DIR/janus-data}"
SECRETS_DIR="${JANUS_SECRETS_DIR:-$HOME_DIR/janus-secrets}"
LOG="$DATA_DIR/logs/janus.log"
LOCK="$DATA_DIR/janus.lock"
BACKUP_EVERY="${JANUS_BACKUP_EVERY_S:-86400}"
RESTART_MAX="${JANUS_RESTART_MAX_S:-120}"
MAX_LOG_BYTES=5242880

mkdir -p "$DATA_DIR/logs" "$DATA_DIR/backups"
log() { printf '%s [supervisor] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$LOG"; }
rotate_log() {
  if [ -f "$LOG" ] && [ "$(wc -c <"$LOG")" -gt "$MAX_LOG_BYTES" ]; then mv -f "$LOG" "$LOG.1"; fi
}

# Una sola instancia: si el candado existe y su proceso sigue vivo, no se arranca otra.
if ! mkdir "$LOCK" 2>/dev/null; then
  OLD="$(cat "$LOCK/pid" 2>/dev/null || true)"
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then
    echo "Janus ya está en marcha (proceso $OLD)."
    exit 0
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK"
fi
echo $$ >"$LOCK/pid"

CHILD=""
BACKUPPER=""
cleanup() {
  [ -n "$BACKUPPER" ] && kill "$BACKUPPER" 2>/dev/null
  [ -n "$CHILD" ] && kill "$CHILD" 2>/dev/null
  rm -rf "$LOCK"
}
trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

# Mantiene la CPU despierta mientras Janus corre (comando de Termux; si no existe, se sigue sin él).
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

export JANUS_ENV_FILE="${JANUS_ENV_FILE:-$SECRETS_DIR/janus.env}"
export PORT="${PORT:-8787}"
cd "$APP_DIR" || { log "no existe $APP_DIR: ejecuta primero install-termux.sh"; exit 1; }

if [ "$BACKUP_EVERY" -gt 0 ] 2>/dev/null; then
  (
    sleep 600   # la primera copia, 10 minutos después de arrancar
    while :; do
      node "$APP_DIR/scripts/tablet/backup-db.mjs" >>"$LOG" 2>&1
      rotate_log
      sleep "$BACKUP_EVERY"
    done
  ) &
  BACKUPPER=$!
fi

DELAY=5
log "arrancando (puerto $PORT, versión $(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo desconocida))"
while :; do
  rotate_log
  STARTED="$(date +%s)"
  node "$APP_DIR/scripts/start-local.mjs" >>"$LOG" 2>&1 &
  CHILD=$!
  wait "$CHILD"
  CODE=$?
  CHILD=""
  RAN=$(( $(date +%s) - STARTED ))
  if [ "$RAN" -ge 300 ]; then DELAY=5; else DELAY=$(( DELAY * 2 )); [ "$DELAY" -gt "$RESTART_MAX" ] && DELAY="$RESTART_MAX"; fi
  log "el runtime terminó (código $CODE tras ${RAN}s); reinicio en ${DELAY}s"
  sleep "$DELAY" &   # en segundo plano + wait: así una orden de parada se atiende al instante
  wait $!
done
