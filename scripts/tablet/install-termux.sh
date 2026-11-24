#!/data/data/com.termux/files/usr/bin/sh
# JANUS · nodo doméstico en una tablet Android (Termux). Instalación idempotente: se puede repetir sin romper nada.
# No contiene secretos y NO se activa sola: la ejecuta Jean en la tablet. Gasto: 0 €.
# Variables opcionales: JANUS_REF (rama/etiqueta/SHA, por defecto main), JANUS_APP_DIR, JANUS_DATA_DIR, JANUS_SECRETS_DIR.
set -eu

REPO_URL="${JANUS_REPO_URL:-https://github.com/jeanechandia-png/janus-core.git}"
REF="${JANUS_REF:-main}"
HOME_DIR="${HOME:-/data/data/com.termux/files/home}"
APP_DIR="${JANUS_APP_DIR:-$HOME_DIR/janus-core}"
DATA_DIR="${JANUS_DATA_DIR:-$HOME_DIR/janus-data}"
SECRETS_DIR="${JANUS_SECRETS_DIR:-$HOME_DIR/janus-secrets}"
ENV_FILE="${JANUS_ENV_FILE:-$SECRETS_DIR/janus.env}"

say() { printf '\n== %s\n' "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }

case "${PREFIX:-}" in
  *com.termux*) : ;;
  *) [ "${JANUS_ALLOW_NON_TERMUX:-}" = "1" ] || fail "Esto debe ejecutarse dentro de Termux (instalado desde F-Droid o GitHub), no en otro sistema." ;;
esac

# Comprobar ANTES de descargar o instalar: nunca borrar avances de otro agente.
case "$REPO_URL" in
  https://github.com/jeanechandia-png/janus-core.git|git@github.com:jeanechandia-png/janus-core.git) : ;;
  *) [ "${JANUS_ALLOW_NON_TERMUX:-}" = "1" ] || fail "Solo se instala el repositorio canónico de Janus." ;;
esac
if [ -e "$APP_DIR" ] && [ ! -d "$APP_DIR/.git" ]; then
  [ -z "$(ls -A "$APP_DIR")" ] || fail "La carpeta de Janus ya contiene archivos y no es su repositorio. No se sobrescribe."
fi
if [ -d "$APP_DIR/.git" ]; then
  [ "$(git -C "$APP_DIR" remote get-url origin)" = "$REPO_URL" ] || fail "El repositorio existente tiene otro origen. No se cambia ni se crea una copia."
  [ -z "$(git -C "$APP_DIR" status --porcelain)" ] || fail "Hay trabajo local sin guardar. Se conserva: guarda esos cambios antes de actualizar."
fi
if [ -f "$DATA_DIR/janus.lock/pid" ] && kill -0 "$(cat "$DATA_DIR/janus.lock/pid")" 2>/dev/null; then
  fail "Janus está en marcha. Deténlo con scripts/tablet/stop-janus.sh antes de actualizar."
fi

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
if git -C "$APP_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  TARGET="$(git -C "$APP_DIR" rev-parse FETCH_HEAD)"
  # Un clon superficial puede necesitar más historia para demostrar continuidad.
  if ! git -C "$APP_DIR" merge-base --is-ancestor HEAD "$TARGET"; then
    if [ "$(git -C "$APP_DIR" rev-parse --is-shallow-repository)" = "true" ]; then
      git -C "$APP_DIR" fetch --unshallow origin
    fi
    git -C "$APP_DIR" merge-base --is-ancestor HEAD "$TARGET" || fail "La versión solicitada no continúa esta instalación. No se retrocede ni se fuerza una rama."
  fi
  git -C "$APP_DIR" merge --ff-only "$TARGET"
else
  git -C "$APP_DIR" checkout -q --detach FETCH_HEAD
fi
printf 'Versión instalada: %s\n' "$(git -C "$APP_DIR" rev-parse --short HEAD)"

