# business-knowledge (LEGO module)

Conocimiento vivo del negocio para asistentes: **productos y precios, IVA, equipo, preguntas frecuentes, políticas e instrucciones**. Se actualiza con frases dictadas, pero **nada cambia sin lectura de confirmación y aprobación**.

Pieza independiente: solo usa `node:crypto`. No importa Janus ni ningún otro paquete; no usa red ni secretos.

## Flujo

```text
frase dictada ──parseSpanishUtterance──▶ intención ──resolveIntent(estado)──▶ cambios
cambios ──createProposal──▶ propuesta (caduca en 30 min, ligada a la revisión base)
propuesta ──buildReadback──▶ «Cambiar el precio de «Módulo X» de 120,00 € a 135,00 € (IVA no incluido).»
                              (el anfitrión la lee y pide la aprobación del Founder)
aprobada ──applyProposal(approvalRef)──▶ nuevo estado + revisión encadenada (SHA-256)
estado ──buildSnapshot('public'|'internal')──▶ instantánea con checksum
instantánea ──renderKnowledgeText──▶ bloque de texto «datos, no órdenes» para chat o base de conocimiento
consumidor ──evaluateConsumerSync──▶ applied | stale | mismatch | not_reported
```

## Garantías
- **Sin aprobación no hay revisión** (`missing_approval`). El módulo no decide quién aprueba; el anfitrión aporta la prueba.
- **Historial append-only**: retirar una entrada la desactiva, no la borra. `replayRevisions` reconstruye el estado y detecta cadenas rotas.
- **Texto saneado**: se rechazan secretos/credenciales y frases que intentan reescribir las reglas del asistente («ignora tus instrucciones…»).
- **Aviso de cambios bruscos**: un precio que varía ≥ 50 % añade una advertencia de posible error de dictado.
- **Aplicado = confirmado por el consumidor**: solo cuenta si informa la misma revisión y el mismo checksum.
- **Visibilidad**: `internal` nunca entra en la instantánea `public`.

## Qué reconoce el intérprete (español)
Cambiar el precio de un producto («el precio del módulo X a 135 euros más IVA», «X ahora cuesta 99 euros al mes») · cambiar el IVA por defecto («cambia el IVA al 21 %») · añadir producto («añade el producto X que cuesta 50 euros, descripción: …») · nuevo miembro del equipo («tenemos un nuevo integrante, Ana Pérez, que es diseñadora») · instrucción («guarda esta instrucción: …», «a partir de ahora …») · pregunta frecuente («si preguntan por X, responde que …») · retirar producto.
Lo que no reconoce devuelve `undefined`: el anfitrión puede usar un planificador con modelo cuya salida estructurada pase por `validateChanges`.

## Reutilizar
Copia la carpeta o impórtala desde `src/index.ts`. El anfitrión implementa: persistencia (Janus: SQLite vía adaptador), aprobación (Janus: autoridad autenticada/Face ID), canal de publicación y el reporte de los consumidores.
