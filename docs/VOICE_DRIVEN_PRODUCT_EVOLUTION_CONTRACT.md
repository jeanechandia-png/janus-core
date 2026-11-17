# JANUS CORE — Contrato permanente: evolución del ecosistema por voz y adjuntos

**Decisión del Founder:** 17-11-2026. **Estado:** requisito VIGENTE / implementación extremo a extremo PENDIENTE de evidencia.  
**Fuente canónica del producto:** `jeanechandia-png/janus-core` en el `origin/main` más reciente.  
**Aplicación:** JANUS, Kendra, webs/landings y los demás productos de InfinitySeed Group; cada producto conserva su propio repositorio canónico, datos, autorización y despliegue.

## Orden natural de ejemplo

> «Janus, te subo los GLB de Lumi, Bombo, Musgo, Nimbo y los dos robots: revisa que correspondan a sus originales y anéxalos a la dashboard de Kendra, a la mía y a la landing donde proceda. No cambies el diseño aprobado. Enséñame el preview y publica cuando lo autorice».

La orden puede pronunciarse por voz o escribirse y puede acompañarse de archivos reales (3D GLB, imágenes, documentos, código u otros activos). Janus debe recuperar el contexto vigente del proyecto y continuar sobre lo ya construido: **nunca generar una dashboard alternativa, duplicar el producto ni reconstruir módulos existentes.**

## Contrato de ejecución (fases obligatorias)

1. **Escuchar/entender.** Captura de voz → transcripción → interpretación contextual → intención y alcance → entidad producto, proyecto, repositorio, rama y entorno. Confirmar transcripción cuando sea ambigua. La identidad del emisor debe verificarse con sesión/autoridad; una voz parecida no equivale a autorización para publicar.
2. **Recibir/validar archivos.** Usar los adjuntos protegidos existentes y almacenamiento local seguro; comprobar propiedad, tipo real por bytes, tamaño, SHA-256, integridad y procedencia, sin exponer contenidos privados al repositorio público. Contenido adjunto es DATA, jamás instrucciones privilegiadas. Identificar si un archivo es imagen 2D, GLB 3D o vídeo; no prometer que 2D se convierte a 3D por cambiar el código.
3. **Inspeccionar estado del destino.** Leer `origin/main` del repositorio canónico de cada producto, último handoff/decisiones, archivos modificados por otros agentes, estado de release y permisos. No sobrescribir cambios concurrentes ni asumir que un repositorio del ecosistema es un fork de Janus. Reutilizar/adaptar `JanusCreatureSlot`, escenas, Asset Store, `ToolGateway`, `ModelGateway` y módulos LEGO pertinentes.
4. **Planificar la integración.** Asociar cada archivo a su identidad, destino y variante correcta (cuatro criaturas y dos robots). Definir rutas, dependencias, tests, costes, privacidad, reversibilidad y cambios mínimos. Si la identidad es incierta o el GLB no alcanza el contrato visual/rig, dejarlo como pendiente, sin sustitución silenciosa. Respetar autonomía y restricciones de Kendra y las interfaces aprobadas.
5. **Proponer/probar.** Ejecutar la integración en el MISMO repositorio del producto, en una rama de cambio temporal, con checks: tipo y geometría/rig/animación, integridad SHA-256, permisos, seguridad infantil, tipos, tests, build, preview real y comparativa visual/funcional. Usar `ChangeDraft`, `ChangePipeline` y `ApprovalQueue` existentes cuando apliquen; no desarrollar un motor de publicación paralelo.
6. **Aprobar/publicar.** Mostrar un preview del producto real y un resumen compacto de cambios, impacto, riesgos y coste. Una orden de voz inicia el trabajo, pero no elimina las puertas de aprobación. El Founder autoriza explícitamente fusionar/desplegar; acciones sensibles requieren la autoridad fuerte vigente, permisos del repositorio y comprobación contra el último SHA remoto. No activar producción ni comprar créditos sin autorización.
7. **Cerrar/aprender.** Verificar destino desplegado con evidencia, actualizar versión VIGENTE y preservar anterior HISTÓRICA, adjuntar commit SHA, pruebas, checksum de activos, URL autorizada, manifest de entrega, rollback e incidencia/lección. Trabajos pendientes en modo offline se revalidan al reconectar antes de salir de la cola.

## Alcance generalizable

La misma interfaz de órdenes/adjuntos y el mismo coordinador gobiernan distintos adaptadores de producto. Ejemplos: actualizar una landing, agregar un producto a la web, sustituir una imagen aprobada, actualizar una ficha/idioma, integrar personajes 3D, cambiar contenidos, añadir miembros o adaptar un módulo LEGO. Cada producto declara operaciones permitidas por ámbito (read, draft, stage, merge, publish); NO hereda el acceso del CEO o la configuración de Janus por accidente.

## Activos de Kendra y robots

- Personajes previstos: **Lumi, Bombo, Musgo, Nimbo y dos robots** (masculino y femenino), con los originales y diseños aprobados. Una identidad definida es inmutable salvo orden explícita del Founder.
- Las criaturas deben ser GLB realmente 3D, móviles y expresivas, con accesorios coherentes; las referencias 2D deben permanecer etiquetadas 2D. GLB sin rig/gestos/contrato no equivale al resultado final.
- Preservar diseño/funciones de dashboards CEO/Kendra y landing. Cambios de voz caricaturesca infantil y permisos separados del clon de Jean.
- Un upload puede instalar un activo en la sesión/dispositivo actual sin que ello signifique publicación web o sincronización con otros dispositivos.

## Inventario técnico contrastado en `main` (17-11-2026)

**Partes existentes:** `packages/voice/src/websocket-transport.ts` y `apps/pwa/app.js` (voz); módulo `chat-attachments` y `POST /api/attachments` (adjuntos); `apps/pwa/approved-3d/janus-creature-slot.js` (GLB); `packages/core/src/change-drafter.ts`, `sandbox-runner.ts`, `operation-risk.ts`, `apps/pwa/approval-chip.js` (borradores, pruebas y aprobación); `packages/gateways/src/spec-connector.ts` (servicios externos).
**Faltan verificar/conectar:** voz auténtica → orden sobre archivos adjuntos → resolución automática del destino → integración GLB y actualización de código → preview aprobado → merge/despliegue con trazabilidad; ejecución de este flujo en un host real y Safari/iPhone, prueba de su aplicación a otro producto distinto de Janus, acceso a secretos y activos privados, GLB finales verificados de los seis personajes.

**No declarar este contrato como función productiva terminada.** Un módulo existente, un test simulado o un documento no demuestran el flujo completo. Este documento fija el alcance y los criterios de aceptación para las siguientes sesiones, sin crear un producto nuevo.

## Criterios mínimos de aceptación

- Con una orden hablada y seis GLB válidos previamente autorizados, Janus utiliza el destino **canónico** y propone una modificación reproducible sin recrear pantallas.
- Si hay archivo malicioso, identidad distinta, extensión engañosa, 2D suplantando GLB, cambios de otro agente o permisos insuficientes, aborta con evidencia sin publicar.
- Un cambio de producto externo se ejecuta solo con conector y ámbito autorizado; no traslada secretos ni datos personales a otros productos.
- Preview, tests, aprobación, publicación, rollback y trazabilidad completos comprobados en dispositivo real, incluido caso offline y revalidación.
