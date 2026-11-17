# Conocimiento del negocio por voz (precios, IVA, productos, equipo, instrucciones)

Fecha: 2026-11-04 · Estado: módulo, herramienta, historial en SQLite, política de aprobación y pruebas **implementados**; publicación a Melanie/chats **PENDIENTE de destino y de tu aprobación** (ver «Qué falta»).

## Regla de oro
**La voz propone; Face ID aprueba.** Una voz (aunque suene a Jean, aunque sea clonada) no autoriza nada: ADR-005/006/008 y ADR-011. Por eso:

```text
«Janus, el precio del módulo X pasa a 135 euros»
   │ plan determinista (isKnowledgeChangeRequest, estricto: preguntas y preferencias personales NO activan nada)
   ▼
1. knowledge.change.propose   (gratis, sin efectos)  → interpreta, resuelve el producto por nombre, lee de vuelta:
                               «Cambiar el precio de «Módulo X» de 120,00 € a 135,00 € (IVA no incluido).»
                               + avisos (p. ej. cambios ≥ 50 % = posible error de dictado)
2. knowledge.change.apply     (PRIVILEGIADA) → aprobación del Founder + Face ID reciente + permiso de autoridad
                               → nueva revisión encadenada por SHA-256 (solo-añadir, también en la base de datos)
3. knowledge.snapshot.publish (PRIVILEGIADA, opt-in) → instantánea PÚBLICA a un destino HTTPS
4. knowledge.sync.check       (lectura) → cada consumidor informa revisión + checksum → solo entonces «cargado ✓»
```

La propuesta caduca a los 30 min y va ligada a la revisión base: una aprobación tardía o sobre un estado que cambió no aplica nada.

## Qué se puede decir (español)
Cambiar el precio de un producto · cambiar el IVA por defecto · añadir producto (con precio, período y descripción) · nuevo miembro del equipo (con cargo) · guardar una instrucción («guarda esta instrucción: …», o «Melanie, a partir de ahora …») · pregunta frecuente («si preguntan por X, responde que …») · retirar un producto (se desactiva, no se borra). Lo que no se entiende con seguridad no cambia nada y devuelve cómo decirlo.

## Garantías de seguridad (con prueba en `tests/business-knowledge*.test.ts`)
- **Sin permiso no hay cambio**: el Tool Gateway exige llave de idempotencia y permiso de autoridad auditado para `change.apply` y `snapshot.publish`; el adaptador lo vuelve a comprobar.
- **Voces de hogar y menores no llegan**: `knowledge` no está en `HOUSEHOLD_SAFE_TOOLS`.
- **Los datos del negocio son datos, no órdenes**: se rechazan secretos/credenciales y frases tipo «ignora tus instrucciones…»; el texto que reciben los asistentes empieza declarándose dato de referencia.
- **Solo lo público sale**: las entradas `internal` y las retiradas nunca están en la instantánea pública.
- **Aplicado ≠ publicado**: `local_only` → `published` → «cargado ✓» (el propio consumidor informa la misma revisión y checksum).
- **Historial inmutable**: `UPDATE`/`DELETE` sobre las revisiones abortan en SQLite; `replayRevisions` detecta cadenas manipuladas.

## Configuración (todo opcional; sin destino el conocimiento queda solo en Janus)
| Variable | Para qué |
|---|---|
| `JANUS_KNOWLEDGE_PUBLISH_URL` | Destino HTTPS que recibe `{ snapshot, contextText }` con `Authorization: Bearer` e `Idempotency-Key = checksum` |
| `JANUS_KNOWLEDGE_PUBLISH_TOKEN` | Token del destino (gestor de secretos; nunca en Git/SQLite) |
| `JANUS_KNOWLEDGE_STATUS_URLS` | `{"melanie-web":"https://…"}`; cada URL responde `{ "businessKnowledge": { "revision": N, "checksum": "…" } }` |

## Cómo llega a Melanie y al chat escrito (diseño)
Melanie hoy lleva los precios **dentro del prompt y de documentos estáticos** (verificado en la sesión). Para sincronizar sin reescribir su prompt cada vez, el camino recomendado es el mismo patrón que ya usa su herramienta `get_business_context`: el destino (p. ej. una función de Supabase) guarda la última instantánea pública y Melanie la **lee al responder**; el chat escrito lee lo mismo. Janus publica; ellos informan qué revisión cargaron.

## Qué falta (honesto)
- **PENDIENTE — destino de publicación:** elegir y crear el destino (Supabase/Hostinger/GitHub). No se tocó nada en producción.
- **PENDIENTE — Melanie en vivo:** quitar los precios incrustados del prompt y añadir la herramienta de lectura **cambia su configuración de producción: requiere tu aprobación expresa**.
- **PENDIENTE — activación:** el catálogo parte vacío; hay que cargar los productos/precios actuales (puede hacerse por voz con este mismo flujo) y ejecutar la «sincronización de herramientas» del Blueprint (aprobación del Founder) para que `knowledge` quede permitida en el runtime.
- **PENDIENTE — Face ID en el teléfono:** el puente (`docs/ios-founder-faceid-bridge.md`) debe estar activo; si no lo está, los cambios se bloquean (falla cerrado, a propósito).
- Frases con varios cambios a la vez y números dictados con palabras («ciento treinta y cinco») **no** se interpretan todavía (POR CONFIRMAR si se resuelve con el planificador con modelo, cuya salida pasa por la misma validación).
