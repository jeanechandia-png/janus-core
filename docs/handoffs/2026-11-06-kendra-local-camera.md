# JANUS/Kendra — cámara local opcional (06-11-2026)

**Origen:** continuación de la pila visual `#75 → #79`, sin tocar `main` ni producción.
**Objetivo:** habilitar la vista previa de cámara tanto en el detalle JANUS del Founder como en la pestaña «Hablar» de Kendra, sin depender de proveedores, créditos ni descargas externas.

## Implementación
- `lego/janus-local-camera/janus-local-camera.js`: Web MediaDevices, solicitud SOLO al tocar «Abrir cámara», frontal sin audio, vista previa sin instantáneas, grabación, análisis facial ni subida. Abandono, pestaña oculta y botón «Detener» cierran todas las pistas; generación monotónica cancela respuestas tardías de permisos.
- `lego/janus-local-camera/janus-local-camera.css`: diálogo compacto, adaptable a pantalla del iPhone, áreas seguras y cierre accesible.
- `src/companero.js`: acceso local en pestaña «Hablar», sin cambiar criaturas ni voces.
- `src/views.js` y `src/app.js`: acceso desde detalle de JANUS Founder; no afecta a la identidad Nexo/Melanie.
- `build.cjs`: ambas variantes offline A/B contienen módulo y CSS.
- `tests/local-camera.test.cjs`: permisos explícitos, cierre, cancelación asíncrona, privacidad y presencia en ambas interfaces; integrado en CI.

## Límites verificables
- **NO** reconoce la cara ni sirve para autenticar. Face ID/biometría real deben funcionar mediante el adaptador de identidad y autoridad existente y pruebas de seguridad.
- Para acceder a la cámara, Safari exige contexto seguro/permisos del dispositivo; un HTML local abierto con Quick Look puede no ofrecer `getUserMedia`.
- **No** permite acceso parental autenticado a la pestaña «Papá» ni sustituye cuidados humanos; módulo meramente visual.
- **No** usa red, APIs externas, nubes, modelos IA ni consume créditos. No se guardan imágenes de Kendra.
- La prueba de CI de Chromium no equivale a cámara física en iPhone. Safari/iPhone de verdad queda PENDIENTE.

## Estado y continuidad
**Implementado en rama, sujeto a CI y pruebas físicas; no fusionado ni desplegado.**
Revisar los cambios y tests, comparar con ramas #65/#56 y con PR de continuidad #78; nunca sobrescribir activos o fusionar a ciegas. El primer objetivo es un piloto con acceso seguro, coherente y comprobado.
