# Ángel Guardián · `guardian-angel`

Módulo reutilizable de seguridad para menores (orden del Founder, 24-nov-2026). Funciona en Janus (app de Kendra) y está pensado para los productos de InfinitySeed dirigidos a padres y madres.

## Qué hace
1. **Plantilla de contactos:** hasta 5 (padre, madre, tutor legal, familiar u otro), con nombre, teléfono, si usa WhatsApp y cuál es el principal. Se elige también el país, que fija el número de emergencias: 112 en la UE, 999 en Reino Unido, 911 en EE. UU., Canadá y México, 123 en Colombia.
2. **Botón SOS:** hay que mantenerlo pulsado 2 segundos para que no salte por accidente. Al activarse:
   - el anfitrión recibe el aviso con la **ubicación precisa** (latitud, longitud y margen en metros) y la va actualizando;
   - aparecen botones grandes para **llamar** al contacto, mandarle un **WhatsApp** o un **SMS** con el enlace al mapa, o **llamar al número de emergencias**.
3. **«Estoy bien»** cierra el aviso y se lo comunica al tutor.

## Límites (verdad)
- Una web **no llama ni envía SMS sola**: deja la llamada o el mensaje preparados y la persona pulsa. La llamada al 112 necesita un segundo toque aparte.
- **No se conecta a satélites.** El SOS por satélite es del teléfono: el iPhone 14 o posterior lo tiene en Países Bajos, y Starlink Direct to Cell depende del operador. Al llamar al número de emergencias, el teléfono usa lo que tenga.
- El **SMS sale sin internet**, solo con cobertura móvil. Así el aviso llega aunque el servidor no responda.
- La **ubicación precisa** necesita permiso, GPS y una página segura (https o localhost).

## Uso
```ts
import { normalizeConfig, alertText, contactLinks, emergencyCall, newSosEvent } from './src/index.js';
```
En el cliente, `src/guardian-angel.js` se sirve tal cual: en Janus hay un espejo en `apps/pwa/guardian-angel.js`, comprobado por prueba.
