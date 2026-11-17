# janus-offline · seguir trabajando sin conexión (LEGO 1.0.0)

Una sola llamada y las rutas que declares siguen sirviendo sin red:

```js
JanusOffline.install({
  namespace: 'producto:usuario',
  read:  ['/api/books', /^\/api\/cases/],
  write: [{ match: '/api/books/entries', method: 'POST', kind: 'books.entry', summary: (b) => b.description }],
  headers: () => ({ authorization: 'Bearer ' + token }),
  onChange: ({ online, pending, review, lastSavedAt }) => pintarAviso(),
});
```

- **Leer sin red:** devuelve la última copia y dice de cuándo es (`x-janus-saved-at`).
- **Cambiar sin red:** responde `202 { queued: true }` y lo envía al volver, en orden y sin duplicar (`Idempotency-Key`).
- **Lo delicado no sale solo:** `sensitive: true` o más de 24 h en espera → `pending()` lo muestra y `decide(id, 'send'|'discard')` lo resuelve.
- `clear()` al cerrar sesión.

El servidor debe respetar `Idempotency-Key`. Pareja de servidor: `packages/modules/offline-kit`.
