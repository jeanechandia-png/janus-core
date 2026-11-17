# offline-kit · trabajar sin internet (LEGO 1.0.0)

Cuatro piezas pequeñas e independientes para que un producto siga siendo útil sin conexión y vuelva a sincronizar sin sorpresas.

| Parte | Para qué |
|---|---|
| `recordProbe` | Saber si hay conexión sin «parpadear» por un fallo suelto. |
| `evaluateCapabilities` / `offlineSummary` | Decir **exactamente** qué funciona sin internet, qué funciona a medias y qué no. Es la única fuente para pantallas y textos de venta. |
| `enqueue` · `revalidate` · `dueItems` · `settle` · `decide` | Bandeja de salida: los cambios hechos sin conexión se guardan y se envían después, sin duplicar. Lo delicado o lo viejo **vuelve a pedir confirmación**. |
| `freshness` | Enseñar datos guardados diciendo de cuándo son. |

```ts
import { offlineSummary, enqueue, revalidate, dueItems, settle } from './src/index.js';
const { works, degraded, unavailable } = offlineSummary(misCapacidades, { local_model: false });
let outbox = [enqueue([], { id: 'c_1', kind: 'note.create', summary: 'Nota', payload: { text: 'hola' }, now })];
outbox = revalidate(outbox, now);                       // al volver la conexión
for (const item of dueItems(outbox, now)) { /* enviar */ }
```

No guarda nada, no toca la red y no lee el reloj: todo eso lo hace el producto anfitrión.
