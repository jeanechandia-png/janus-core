# Handoff cronológico — JANUS: prevención de consumo y salida progresiva de ElevenLabs
Fecha: 2026-11-05 (Europe/Amsterdam)
Repositorio ÚNICO: jeanechandia-png/janus-core
Rama: chatgpt/janus-provider-spend-guard-20261105
Base validada/continuada: chatgpt/janus-integrated-review-20261104 @ 8120c00d (PR #59)
Dependencias: PR #57 voz/knowledge/Kendra; PR #58 Evolution Guard; PR #59 dashboards A/B; PR #60 (corrección de clon PENDIENTE) es rama hermana, aún NO incorporada.

## Decisión del Founder, cronología
- 2026-11-02: saldo OpenAI agotado interrumpió chat escrito; el proveedor fue recargado, pero no se debe inferir que todos los productos volvieron a funcionar.
- 2026-11-04: trabajo JANUS voice/identidades, dashboards A/B y accesos. El clon de voz del Founder **no existe aún ni en ElevenLabs ni en JANUS**, según la corrección #60. Nunca declarar realizada una clonación solo por existir una voz o plan.
- 2026-11-05: el Founder exige protección de consumo para ElevenLabs y otros proveedores (OpenAI API, ChatGPT, Claude/Anthropic, Gemini/Cloud, Hostinger, Vercel, etc.), dashboard principal breve con acceso a informes granulares con gráficas y euro, y migración progresiva a infraestructura propia. Continuidad estricta, sin copias ni activaciones pagadas.

## Código añadido, sin desplegar
- packages/core/src/provider-spend-control.ts: catálogo y modelo de evidencia; 70/85/95 % = vigilar/alto/crítico; sobrecoste habilitado se destaca; fuentes no conectadas muestran «NO VERIFICADO», no «0 €».
- packages/adapters/src/elevenlabs-subscription-reader.ts: GET de solo lectura a /v1/user/subscription con credencial vía CredentialBroker, sin redirecciones, sin exponer la clave. No lee historial de voz ni contenido.
- packages/core/src/sqlite-store.ts: provider_spend_observations, un punto diario de la última lectura observada; y provider_daily_usage con reservas atómicas para proteger gasto de voz incluso tras reinicio.
- packages/adapters/src/elevenlabs-tts-adapter.ts: reserva cuota persistente antes del HTTP; falla en modo seguro si la reserva no puede validarse.
- apps/runtime/server.ts: GET /api/spend exclusivo Founder autenticado, cache 15 min; no llama nunca al proveedor antes de comprobar la autoridad, no divulga secretos. La selección voluntaria JANUS_TTS_PROVIDER=elevenlabs dispone de un límite predeterminado de **3.000 caracteres/día UTC** en el código de esta rama, modificable mediante JANUS_ELEVENLABS_DAILY_CHARS. **El servicio de voz local sigue siendo el predeterminado.**
- prototypes/dashboard/src/spend.js + src/spend.css y montaje en src/app.js/src/views.js/build.cjs: acceso compacto en cabeceras A/B/teléfono, detalle por proveedor, porcentaje, alertas y gráfico SVG de observaciones reales. Reutiliza misma sesión Founder y origen; nunca inserta claves en el HTML.
- tests/provider-spend-control.test.ts, tests/provider-spend-budget.test.ts, prototypes/dashboard/tests/spend-view.test.cjs: pruebas de parser, ausencia de datos no inventados, cuota persistente, gráfico solo con datos y sin credencial = cero llamadas de lectura.

## Limitaciones fácticas — no confundir con terminado
- Los proveedores distintos de ElevenLabs aparecen correctamente como NO CONECTADOS. Aún no hay implementados readers de facturas y uso de cada proveedor, ni datos EUR reales. Cifras, porcentajes y gráficas solo son reales cuando /api/spend confirma lecturas.
- ElevenLabs GET /v1/user/subscription describe consumo del periodo corriente y límite, pero **NO acredita el importe mensual completo del contrato, impuestos, moneda convertida a EUR ni series históricas anteriores**. La gráfica guarda solamente lecturas futuras reales.
- La cuota de JANUS bloquea sus propias llamadas TTS, **NO** bloquea a Melanie, IBA/ChatBox, ElevenLabs Studio ni otras apps que compartan un mismo proveedor. El límite account-wide/overages debe revisarse en el panel oficial de ElevenLabs; requiere acceso autorizado y decisión del Founder. La API del servicio no fue llamada con credenciales reales en este trabajo.
- No se ha instalado equipo, modelo local nuevo, servidor 24/7, voz clonada ni copia de datos biométricos. No se ha modificado ni publicado Melanie, IBA, ChatBox, la web ni producción de JANUS.
- Falta E2E de dispositivo físico, CI de rama, lectura con credenciales verdaderas y aprobación de PR; se registrarán resultados reales, no supuestos.

## Camino a infraestructura propia: orden, alternativas y decisiones
1. **Ahora, sin coste incremental**: mantener Qwen3-TTS y whisper.cpp detrás del Voice Gateway existente; JANUS local por defecto y fallback. Conservar la tablet Samsung como nodo temporal de JANUS solo si permite ejecutar el runtime; validar su capacidad práctica antes de decir que soporta STT/TTS productivo. No hospedar datos de tenants allí.
2. **Captura de activos propios**: grabaciones ORIGINALES y autorizadas del Founder en almacenamiento local privado y protegido, consentimiento y revocación, corpus metadata. No usar audios sintetizados por ElevenLabs para entrenar un clon. PR #60 en línea hermana gestiona estado de clon PENDIENTE; integrar después de comparar cambios, sin sobrescribir #59.
3. **Prueba técnica controlada**: Qwen3-TTS voz clone/base local con audio real autorizado; medir precisión, inteligibilidad ES/NL/EN, primera respuesta, velocidad de generación, RAM/CPU/GPU, uso eléctrico, fiabilidad offline, aislamiento de voz infantil y costes reales frente a nube. Pruebas automatizadas y aceptación humana.
4. **Dimensionamiento de hardware y red**: elegir entre equipo principal con RAM suficiente y nodo de bajo consumo 24/7 **solo después** de benchmark; registrar requisitos medidos, potencia/watts y coste total de propiedad EUR. Prohibido afirmar que una laptop por sí sola reemplazará calidad/capacidad de ElevenLabs sin mediciones.
5. **Relevo seguro**: Qwen local como principal; cloud temporal solo en fallback consentido y con cuotas; pérdida de proveedor no debe desactivar chat escrito ni agenda. Hacer prueba de corte de red y caída de API, medir recuperación e incluir rollback; retirar ElevenLabs solo por aprobación expresa tras E2E y calidad.
6. **Desacoplamiento por producto**: reusable Voice Gateway/Adapters; JANUS controla JANUS, IBA/ChatBox mantienen sus servicios separados; Melanie sigue operativa. No crear fork sectorial ni mover datos personales entre productos.

## Próximo agente: entrada ejecutable
1. Leer START_HERE.md, docs/STATE.md, este handoff, el PR de esta rama, docs/operating-norms.md y la rama hermana PR #60.
2. Desde un checkout limpio de **esta misma rama**, ejecutar:
   npm ci
   npm run continuity
   npm run typecheck
   npm test
   npm run dashboard:build
   npm run dashboard:test
   node tests/runtime-smoke.mjs
   (y flujos de navegador visuales existentes de PR #59, si Chromium está disponible).
3. Verificar GET /api/spend: sin sesión → 401, sesión no Founder → 403, con sesión Founder y sin llave → datos null/no conectado y cero llamadas API; con respuestas simuladas ElevenLabs → persistencia + gráfica + alarmas; errores 429/5xx → unavailable sin falsas cifras. En HTTPS y app física, comprobar sesión, cableado y layouts 390px/tablet.
4. Hacer auditoría estructural/visual/arquitectónica, prueba de cuota concurrente y de reinicio y regression suite completa. Si CI falla, corregir sobre la MISMA rama; no inventar verde.
5. Después de verificar, implementar readers de facturación concretos y seguros para OpenAI/Anthropic/Google y conciliación de recibos para SaaS no-API. Normalizar EUR con importe facturado o tipo BCE verificable y fecha; nada de conversiones supuestas. Separar suscripción fija de uso variable y consumo por tenant/proyecto.
6. Revisar PR #60 con diff contra #59, portar corrección de clon pendiente y validar sin perder funcionalidades. No fusionar ni desplegar hasta pasar E2E y recibir autorización.
7. Dejar commit/SHA, pruebas reales, hora, incidencias y siguiente punto exacto en docs/STATE.md. Cada entrega suma y mantiene todas las funciones aprobadas.

Fuentes técnicas primarias: https://elevenlabs.io/docs/api-reference/user/subscription/get y https://elevenlabs.io/docs/api-reference/user/subscription
