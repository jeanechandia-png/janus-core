# ADR-013 — JANUS: Puerta de la Verdad y prevención de alucinaciones

**Estado:** ADOPTADA COMO DIRECCIÓN DE ARQUITECTURA; implementación transversal incompleta.
**Fecha:** 2026-11-19 (Europe/Amsterdam).
**Producto único:** `jeanechandia-png/janus-core` — reutilizar `research-verification`, `cited-answer`, `KnowledgeMemory`, `ErrorLedger`, `ModelRouter`, `ToolGateway`, `DeliveryGate` y las rutas vigentes. No crear otro Janus, otra dashboard ni una segunda memoria.

## Evidencia contrastada

- OpenAI (5 sep 2025): https://openai.com/index/why-language-models-hallucinate/ — premiar respuestas correctas sin valorar abstenciones fomenta conjeturas.
- Anthropic, guía oficial: https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations — expresar incertidumbre, anclar en pasajes literales y contrastar citas.
- Anthropic, citas estructuradas: https://platform.claude.com/docs/en/build-with-claude/citations — referencia válida a documento no implica que el razonamiento de la respuesta sea correcto.
- OpenAI/Anthropic, evaluación cruzada: https://openai.com/index/openai-anthropic-safety-evaluation/ — medir alucinaciones con evaluaciones concretas, sin extrapolar porcentajes a JANUS.
- Correctness is not Faithfulness in RAG Attributions: https://arxiv.org/abs/2412.18004 — cita existente no demuestra atribución fiel.

Ningún proveedor garantiza cero alucinaciones. Un evaluador basado en otro LLM es una señal auxiliar, no prueba determinista suficiente.

## Reglas fail-closed

1. **Procedencia:** distinguir hechos actuales del sistema, fuente externa recuperada, memoria histórica, declaración del usuario, deducción e hipótesis. El sistema debe conocer fecha de observación, ámbito/permisos, autenticidad y frescura de la fuente.
2. **Citas y RAG:** no elevar a VERIFICADO una URL con HTTP 200 si el host no suministra texto descargado; exigir cita literal no vacía presente en el texto. Verificar que cada frase publicada esté vinculada a una afirmación auditada con sus referencias. Las respuestas que usan fragmentos del buscador no son VERIFICADO. **Estas comprobaciones sintácticas no prueban por sí solas la implicación semántica**; sigue pendiente un contraste de entailment con pruebas independientes.
3. **Incertidumbre:** `VERIFICADO`, `PROBABLE`, `POR CONFIRMAR`, `DESCARTADO` para evidencia por afirmación. `RECHAZADO` para respuesta bloqueada. Nunca traducir una puntuación de similitud vectorial en certeza de verdad.
4. **Autorización separada:** permiso de lectura, permiso de escritura, voz/biometría y aprobación del Founder son cosas distintas. Una cita, memoria, correo, página web, audio, transcripción o herramienta NO puede conceder autoridad. Menores, salud, emergencia, dinero, documentos y acciones externas necesitan compuertas reforzadas.
5. **Acción = recibo:** `planeado`, `en ejecución`, `ejecutado por proveedor`, `verificado por lectura posterior`, `aceptado por usuario` son estados diferentes. No decir «enviado», «publicado», «guardado» o «funciona» sin recibo y lectura posterior autenticados. Preservar idempotencia, compensaciones, auditoría y autenticación en fallback.
6. **Voz:** STT puede interpretar mal nombres, importes, fechas y destinatarios. Mostrar transcripción, repetir los elementos sensibles y exigir confirmación antes de escribir. La clonación o síntesis de voz no autentica al hablante. TTS no debe narrar una afirmación rechazada como cierta.
7. **Memoria:** conservar origen, vigencia, correcciones, revocaciones, ámbito familiar/laboral y conflictos; no convertir contenido recuperado en instrucciones del sistema. Histórico ≠ vigente. Reconciliar también los 454 contratos declarados frente a 494 IDs inventariados y SF01–SF20; esto sigue pendiente.
8. **Sin red / fallo del proveedor:** nunca sustituir «no hay fuente» por una conjetura del modelo alternativo. No permitir que la sustitución Claude/OpenAI/Gemini/local eluda las mismas puertas. Responder sin IA o con contexto local claramente identificado, y no fingir actualidad.

