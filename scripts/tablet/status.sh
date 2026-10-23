#!/data/data/com.termux/files/usr/bin/sh
# JANUS · estado del nodo de la tablet en lenguaje llano. Solo lee; no cambia nada.
HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
DATA_DIR="${JANUS_DATA_DIR:-$HOME_DIR/janus-data}"
PORT="${PORT:-8787}"
LOCK="$DATA_DIR/janus.lock"

PID="$(cat "$LOCK/pid" 2>/dev/null || true)"
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "Supervisor: EN MARCHA (proceso $PID)"; else echo "Supervisor: PARADO"; fi

if command -v curl >/dev/null 2>&1 && HEALTH="$(curl -fsS --max-time 4 "http://127.0.0.1:$PORT/health" 2>/dev/null)"; then
  echo "Janus responde en el puerto $PORT: $HEALTH" | cut -c1-200
else
  echo "Janus NO responde en el puerto $PORT"
fi

LASTBK="$(ls -1t "$DATA_DIR/backups"/janus-*.db 2>/dev/null | head -n 1)"
if [ -n "$LASTBK" ]; then echo "Última copia de la base de datos: $(basename "$LASTBK")"; else echo "Todavía no hay copias de la base de datos"; fi
echo "Espacio libre: $(df -h "$HOME_DIR" 2>/dev/null | awk 'NR==2 {print $4}')"
echo "--- últimas líneas del registro ---"
tail -n 8 "$DATA_DIR/logs/janus.log" 2>/dev/null || echo "(sin registro todavía)"