say "4/6 Instalando dependencias (ws, tsx)"
( cd "$APP_DIR" && npm ci --no-audit --no-fund )
( cd "$APP_DIR" && node --import tsx -e "console.log('tsx: correcto')" ) \
  || fail "tsx no arranca en este Android. Anota el mensaje de arriba: es el dato que hace falta para resolverlo."

say "5/6 Configuración privada y dashboards oficiales"
export JANUS_APP_DIR="$APP_DIR" JANUS_DATA_DIR="$DATA_DIR" JANUS_SECRETS_DIR="$SECRETS_DIR" JANUS_ENV_FILE="$ENV_FILE"
node "$APP_DIR/scripts/tablet/configure-local.mjs"
if [ ! -f "$SECRETS_DIR/assistant-voices.local.json" ]; then
  for VOICES_SRC in "$HOME_DIR/storage/downloads/assistant-voices.local.json" "$HOME_DIR/storage/shared/Download/assistant-voices.local.json"; do
    if [ -f "$VOICES_SRC" ]; then
      cp "$VOICES_SRC" "$SECRETS_DIR/assistant-voices.local.json"
      chmod 600 "$SECRETS_DIR/assistant-voices.local.json"
      printf 'Perfiles privados de voz importados. La credencial se configura solo en este equipo.\n'
      break
    fi
  done
fi
( cd "$APP_DIR" && npm run dashboard:build )
git -C "$APP_DIR" rev-parse HEAD >"$APP_DIR/.git/janus-built"   # el actualizador automático parte de aquí

# JANUS Work: la piel de IBA es privada y no viaja en este repositorio. Si el archivo está en la tablet se instala
# (el propio JANUS comprueba su huella antes de usarlo); si no, /work responde 503 y el resto funciona igual.
SKIN_DEST="$APP_DIR/prototypes/dashboard/local/iba-command-center.css"
for SKIN_SRC in "$SECRETS_DIR/iba-command-center.css" "$HOME_DIR/storage/downloads/iba-command-center.css" "$HOME_DIR/storage/shared/Download/iba-command-center.css"; do
  if [ -f "$SKIN_SRC" ]; then mkdir -p "$(dirname "$SKIN_DEST")"; cp "$SKIN_SRC" "$SKIN_DEST"; printf 'Diseño de JANUS Work instalado desde %s\n' "$SKIN_SRC"; break; fi
done
[ -f "$SKIN_DEST" ] || printf 'Aviso: falta iba-command-center.css (Descargas de la tablet). JANUS Work no se mostrará hasta ponerlo y repetir este instalador.\n'
# Avisos al teléfono: la llave se genera en la tablet y se queda en ella (nunca en el repositorio).
# Carpeta privada de importación (casos prioritarios del Founder): fuera del repositorio; cada archivo se borra al importarlo.
mkdir -p "$SECRETS_DIR/import" && chmod 700 "$SECRETS_DIR/import"
if ! grep -q '^JANUS_PRIVATE_IMPORT_DIR=' "$ENV_FILE" 2>/dev/null; then printf '\nJANUS_PRIVATE_IMPORT_DIR=%s\n' "$SECRETS_DIR/import" >> "$ENV_FILE"; fi

say "6/6 Arranque automático (solo si tienes Termux:Boot instalado)"
# configure-local escribe el arranque con las rutas reales y sin secretos.
( cd "$APP_DIR" && npm run tablet:check )

printf '\nListo. Para arrancar ahora:  sh %s/scripts/tablet/start-janus.sh &\n' "$APP_DIR"
printf 'Para ver el estado:          sh %s/scripts/tablet/status.sh\n' "$APP_DIR"
printf 'Abre en Chrome de esta tablet: http://localhost:8787/dashboard/a\n'
printf 'Primera vez: vincula el dispositivo en «Controles», descarga su llave pública y regístrala con configure-local.mjs --founder-key ARCHIVO.\n'
