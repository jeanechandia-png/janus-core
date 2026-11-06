# JANUS — Handoff 2026-11-06 — Independencia tecnológica y créditos externos al final

PROYECTO: JANUS CORE (el repositorio real `jeanechandia-png/janus-core`).
BASE: `chatgpt/canonical-continuity-guard-20261106` (PR #76 sobre main `7ddfe245` verificado al comienzo).
ESTADO: EN PROGRESO — cambios en rama canónica GitHub, pendientes de aceptación/fusión.

## Objetivo e instrucción vigente
Instrucción del Founder, posterior a la norma de gasto 2026-10-23:
**hacer las cosas con nuestros propios módulos y tecnología, local-first, libre/gratuito y cero gastos incrementales primero; consumo de créditos y dependencia de terceros siempre como última alternativa**. Aplica a JANUS y a los productos reutilizadores de InfinitySeed Group. Aun si una plataforma tiene saldo o suscripción, no se interpreta como permiso para consumir API.

## Implementado (no confundir con desplegado)
- Registro central `founder-policy:independent-first-no-external-credits` en `config/founder-reference-library.json`, sin sustituir las políticas vigentes anteriores.
- `packages/core/src/model-provider-config.ts`: plan local-first, clasificación de loopback/LAN explícita y de servicios externos, claves API sin equivalencia a consentimiento de gasto, bloqueo por defecto de cualquier proveedor externo, máximo numérico opcional de 1–100 intentos.
- `packages/gateways/src/credit-guarded-model-gateway.ts`: contador común en memoria que reserva intentos antes de conectar, compartido por TODOS los adaptadores externos. `ModelBudgetExceededError` corta la cascada cuando se acaba el presupuesto de intentos.
- `apps/runtime/server.ts`: utiliza el plan en el **gateway efectivo**, ordena antes el proveedor local aunque `JANUS_MODEL_ORDER` sugiera otro, y no instancia gateways externos salvo opt-in + cap. Incluye reporte no secreto de ruta/estado.
- `tests/independent-first-model.test.ts`: escenarios sin permiso, credenciales externas existentes, orden contrario, LAN reconocida, host público disfrazado, intento local correcto/fallido y contador compartido.
- `.env.example`, `docs/operating-norms.md`, `docs/dormant-capabilities.md`: límites, política, activación y ruta segura.

## Continuidad con Kendra — PR #75, no fusionado
En `chatgpt/kendra-one-cartoon-voice-20261106` (PR #75) se mantiene una sola voz compartida. Cambios incrementales: la selección nativa ya exige `localService === true`, descarta voces potencialmente remotas y solo acepta adaptadores marcados `localOnly:true`; conserva texto si no hay voz apta. Tests y README actualizados.
**Pendiente:** motor TTS propio verdaderamente caricaturesco/no humano, muestra auditiva aprobada e iPhone/Safari real. El filtro `localService` depende de información del navegador y no certifica por sí solo coste/privacidad de un sistema operativo.

## Verificación y límites conocidos
- GitHub Actions del núcleo `5e0ce565f7af3ea1f5aab2c5a962bbd5d4b6ccd4` informó success después de corregir regex de IP y se re-ejecuta para cambios siguientes.
- GitHub Actions de Kendra `7284a19e38cc04a2d385d9c01fc36c1e1abdeec0` confirmó success del flujo central; ver estado del E2E de criaturas por separado.
- **No se gastaron créditos ni se activó una plataforma externa.** No hay prueba de producción ni autorización de merge.
- Límite importante: el máximo de llamadas es **por proceso y se reinicia al arrancar JANUS**. No constituye límite monetario persistente ni puede sustituir los topes de facturación del proveedor ni aprobación autenticada. La configuración solo debe cambiarse desde entorno seguro administrado por Founder.

## Riesgos y próxima acción exacta
1. Confirmar CI de la punta de PR #76 y #75, reparar fallos si aparecen.
2. Mantener el valor `JANUS_ALLOW_EXTERNAL_MODEL_CREDITS=false` por defecto y nunca habilitar pagos sin permiso explícito.
3. Hacer revisión comparativa antes de integrar PR #76, y después rebase/reconciliación de pila visual #75 según dependencias y decisiones aprobadas, sin pisar el registro central.
4. Integrar y validar un motor TTS local verdaderamente no humano para la voz caricaturesca compartida, con controles de contenido infantil, pruebas auditivas y Safari/iPhone antes de publicar.

RESTRICCIONES: no nuevos repositorios, no modelos comerciales obligatorios, no cambiar la voz de Nexo/Founder, no reemplazar diseños aprobados, no publicar secretos ni datos de menores.
