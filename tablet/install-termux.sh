#!/data/data/com.termux/files/usr/bin/sh
# Atajo: la misma instalación oficial de JANUS en la tablet (scripts/tablet/install-termux.sh).
# Existe para que la dirección corta .../main/tablet/install-termux.sh también funcione. No contiene lógica propia.
exec sh -c 'curl -fsSL https://raw.githubusercontent.com/jeanechandia-png/janus-core/main/scripts/tablet/install-termux.sh | sh'
