# mail-hub — Correo multicuenta (pieza LEGO)

- Varias cuentas por proveedor: `addAccount(list, { provider: 'gmail', address })` tantas veces como cuentas haya.
- Selector del dashboard: `pickerGroups()` → icono de correo → iCloud / Gmail / Yahoo… → cuentas con no leídos → «Añadir cuenta».
- Bandeja unificada (`unifiedInbox`) y prioridad explicable (`priorityOf`).
- Contraseñas: nunca en el módulo. iCloud y Yahoo usan **contraseña específica de app** guardada en el entorno/llavero con el nombre que da `secretRefFor()` (p. ej. `MAIL_ICLOUD_..._APP_PASSWORD`). Gmail usa OAuth.

Ajustes verificados (2026-10-22): iCloud `imap.mail.me.com:993` SSL ([Apple](https://support.apple.com/en-ie/HT202304)); Yahoo `imap.mail.yahoo.com:993` SSL ([Yahoo](https://help.yahoo.com/kb/SLN4075.html)).
