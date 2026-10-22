# home-scenes · Casa inteligente

Escenas, órdenes por voz o texto y saludo para Janus. Pensado para luces **LSC Smart Connect (Action)**, que se emparejan con la app **Tuya o Smart Life**. Por eso se controlan con Tuya IoT Platform (nube) o Local Tuya (red local).
Fuentes:
- [Homey Community: Action LSC Smart Connect](https://community.homey.app/t/action-lsc-smart-connect/16814?page=3)
- [HACF: Local Tuya y LSC](https://forum.hacf.fr/t/local-tuya-et-les-devices-lsc-smart-connect-action/5260)

**INFERENCIA:** que todos los modelos de LSC sean Tuya se deduce de foros, no de documentación oficial. Algunos sensores no exponen todo por Tuya.

## Flujo "llego a casa"
1. **Presencia:** un Atajo de iOS ("Al llegar a casa") llama al endpoint de Janus. Alternativa: detectar el iPhone en la Wi-Fi.
2. Janus ejecuta `planScene('llegada')`: luces de ambiente si ya oscureció y calefacción a la temperatura de confort, solo lo que haga falta.
3. Saludo con `greeting()` ("Hola, Jean. ¿Qué tal tu día?") en el equipo de casa (tablet en un soporte o mini-PC) y resumen del día.

## Pendiente (POR CONFIRMAR con Jean)
- Crear el proyecto en Tuya IoT Platform y vincular la cuenta de la app. Las claves van a un secretRef, nunca al repositorio.
- Inventario real de luces, con las etiquetas `navidad`, `ambiente`, `noche` y `despertar`.
- ¿Calefacción inteligente? Hoy no está declarada.
