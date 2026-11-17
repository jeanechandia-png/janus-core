# star-shop · Estrellas, tienda e inventario

Pieza LEGO reutilizable. Casas (4), vehículos (5) y decoración (5) de serie; el producto añade los suyos (`createShop(extras)`).

## Reglas de diseño (RECOMENDACIÓN, pendiente de revisión profesional)
- Las estrellas premian **esfuerzo y aprendizaje**: `acierto` 1, `esfuerzo` 1, `leccion` 2, `social` 2, `racha` 3.
- **Tope diario** de 12; mismo evento no se premia dos veces (`eventId`).
- Sin castigos, sin temporizadores, sin escasez, sin dinero real.

## API
`earn`, `owns`, `createShop(extras)` → `{ newWorld, sanitize, buy, setHome, setVehicle, toggleDecor, item, catalog }`. Todo puro; el día es un parámetro.

## Evidencia
- **POR CONFIRMAR:** no se ha verificado evidencia primaria de que una economía de estrellas en una app funcione como los sistemas de puntos que recomienda la guía AAP 2019 (Pediatrics 144(4):e20192528) para la conducta en casa y en la escuela. Antes de uso continuado, revisión por un profesional.
