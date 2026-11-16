# IBA sin internet — investigación y definición (15-nov-2026)

Orden del propietario: confirmar si IBA funciona sin internet, definir exactamente qué funcionaría, y después implementarlo.
Etiquetas: HECHO VERIFICADO = comprobado en el código · INFERENCIA · POR CONFIRMAR.

## 1. Estado real hoy (HECHO VERIFICADO)

Rama oficial de IBA `fix/iba-baseline-recovery-20260920` @ `48bc855`, repositorio `infinity-chatbox-platform`:

- La landing (`app/iba/ui-copy.ts`, `app/iba/page.tsx`) **no afirma** que IBA funcione sin internet. La única cadena
  parecida es el rótulo del chat «Temporalmente no disponible» (`app/iba-canonical-sales-advisor.tsx`).
- El conocimiento de Melanie (`packages/isg-voice`, `lib/iba/public-facts.ts`, `public-faq.ts`) tampoco lo menciona.
- IBA **no tiene** capa sin conexión: ni service worker, ni IndexedDB, ni comprobación de conexión. Datos y acceso
  viven en Supabase; la IA, la voz y el teléfono, en servicios externos. Sin red, el panel no carga.
- POR CONFIRMAR: el texto de la web publicada (no se pudo abrir desde el entorno de trabajo; Producción sigue otra rama).

## 2. ¿Cambio fuerte o anexión?

**Anexión**, sin rehacer lo construido: IBA es un panel web que pide datos por `/api/v1/iba/*`. Se añade (a) un service
worker que guarda la aplicación para abrirla sin red y (b) la pieza `janus-offline`, que guarda la última copia de los
datos y apunta los cambios para enviarlos al volver. Lo delicado es el service worker: un fallo ahí deja a los usuarios
con una versión vieja «pegada», así que exige prueba en iPhone y Android reales antes de publicar.

## 3. Qué funcionará sin internet (definición)

Condición previa: haber abierto el panel con conexión al menos una vez en ese aparato y tener la sesión iniciada.

| | Función | Sin internet |
|---|---|---|
| ✔ | Abrir el panel instalado (dueño, administración, equipo) | Sí |
| ✔ | Ver el resumen del día, agenda, trabajos, tareas, clientes, inventario y cifras de finanzas | Sí, lo último guardado, con su fecha y hora |
| ✔ | Balance y estado de resultados | Sí, calculados en el propio aparato con lo guardado |
| ✔ | Anotar una factura, un gasto, un cobro o un pago | Sí: queda en el aparato y se envía al volver, sin duplicar |
| ✔ | Crear una tarea | Sí, igual |
| ◐ | Mensajes y recados | Solo leer los ya recibidos |
| ◐ | Aprobaciones | Verlas; decidir exige conexión (son acciones delicadas) |
| ✗ | Melanie: chat con IA, voz y atención telefónica | No: viven en la nube |
| ✗ | WhatsApp y otros canales; reservas de clientes en línea | No |
| ✗ | Primer inicio de sesión o aparato nuevo; ver cambios de otros compañeros | No |
| ✗ | Subir fotos y archivos; comparador de proveedores con IA | No |

Límites: datos guardados de más de 7 días no se muestran; cambios con más de 24 h en espera piden confirmación antes
de enviarse. POR CONFIRMAR: cuánto dura la sesión iniciada sin conexión (depende de Supabase; hay que medirlo).

## 4. Texto propuesto para la landing (solo cuando esté desplegado y probado)

«**Sigue trabajando aunque se caiga internet.** Consulte su agenda, sus trabajos y sus cuentas, y anote cobros, gastos
y tareas: IBA lo sincroniza al volver la conexión. La asistente de IA, la voz y el teléfono necesitan conexión.»

No debe publicarse antes: hoy sería falso.

## 5. Plan de implementación en IBA (misma rama oficial, sin rama nueva)

1. Traer las piezas selladas con `scripts/lego-export.mjs` (offline-kit, company-books, nl-tax-prep, janus-offline).
2. `lib/iba/offline-capabilities.ts`: la tabla de arriba como datos (fuente única para panel y landing).
3. `Idempotency-Key` en `POST /api/v1/iba/finance` y tareas (clave guardada en `metadata`, sin migración).
4. Montar `janus-offline` en el panel + aviso «Sin conexión · datos de HH:MM · N pendientes» (NL/EN/ES/TR).
5. Service worker para `/app`, con prueba de red cortada y en teléfonos reales.
6. Balance y resultados en el panel (puente desde `finance_documents` / `finance_payments`, sin tablas nuevas).
7. Solo entonces, el texto en la landing.

## 6. Actualización 16-nov-2026 — decisión del propietario e implementación

- **Separar dos casos** (aclarado con el propietario): si cae el internet DEL LOCAL, Melanie sigue atendiendo
  (teléfono, WhatsApp, chat web, citas) porque vive en la nube; el panel sigue con lo último guardado y sincroniza.
  Lo que no puede funcionar es hablar con Melanie desde un aparato SIN ninguna conexión (con datos móviles sí).
- **Descartado:** Melanie dentro del local sin nube (equipo propio por cliente).
- **Implementado (CODED, STATIC-TESTED, UI-SINTÉTICO)** en IBA @ `a412652`: aviso sin conexión, copias locales,
  bandeja con idempotencia en finanzas, balance y resultados por API, service worker construido y APAGADO.
- **Pendiente:** teléfonos reales → encender «abrir sin red»; mostrar balance en el panel; tareas en la bandeja;
  texto de landing y conocimiento de Melanie (otro agente).
- **Texto propuesto para la landing (corrige el del punto 4):** «Su negocio sigue atendido aunque se le caiga
  internet: Melanie contesta el teléfono y los mensajes, y su equipo sigue trabajando. Al volver la conexión, todo
  se sincroniza.» Solo publicable cuando el punto anterior esté verificado.
