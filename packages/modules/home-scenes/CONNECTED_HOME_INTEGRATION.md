# JANUS — Casa conectada (fase de integración, 2026-11-06)

Este trabajo amplía el módulo existente `home-scenes`; NO crea otro producto ni declara dispositivos conectados.

## Dispositivos solicitados
- Samsung Smart TV 65 pulgadas: modelo exacto y alta en SmartThings pendientes. Solo se enviarán comandos para capabilities devueltas por el dispositivo. Código puro: `src/smartthings.ts`; sin tokens ni peticiones reales.
- LSC Smart Connect de Action: ya existen escenas y planificación Tuya en `src/index.ts`; falta verificar modelos, plataforma, cuenta y credenciales de host. No presumir compatibilidad de todos los productos.
- Google Home: integrar mediante Home APIs SDK de Android/iOS o puente explícitamente autorizado; NO se debe simular una API REST genérica de control de dispositivos de la cuenta Google.
- Bluetooth: captura del propietario muestra una lista de dispositivos previamente conocidos, no autorizaciones de control. AirPods, Apple Watch, JBL, Harman Kardon, ratón, teclado, DualSense y equipos informáticos requieren integraciones individuales. La PWA iOS no puede apropiarse del control de todos los emparejamientos del sistema.

## Límites de seguridad
- Founder administra dispositivos y permisos. Kendra controla únicamente dispositivos con `childAllowed=true` definidos por el propietario, sin acceso a secretos, compras, cámaras, cerraduras o acciones administrativas.
- Sin escaneo, comandos de red ni almacenamiento de biometría en esta fase.
- Credenciales OAuth/SmartThings/Tuya solo en almacén privado. Nunca en repositorio, logs ni frontend.
- Registrar identidad, dispositivo, comando, hora y resultado al conectar el gateway; no declarar éxito hasta respuesta del dispositivo.
- Los IDs, nombres y modelos de la captura NO deben publicarse como inventario de producción en repositorio público.

## Para pasar de código a producto operativo
1. Confirmar rama activa de JANUS y fusionar tras CI y revisión, sin sobrescribir el dashboard concurrente.
2. Verificar modelo exacto de Samsung TV y vinculación en SmartThings; conectar OAuth de alcance mínimo.
3. Enumerar dispositivos reales y capabilities; asignar permisos Founder/Kendra explícitos.
4. Verificar modelo/servicio de LSC y enlazar adaptador Tuya o compatible; Google Home requiere SDK/puente autenticado.
5. Diseñar y conectar panel de Casa en dashboard existente; pruebas E2E de acciones reales, estados y errores.
6. Probar en iPhone y en el dispositivo de Kendra, con consentimiento y aislamiento de perfiles.

**Estado:** planificador SmartThings y pruebas subidos a PR; NO hay control real ni dashboard publicado.