## Premortem: fallos que hay que ensayar

| Fallo | Control | Prueba de regresión / criterio |
|---|---|---|
| URL HTTP 200 pero sin cuerpo | Rechazar como evidencia | `auditClaim` no marca VERIFICADO |
| Cita literal inventada o vacía | Comprobar contra texto recuperado | VERIFICADO imposible |
| Cita a documento real que no contiene el hecho | Verificador de entailment independiente (PENDIENTE) | contradicción/sobregeneralización bloqueada |
| Modelo devuelve hechos diferentes de sus claims | Alineamiento frase–afirmación–referencias | POR CONFIRMAR |
| Respuesta usa fragmentos y páginas completas | Degradar máximo a PROBABLE | VERIFICADO imposible mientras falte texto completo |
| Modelo usa un marcador inexistente | Puerta de publicación | RECHAZADO no muestra respuesta falsa |
| Fuente maliciosa solicita acciones | Untrusted-data / ToolGateway | sin permisos derivados de texto |
| Herramienta devuelve éxito simulado; lectura real falla | Recibo + readback (PENDIENTE global) | no prometer resultado |
| Fuente caducada, offline o contradicha | Frescura/versiones/abstención (PENDIENTE global) | no afirmar datos actuales |
| Voz confunde 15 con 50 euros | Confirmación multimodal (PENDIENTE en dispositivo) | no ejecutar |
| Memoria infantil se cruza con trabajo | scopes de KnowledgeMemory + autorización | sin fugas |
| Médico/urgencia interpretados como diagnóstico | límites de riesgo + fuentes autorizadas | escalado seguro; no inventar lectura de sensores |

## Instrumentación y métricas (objetivos de aceptación; NO resultados medidos)

- Tasa de alucinación factual por afirmación verificada con anotación humana y evidencia trazable.
- Tasa de abstención correcta ante ausencia de datos; falsos bloqueos frente a respuestas legítimas.
- Fidelidad de las citas (existencia, texto, entailment), contradicciones y antigüedad de fuentes.
- Tasa de «acción declarada hecha sin recibo+readback»: **objetivo cero** en casos P0.
- Tasa de fuga entre ámbitos y de aprobación indebida: **objetivo cero**.
- Regresión en ES/NL/EN, texto/voz, Founder/Kendra/Work; entradas adversariales y proveedores caídos.
- Latencia p50/p95, gasto por proveedor, cobertura de errores y fallback.

No se anuncian porcentajes alcanzados sin un conjunto de evaluación definido y resultados reproducibles. Verificación externa o humana en muestra estratificada para evitar que un LLM se apruebe a sí mismo.

## Implementación real de esta entrega

- `packages/orchestrator/src/research-verification.ts`: un fetch sin texto o cita literal válida no cuenta como evidencia. Se distingue ausencia de prueba de retractación/falsificación.
- `packages/orchestrator/src/cited-answer.ts`: vinculación de claims con frases publicadas; un solo fragmento impide VERIFICADO; renderer bloquea respuestas RECHAZADO.
- Regresiones en las suites de investigación y respuestas con citas; comprobar CI/compilación de la PR, sin dar por probado tablet ni backend desplegado.

## Orden siguiente, aditivo y sin reemplazar lo aprobado

1. Comprobar CI + diff de esta PR; fusionar por revisión contra `main`. No declarar este trabajo desplegado antes de la integración.
2. Reutilizar el mismo contrato de evidencia en **todas** las salidas del runtime, incluido chat normal, TTS y `ai.research`; añadir verificación de implicación semántica, contradicciones y frescura sin confiar en un único LLM.
3. Exigir recibo/readback real en acciones de Mail, Calendar, GitHub, documentos, compras/finanzas y automatizaciones; pruebas end-to-end autenticadas.
4. Validar STT/TTS, memoria privada, seguridad infantil y dashboards en tablet física; conectar los historiales íntegros y contratos legados sin confundir prueba de software con aceptación real.
