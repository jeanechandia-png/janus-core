# Disparadores de flujos: programado, webhook firmado y evento

Pieza: `packages/automation/src/trigger-dispatcher.ts` (+ `cron.ts`). Estado: **construida y probada con relojes y servicios simulados; el runtime todavía no la arranca** (en reposo, norma 7: no hay servidor desplegado ni gasto).

## Qué hace
- **Solo flujos publicados** enlazan disparadores. Registrar una revisión nueva desactiva la anterior; un borrador o un histórico no dispara nada. Una ruta de webhook ya usada por otro flujo no se enlaza (evita secuestros).
- **Programado (cron de 5 campos, con zona horaria obligatoria):** sin dependencias; `*`, listas, rangos, pasos, nombres de mes/día; día-del-mes y día-de-la-semana a la vez se combinan con O (como cron clásico). Cambios de hora: una hora local inexistente se **omite** ese día; una hora repetida se dispara **solo la primera vez**.
- **Caídas:** con el cursor guardado en SQLite, tras reiniciar se recupera **un solo** disparo (el último perdido, con `missedSlots`) si no es demasiado tarde (`maxLatenessMin`, por defecto 120, máx. 1440); si lo es, se descarta y se audita. Un flujo nuevo parte «desde ahora». Nunca se solapan dos ejecuciones del mismo disparador.
- **Evento:** tema exacto o con comodín final (`correo.*`); con `id` se desduplica.
- **Sin conexión:** si el nodo tiene `onlineRequired: true`, el disparo se encola en SQLite (tope 500, caduca a las 24 h) y, al reconectar (`flushOffline`), se **revalida** (mismo flujo, misma revisión, publicado y disparador aún enlazado) antes de ejecutarse.
- **El motor** acepta `trigger.nodeId`: arranca solo ese nodo de inicio y omite los demás (un flujo con varios disparadores no arranca por todos a la vez). Un nodo inválido falla antes de reservar la clave de desduplicación.

## Contrato del webhook (para quien lo emita)
- Nodo `trigger.webhook` con `method`, `path` (empieza por `/`, sin `..` ni `//`) y `secretRef` con forma `vault:<nombre>` o `env:<NOMBRE>`. **El secreto nunca va en el flujo, ni en SQLite, ni en el código**; lo resuelve el runtime desde la bóveda.
- Cabecera `x-janus-signature: t=<segundos unix>,v1=<hex>` donde `v1 = HMAC-SHA256(secreto, "<t>.<cuerpo exacto>")` (helper `signWebhook`). Tolerancia de ±5 min (anti-repetición).
- Cabecera opcional `x-janus-delivery-id` (`[A-Za-z0-9._:-]{1,128}`) para desduplicar reintentos; sin ella se usa la huella de marca+cuerpo.
- Respuestas: **401** idéntica para ruta desconocida, método distinto, cuerpo excesivo (256 KB), firma ausente/mala, marca caducada o secreto no disponible (no revela qué rutas existen; el motivo real queda en la auditoría); **400** cuerpo no JSON (ya autenticado); **429** más de 60 entregas/min por webhook (ya autenticado); **202** aceptado (la ejecución sigue en segundo plano; un reintento ya procesado también devuelve 202 y no se repite).
- El cuerpo es **dato**: llega en `{{ $trigger.data }}` y nunca se interpreta como instrucción.
- La capa HTTP debe cortar la lectura del cuerpo en `maxBodyBytes` (el despachador solo comprueba lo que recibe).

## Lo que NO hace todavía (honesto)
- No hay ruta HTTP, temporizador ni almacén de flujos publicados en `apps/runtime/server.ts`; el motor de flujos aún no vive en el runtime. Cableado pendiente (3 llamadas: `register`, `tick` cada ~30 s, `handleWebhook`; `fireEvent` y `flushOffline` al conectar el bus y al reconectar).
- Consulta periódica (`trigger.poll`): no soportada (no hay cursor de consulta); usa programado.
- Un único secreto por webhook (sin rotación con solape); el límite de frecuencia es por proceso y en memoria.
- Relojes y reconexión probados con tiempo inyectado; no se ha probado con temporizadores reales ni en iPhone.
