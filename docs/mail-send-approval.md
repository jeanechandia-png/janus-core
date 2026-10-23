# Enviar un correo con tu aprobación exacta

Piezas: acción de solo lectura `gmail.draft.preview` y envío `gmail.draft.send` en `packages/adapters/src/google-workspace-write-adapter.ts`; plantilla `correo-enviar-aprobado` en `packages/automation/src/flow-templates.ts`; tarjeta de aprobación en `packages/orchestrator/src/mail-send-approval.ts`. Estado: **construido y probado con un Gmail simulado; nada se ha enviado ni se envía solo** (el runtime no arranca flujos y el conector real necesita el cliente OAuth de Jean → en reposo, norma 7).

## Qué garantiza
- **Lo que apruebas es lo que sale.** `gmail.draft.preview` lee el borrador (solo `GET`, nunca escribe) y devuelve destinatarios **Para, Cc y Cco** (minúsculas, ordenados, sin nombres), asunto decodificado, texto normalizado y su huella `bodySha256`. `gmail.draft.send` vuelve a leer el borrador y compara destinatarios, asunto y huella con lo que se le pasó en `expect`; si algo cambió **no envía** («Nothing was sent…»).
- **La huella es del texto completo.** El texto mostrado se recorta a 20 000 caracteres solo para pantalla (`textTruncated`); la huella siempre es del texto entero. La tarjeta avisa de que hay que revisar el texto COMPLETO.
- **Los datos del envío salen de la vista previa, nunca escritos a mano.** En la plantilla, `expect.to/cc/bcc/subject/bodySha256` son `{{ $nodes.ver.output.* }}`; la cuenta y el borrador salen de `{{ $trigger.* }}` (la carga del disparo, que se conserva al reanudar tras la aprobación).
- **Nunca se dispara solo.** La plantilla solo tiene disparador manual. El nodo `enviar` es de riesgo alto, irreversible y con `requiresApproval: true`: el motor pausa antes de ejecutarlo y solo continúa con `approvals: { enviar: 'approved' }`. Rechazar no envía nada.
- **Falla cerrado.** Sin huella válida, sin destinatario, sin asunto, solo HTML (no hay texto plano que aprobar) o cuenta no registrada para escribir: no se envía.
- La plantilla no contiene direcciones ni datos personales (lo comprueba `tests/node-catalog.test.ts`).

## Tarjeta de aprobación (`buildMailSendApprovalCard`)
`parseMailDraftPreview(output)` acepta **solo** la forma exacta de la vista previa (huella de 64 hex en minúsculas, listas de texto, al menos un «Para»); lo demás devuelve `null` y no se muestra tarjeta. `buildMailSendApprovalCard` devuelve titular, destinatarios, asunto, texto, huella corta (12 caracteres), pie sobre irreversibilidad y **avisos**: copia oculta, más de 10 destinatarios, texto recortado, texto vacío, misma dirección en varios campos.

## Cómo se usa (cuando esté conectado)
1. Crear el borrador (`gmail.draft.create`, ya existente).
2. Lanzar `correo-enviar-aprobado` con `{ account, draftId }`.
3. El flujo se pausa en `enviar`; el emisor de aprobación muestra la tarjeta construida desde la salida de `ver`.
4. Jean aprueba o rechaza. Si aprueba y el borrador no cambió, sale una vez; si cambió, no sale y pide aprobar de nuevo.

## Límites (POR CONFIRMAR / no hecho)
- No se ha probado contra Gmail real (necesita el cliente OAuth de Google Cloud de Jean y el vault).
- **La interfaz que muestra la tarjeta y el botón de consentimiento no está cableada**: el botón en la PWA toca `apps/pwa`, que no se modifica sin autorización explícita de Jean. La tarjeta es datos puros, lista para cualquier pantalla.
- La verificación comprueba que el borrador no cambió entre la vista previa y el envío; no valida que el contenido sea correcto ni protege contra una cuenta de Gmail ya comprometida.
- Solo texto plano: un borrador solo HTML se rechaza a propósito.
