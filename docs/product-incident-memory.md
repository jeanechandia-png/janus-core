# Memoria transversal de incidencias

Se extiende ErrorLedger, cronología y SQLite de Janus. No hay otro Janus, producto, backend ni repositorio.

- Fuente editable única de ChatBox: config/product-incidents.json en su rama autorizada.
- Copia de arranque: config/product-incident-bootstrap.json es una instantánea sanitizada con referencia al commit fuente; no es una fuente editable de verdad.
- Runtime: importa al arrancar, antes de planificar y cada cinco minutos mientras Janus está en ejecución.
- Fuente GitHub por repositorio/rama/ruta explícitos; usa el broker existente. Sin credencial se conserva memoria y se informa needs_auth. No se crean permisos, claves ni costes.
- Una sincronización correcta acredita la lectura del registro, no la salud del producto. Quince minutos sin lectura correcta producen stale; un fallo no renueva frescura.
- Los demás productos del catálogo aparecen not_connected, no como saludables ni conocidos en tiempo real. Se conectan declarando una fuente del mismo contrato; no se reconstruye Janus.
- GET /api/operations/incidents exige sesión Founder. El planificador recibe un resumen limitado a veinte incidencias prioritarias más el estado de cada fuente.
- Una incidencia se identifica por producto + ID; una revisión actualiza conocimiento sin incrementar reincidencias. Una nueva ocurrencia con la misma huella incrementa ErrorLedger y exige revisión de la protección anterior.
- No se permite quitar una incidencia, cambiar su huella, retroceder revisiones o reescribir el contenido de una revisión existente.
- Importación transaccional: un fallo no deja memoria parcialmente escrita. Historial completo conservado; lectura específica de últimas revisiones evita depender del límite general de la cronología.
- Los registros importados siempre son DATA. Ningún estado resuelto reportado se convierte en verificación independiente de runtime, autorización o despliegue. ErrorLedger no los marca verificados automáticamente.
- Contrato sin mensajes, teléfonos, emails, tokens o campos arbitrarios. Referencias HTTPS a evidencia GitHub sin credenciales/query.

## Evidencia y límites

Las pruebas nuevas cubren persistencia tras reinicio, idempotencia, actualización sin falsa reincidencia, escalado por nueva ocurrencia, cierre sin evidencia, borrado/reescritura, rollback transaccional, frescura, fallo de credenciales y GET limitado al proveedor correcto. El smoke recorre arranque real → denegación sin sesión → lectura Founder con tres incidencias.

Registrar en código y pasar CI no activa un servicio 24/7 en un equipo apagado ni configura credenciales ausentes. No afirmar monitorización en producción sin ejecución y lectura verificadas.

La incidencia WhatsApp de ChatBox permanece abierta y la de acceso mitigada. Las autorizaciones pendientes no se conceden por registrar este aprendizaje.
