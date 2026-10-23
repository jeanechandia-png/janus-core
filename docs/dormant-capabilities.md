# Capacidades en reposo — preparadas, pendientes de activación

Norma 7 (`docs/operating-norms.md`): **el gasto va al final.** Todo lo de esta lista está construido y probado con servicios simulados; **no está activado y no cuesta nada mientras siga así.** Se activa solo cuando el Founder lo pide. Cifras: euros, **sin IVA** salvo que se indique (fuentes primarias consultadas el 2026-10-23; el IVA del 21 % es un cálculo propio).

Decisión del Founder (2026-10-23): de momento **no** necesita que Janus lea o envíe correos por sí mismo, vigile redes ni conteste WhatsApp/llamadas, ni contratar servidor.

## Qué hay en reposo

| Capacidad | Estado | ¿Cuesta activarla? | Qué haría falta (toques del Founder) |
|---|---|---|---|
| Correo: leer, corregir borradores y enviar con aprobación | Código y pruebas listos (PR #47) | Servidor (ver abajo). Cliente OAuth de Google: coste **POR CONFIRMAR** (no verificado) | Cliente OAuth + URI de retorno pública; llave de la bóveda; consentimiento por buzón (lectura, luego escritura) |
| Vigilancia periódica de redes (Instagram, Facebook, Threads) | Planificador y registros en SQLite listos | Servidor. APIs de Meta/Threads: coste **POR CONFIRMAR** | App de Meta y token; Threads como tester y token |
| WhatsApp, SMS y llamadas | Nivel 1 **ya activo y gratis**: Janus prepara el mensaje y un enlace; envías tú con un toque. Niveles 2–3 en reposo | Nivel 1: 0 €. Nivel 2 (API) y línea de voz con agente: **gasto, importe no verificado** | Decidir ruta; número dedicado solo si se quiere envío por API |
| Motor (runtime) siempre encendido | Sin desplegar | **Sí** (ver abajo) | Servidor con dirección pública HTTPS; o la laptop cuando exista |

## Opciones de servidor (solo cuando se active algo de lo anterior)
Janus necesita unos 110 MB de memoria en reposo (medido por el agente el 2026-10-23, sin módulo de voz local).

| Opción | Potencia | €/mes sin IVA | Con IVA 21 % | Condiciones |
|---|---|---|---|---|
| Hetzner Cloud CPX12 (Alemania/Finlandia) | 1 CPU, 2 GB, 40 GB | 11,99 | 14,51 | Facturación por horas con tope mensual; sin permanencia mencionada; se paga hasta borrar el servidor |
| Hetzner Cloud CPX02 | 1 CPU, 1 GB, 20 GB | 6,49 | 7,85 | Ídem |
| Hostinger KVM 1 | 1 CPU, 4 GB, 50 GB | 5,49 | 6,64 | Prepago; **la página no indica la duración del primer periodo**; renueva a 11,99 €/mes durante 2 años; reembolso 30 días |
| Hostinger KVM 2 | 2 CPU, 8 GB, 100 GB | 7,79 | 9,43 | Ídem; renueva a 14,99 €/mes |
| La laptop del Founder (cuando la compre) | — | 0 | 0 | Solo funciona con ella encendida |

Fuentes: hostinger.com/nl/vps-hosting, hostinger.com/es/servidor-vps, hetzner.com/cloud/regular-performance, docs.hetzner.com/cloud/billing/faq (2026-10-23). Si InfinitySeed puede deducir el IVA, el coste real es el neto (**POR CONFIRMAR** con el gestor).

## Cómo se activa algo (siempre a petición del Founder)
1. El Founder lo pide con sus palabras.
2. El agente presenta precio en euros (fuente primaria y fecha), IVA, plazo, baja y uso previsto; el Founder dice sí o no.
3. El Founder hace el pago y los pasos de cuenta; el agente deja preparado el resto (instalación, variables, comprobación con `npm run integrations:check`).
4. Se anota en el registro de abajo.

## Registro de gasto
| Fecha | Servicio | Importe | Baja prevista | Uso real | Nota |
|---|---|---|---|---|---|
| (anterior a 2026-10) | CatCut | no registrado | — | 1–2 usos | Relato del Founder el 2026-10-23: se pagó un mes completo y casi no se usó. Origen de la norma 7 |
