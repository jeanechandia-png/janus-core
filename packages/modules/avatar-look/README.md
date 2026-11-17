# avatar-look · Vestir y personalizar un personaje

Pieza LEGO reutilizable. Catálogo **cerrado** de 15 colores, 5 colores de ojos, 6 prendas y 17 accesorios en 4 zonas (cabeza, cara, cuello, espalda).

## API
- `defaultLook(base?)`, `sanitizeLook(raw, base?)`, `applyLookChange(look, cambio)` (puro; lanza si el valor no está en el catálogo).
- `reactionTo(cambio, look)`: frase corta de reacción del personaje (sin género y sin hablar de cuerpos).
- `randomLook(base, rnd, allow)`: «sorpréndeme» limitado a lo que ya se tiene (`allow` recibe claves `out:…` / `acc:zona:…`).
- `lookItems()`, `outfitKey()`, `accessoryKey()`: el catálogo con precio en estrellas para que `star-shop` lo venda.

## Límites
- Solo describe el aspecto; el dibujo en 3D lo hace el anfitrión (LEGO `janus-creatures-3d` en el dashboard).
- Es **estético**: no cambia el carácter del personaje.
