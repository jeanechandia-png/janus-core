# JANUS — voz autenticada, revisión de cambios y accesos tipo app

Fecha: 4-nov-2026 (Europe/Amsterdam). Continuación de PR #59 sobre
`2f6ddb4a8dd0242bbb6faba0ed5e9acaed1c438c`, rama existente
`chatgpt/janus-integrated-review-20261104` del mismo `janus-core`.
Orden vigente del propietario: implementar en código y agotar el trabajo que el
agente puede ejecutar antes de devolver pasos manuales. No confundir este delta
con una instalación en el equipo del propietario.

## Implementado

- Dictado HTTP con sesión Founder, incluyendo controles de micrófono, TTS y tarea.
  El micrófono no se activa desde la interfaz sin identificación previa.
- PCM/WebSocket con ticket autenticado, de un solo uso y 30 segundos; sin bearer
  en URL. El enlace pertenece a una sesión concreta. Revalidación de expiración,
  revocación y sustitución antes de frames, transcripciones finales y respuesta.
  Una transcripción tardía de una conexión cerrada no inicia una tarea.
- El compilador usa el nombre completo de la acción al comprobar autoridad.
  Se corrigió la diferencia `change.apply` / `knowledge.change.apply`, que impedía
  aplicar la regla biométrica prevista a los planes compilados. Las operaciones
  root conservan su identidad y sus controles independientes.
- La propuesta de conocimiento creada por la orden se revisa desde su ID real,
  sin reenviar la frase para crear un cambio diferente al aprobar. API Founder
  `GET/POST /api/knowledge/proposals/:id`: exige confirmación del ID y revisión,
  prueba biométrica reciente y permiso auditado. Rechaza propuesta caducada,
  sustituida, aplicada o basada en otra revisión. Persiste en el historial SQLite
  existente; no crea otra memoria. Publicación externa sigue separada.
- Diálogo compartido en PWA y dashboards: lectura del cambio, aprobación con el
  puente nativo, resultado real y aviso explícito si falta Face ID. Sin puente,
  la acción permanece bloqueada.
- El acceso instalable del Founder abre `/dashboard/a`; Kendra conserva identidad
  de app y entrada `/kendra`. A/B sirven manifiesto, acceso de identificación en
  la misma pestaña/origen, retorno al dashboard, instalación y controles/familia.
  El dictado final del dashboard se remite como voz a Core una sola vez.
- Una página servida por Core no deriva contenido a un proveedor de Artifact
  mientras la comprobación de Core está pendiente o falla. El service worker no
  guarda respuestas fallidas/no-store ni devuelve la app del Founder como shell
  de una navegación infantil sin conexión. Caché actual: `janus-shell-v13`.
- `JanusFounderWebView.swift` conecta el cliente/signer iOS existente a la web
  del mismo producto, valida origen y marco principal y solo expone inscripción
  y prueba para las acciones de conocimiento admitidas. No guarda tokens.

## Verificado en esta intervención

- `npm run typecheck`: correcto.
- `npm test`: 653 pruebas, 652 aprobadas, 0 fallos y 1 omisión de capa privada.
- `npm run dashboard:test`: 10/10 aprobadas.
- `npm run dashboard:build`: A/B y ambas variantes Core sin datos privados.
- `node tests/runtime-smoke.mjs`: correcto.
- Sintaxis JS y `git diff --check`: correctos.
- Nueva prueba HTTP real: dictado sin sesión rechazado; token infantil real
  obtenido por emparejamiento rechazado; dictado Founder crea propuesta; sesión
  sola no aplica; firma de fixture permite aplicar una vez; revisión y estado
  aplicado sobreviven a reinicio. Los manifiestos abren las rutas correctas.
- PCM pasa por STT/TTS de prueba y el runtime real usando la nueva autenticación.
  Son servicios locales simulados, no una conversación con la voz real de Jean.
- Tickets: caducidad, consumo único, sesión equivocada, revocación y prohibición
  de que una conexión vieja herede una sesión nueva. Operación root continúa
  bloqueada sin su prueba correspondiente.

## Límites que siguen abiertos

1. **Equipo real:** no se accedió a la tablet ni se identificó una URL HTTPS
   operativa del runtime del propietario. Esta rama no está desplegada allí.
2. **Face ID físico:** falta compilar/instalar el host iOS que incorpore el puente,
   o integrarlo en un host ya existente, e inscribir la llave en el runtime real.
   Se necesita toolchain Apple y el iPhone. El Swift nuevo no se compiló con
   Xcode aquí. Instalar solo la PWA no crea el puente Swift. Guía exacta en
   `docs/ios-founder-faceid-bridge.md`.
3. **Interfaz y hardware:** no se ejecutó Chromium local en esta intervención:
   faltaba el binario y la descarga oficial devolvió un archivo truncado. Las
   comprobaciones de dashboard aquí son de contrato/build/HTTP, no prueba visual
   o de instalación en Safari/iPhone/Android. El workflow visual existente puede
   aportar evidencia de Chromium al completar CI; todavía hay que probar el
   hardware real y su micrófono.
4. **Voz real:** fidelidad del clon, modelo local, credenciales del proveedor y
   conversación física no se verificaron ni se activaron. Sin generación de
   audio, subida de grabaciones ni consumo de API por esta intervención.
5. **Alcance de cambios conversacionales:** se conectan las acciones de
   conocimiento ya soportadas (precios, IVA, productos, equipo, FAQ e instrucciones).
   Una petición arbitraria de rediseño, edición de código o selección de voz no
   adquiere una herramienta ejecutora por el hecho de dictarla; falta desarrollar
   esas acciones cuando no estén registradas. No prometer autocambio universal.
6. **Otras ramas:** PR #60 es una línea hermana sobre #57; no está incorporada en
   #59 y contiene una afirmación de estado del clon distinta de la declaración
   del propietario en este hilo. Comprobar inventario privado antes de resolver
   ese estado; no sobrescribir ninguno por suposición. El delta de control de
   servicio del 2-nov sigue pendiente de comparación/integración por separado.

## Continuar y cerrar

1. Refrescar HEAD de #59 y leer el último `docs/STATE.md`; conservar los cambios
   posteriores y las funcionalidades heredadas de #57/#58/#56.
2. En el equipo anfitrión autorizado, disponer de esta rama con dependencias y
   ejecutar `npm run start:dashboards`. Comprobar su dirección HTTPS de confianza
   desde el iPhone/tablet, manteniendo el bind local y el transporte autenticado.
   No ofrecer una URL localhost como si fuese accesible desde otro dispositivo.
3. Identificarse desde el acceso del dashboard. Preparar e inscribir el puente
   iOS con el procedimiento existente; desactivar bootstrap después. No rebajar
   la política biométrica para hacer pasar una prueba.
4. Dictar un cambio soportado, revisar la propuesta, aprobar en Face ID y observar
   su revisión guardada. Repetir sin sesión, con sesión caducada, con token infantil
   y tras reinicio. Probar emparejamiento/instalación y funciones de ambas apps.
5. Registrar versión realmente instalada, URL, dispositivo, evidencia y pendientes
   en este mismo estado. El plazo de puesta en marcha no está medido: depende de
   si ya existen host, HTTPS y host iOS. No convertir una estimación en garantía.

No se modificaron landings, Melanie pública, claves, modelos de producción,
facturación, ni se crearon repositorios, ramas remotas o alojamientos.
