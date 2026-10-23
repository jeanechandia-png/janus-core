# Handoff — Motor de flujos inspirado en n8n + respuestas con citas (2026-10-23)

Rama: `claude/flow-engine-n8n-parity` (apilada sobre `claude/companion-research`, PR #45). No se toca `apps/pwa`.

## AHORA
Jean pidió dos cosas con capturas de pantalla:
1. Aplicar a Janus lo útil de las características de n8n (editor visual de nodos, autoalojado, código JS/Python, IA, conectividad HTTP/REST), "como característica propia".
2. Verificar qué características de Perplexity (búsqueda en tiempo real, síntesis con citas y enlaces directos, modelos avanzados) ya existen e implementar las que faltan.

## HECHO (verificado con pruebas en esta rama)
- **Motor de ejecución** `packages/automation/src/flow-runner.ts`: ramas, reintentos con retroceso, ramas de error, aprobación con pausa y reanudación, esperas reanudables, subflujos, desduplicación, clave de idempotencia por nodo, tiempo máximo por flujo, nodos de IA, gancho de agente e investigación inyectados. `tests/flow-runner.test.ts` (16).
- **Nodo de código** `code-runner.ts`: JavaScript en worker + contexto `vm` vacío con límites de tiempo, memoria y tamaño. Python **declarado no disponible**. `tests/automation-code-runner.test.ts` (6).
- **HTTP / REST** `packages/adapters/src/http-request-adapter.ts`: endpoints con nombre autorizados por el Founder (`JANUS_HTTP_ENDPOINTS`), solo https, ruta contenida, método = acción (`request.read` / `request.send`), credencial por CredentialBroker, sin redirecciones, respuesta acotada y marcada `untrusted`. Registrado en el runtime y en la política de acciones sensibles (`http.request.send`). `tests/http-request-adapter.test.ts` (13).
- **Catálogo de nodos y de conectores** `node-catalog.ts`: la disponibilidad refleja el entorno real (Python, webhook, planificador y evento salen `unavailable` con el motivo). El catálogo de conectores cuenta solo adaptadores registrados y nunca presume credenciales.
- **Plantillas** `flow-templates.ts` (borradores): briefing matinal, alerta de viento para el dron, triaje de correo, investigación con fuentes, llegada a casa (bloqueada: no hay conector de domótica). `templateReadiness` dice qué falta. `tests/node-catalog.test.ts` (10, tres de ellas ejecutan plantillas de punta a punta).
- **Respuestas con fuentes citadas (Perplexity)** `packages/orchestrator/src/cited-answer.ts`: búsqueda → síntesis con citas numeradas `[n]` y enlaces directos → verificación automática (cobertura, citas inexistentes, citas literales presentes, nivel de fuente) → veredicto. Contenido web hostil acotado como dato. `tests/cited-answer.test.ts` (11).
- Corrección de seguridad en el propio motor: el texto externo que llega a un nodo de IA se acota como DATO no confiable y no puede cerrar su bloque.

## Auditoría Perplexity (HECHO VERIFICADO sobre el código)
| Característica | Antes | Ahora |
| --- | --- | --- |
| Búsqueda web en tiempo real | `PerplexityAdapter` (`research.ask`), necesita `PERPLEXITY_API_KEY` | igual + proveedor neutral `SearchProvider` (otro buscador se enchufa sin tocar el resto) |
| Síntesis con citas y enlaces directos | no existía de forma verificable | `cited-answer.ts` |
| Modelos avanzados (GPT/Claude) | Model Gateway y `routeModel` ya existían | capacidad `web_search` añadida al enrutador |
| Fuentes de prestigio / niveles | `research-verification.ts` | reutilizado, sin duplicar |
| Interfaz tipo Perplexity | no | **PENDIENTE** (Sala del dashboard) |

## PENDIENTE
- Editor visual "Flujos" en el dashboard: primero dos opciones estáticas (lienzo en tableta / pasos verticales en móvil) para que Jean elija; después interactivo con "Probar" (ejemplos simulados y rotulados EJEMPLO) y exportación JSON.
- Sala: respuesta con citas numeradas, nivel de fuente y veredicto (simulada y rotulada hasta tener buscador real).
- Persistir instantáneas y desduplicación en SQLite; planificador y receptor de webhooks; enlazar la aprobación del motor con las aprobaciones del Founder.
- Python con aislamiento real (Pyodide/WASM o contenedor); aislamiento fuerte para código no confiable.
- Enlazar `ai.agent` con el Agent Swarm; adaptadores de herramienta para módulos locales (drone-weather, home-scenes).
- Defecto latente: `execution.ts: readyWorkflowNodes` marca como listo un nodo con aristas solo de error o todas omitidas. El runner no depende de él; corregir o retirar.

## BLOQUEADO (decisión o dato de Jean)
- Clave de API de búsqueda/modelos (Perplexity, OpenAI, Gemini): una suscripción de chat no incluye API (facturación aparte). **POR CONFIRMAR** para Gemini.
- Autorizar al menos un endpoint en `JANUS_HTTP_ENDPOINTS` (p. ej. un clima público) para activar el nodo HTTP.
- Autorización para fusionar la pila #37 → #38 → #40 → #45 (+ esta) y para tocar `apps/pwa`.
- Inventario Tuya/Smart Life y lector de escenas para domótica.

## Cómo reproducir
```bash
git fetch --all && git checkout claude/flow-engine-n8n-parity
npm install --no-audit --no-fund
npm run typecheck && npm test
node --import tsx --test tests/flow-runner.test.ts tests/http-request-adapter.test.ts tests/node-catalog.test.ts tests/cited-answer.test.ts tests/automation-code-runner.test.ts
```

## Configuración nueva (solo entorno, nunca en el repo)
```text
JANUS_HTTP_ENDPOINTS={"clima":{"baseUrl":"https://api.open-meteo.com/v1","methods":["GET"],"allowPrefixes":["/forecast"]}}
JANUS_HTTP_TOKEN_<SERVICIO>=...   # solo si el endpoint declara credentialService
```
HECHO VERIFICADO (2026-10-23, open-meteo.com/en/docs): `wind_speed_10m`, `wind_gusts_10m` (máximo de la hora previa), unidad por defecto km/h, `forecast_days` (0–16, por defecto 7), `timezone` y `latitude/longitude`. Los umbrales del dron (viento 25/32 km/h, rachas 30/38) son RECOMENDACIÓN, no norma.

## Lección registrada
ERROR: suponer que `$input` conserva los datos del disparador en nodos lejanos → CAUSA: `$input` es la salida del nodo anterior → IMPACTO: resumen vacío en una prueba → LECCIÓN: usar `$trigger` para el dato original → PREVENCIÓN: documentado en el addendum de ADR-004 y probado → VERIFICACIÓN: `tests/flow-runner.test.ts` (IA).
