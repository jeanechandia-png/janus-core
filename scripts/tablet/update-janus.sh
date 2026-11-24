#!/data/data/com.termux/files/usr/bin/sh
# JANUS · actualización automática de la tablet (orden del Founder, 24-nov-2026: «mi sí es sí»).
# La lanza el supervisor (start-janus.sh) cada JANUS_UPDATE_EVERY_S. Mismas reglas que el instalador:
#   solo el repositorio canónico, solo avance rápido (nunca retrocede ni fuerza), nunca toca trabajo local sin guardar,
#   la memoria (~/janus-data) y las claves (~/janus-secrets) no se tocan.
# Códigos de salida: 0 = actualizado (el supervisor reinicia el runtime), 10 = ya al día, 20 = no se actualiza
#   (sin red, cambios locales, rama divergente…), 30 = actualizado pero la compilación falló (sigue la versión en marcha).
set -u

HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${JANUS_APP_DIR:-$HOME_DIR/janus-core}"
REF="${JANUS_UPDATE_REF:-main}"
REPO_URL="${JANUS_REPO_URL:-https://github.com/jeanechandia-png/janus-core.git}"

say() { printf '%s [actualizador] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"; }
g() { git -C "$APP_DIR" "$@"; }

[ -d "$APP_DIR/.git" ] || { say "no hay instalación en $APP_DIR"; exit 20; }
[ "$(g remote get-url origin 2>/dev/null)" = "$REPO_URL" ] || { say "el origen no es el repositorio canónico: no se actualiza"; exit 20; }
[ -z "$(g status --porcelain)" ] || { say "hay cambios locales sin guardar: se conservan y no se actualiza"; exit 20; }

# Última versión compilada con éxito (dentro de .git: no ensucia el árbol). Si una compilación falló, se reintenta.
BUILT_FILE="$APP_DIR/.git/janus-built"
BUILT="$(cat "$BUILT_FILE" 2>/dev/null || echo none)"

if g fetch -q --depth 1 origin "$REF" 2>/dev/null; then
  TARGET="$(g rev-parse FETCH_HEAD)"
  if [ "$(g rev-parse HEAD)" != "$TARGET" ]; then
    if ! g merge-base --is-ancestor HEAD "$TARGET" 2>/dev/null; then
      [ "$(g rev-parse --is-shallow-repository)" = "true" ] && g fetch -q --unshallow origin 2>/dev/null
      g merge-base --is-ancestor HEAD "$TARGET" 2>/dev/null || { say "la versión publicada no continúa esta instalación: no se retrocede ni se fuerza"; exit 20; }
    fi
    OLD="$(g rev-parse --short HEAD)"
    g merge -q --ff-only "$TARGET" || { say "no se pudo avanzar: se queda la versión actual"; exit 20; }
    say "versión $OLD → $(g rev-parse --short HEAD)"
  fi
else
  say "sin conexión con GitHub: se intentará más tarde"
fi

HEAD_NOW="$(g rev-parse HEAD)"
[ "$HEAD_NOW" = "$BUILT" ] && exit 10
if [ "$BUILT" = "none" ] || [ "$(g rev-parse -q --verify "$BUILT:package-lock.json" 2>/dev/null || echo none)" != "$(g rev-parse -q --verify HEAD:package-lock.json 2>/dev/null || echo none)" ]; then
  ( cd "$APP_DIR" && npm ci --no-audit --no-fund ) || { say "fallaron las dependencias: sigue la versión en marcha; se reintenta en la próxima vuelta"; exit 30; }
fi
( cd "$APP_DIR" && npm run -s dashboard:build ) || { say "falló la compilación de los dashboards: sigue la versión en marcha; se reintenta en la próxima vuelta"; exit 30; }
printf '%s\n' "$HEAD_NOW" >"$BUILT_FILE"
say "lista la versión $(g rev-parse --short HEAD): se reinicia Janus"
exit 0
