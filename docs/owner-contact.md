# Contacto del propietario (dashboard)

El dashboard muestra una tarjeta **CONTACTO** con los correos y el WhatsApp del propietario.
Es información privada: este repositorio es público, así que **los valores reales nunca se versionan**.

- Archivo privado: `config/owner-contact.local.json` (ignorado por git). Plantilla: `config/owner-contact.example.json`.
- Otra ruta: variable `JANUS_OWNER_CONTACT_FILE`.
- Endpoint: `GET /api/owner/contact` — exige sesión de Founder; sin ella responde 401/403.
- Teléfono: se acepta como lo dicte el propietario (`640-61-3413`, `06 40613413`, `+31 6 40613413`) y se guarda como E.164 (`+31640613413`). Solo móviles holandeses.
- `zero30008@hotmail.com` está bloqueado por regla del propietario.
- Un correo con `"needsConfirmation": true` se muestra con el aviso «Ortografía por confirmar».

Sin archivo, la tarjeta dice que no hay contacto configurado (estado normal, no error).
