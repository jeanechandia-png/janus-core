# drone-weather · ¿Se puede volar el dron?

Pieza LEGO sin red. Recibe datos horarios (`HourWx`) y devuelve un veredicto **sí / precaución / no**, las **mejores franjas** del día y un resumen **mañana / tarde / noche**. Se usa en el dashboard de Janus (clima del móvil y panel «Dron» de la tablet).

## Hechos verificados (fuentes)
- **Potensic Atom 2:** resistencia al viento de nivel 5 (hasta 38 km/h) y peso inferior a 249 g. Fuente: [Maison du Drone, prueba completa](https://www.maisondudrone.com/de/potensic-atom-2-vollstaendiger-test-was-ist-neu/) («Windwiderstand der Stufe 5 (bis zu 38 km/h)»).
- **Categoría abierta UE (EASA):** el dron debe mantenerse a menos de 120 m del terreno (UAS.OPEN.010) y a la vista del piloto, VLOS (UAS.OPEN.060). Fuente: [EASA Easy Access Rules for UAS](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-unmanned-aircraft-systems).

## Recomendaciones (NO son hechos del fabricante)
Márgenes por debajo del límite de 38 km/h: viento sostenido ≤ 25 km/h bien, ≤ 32 precaución; ráfagas ≤ 30 bien, ≤ 38 precaución; lluvia ≥ 50 % o > 0,1 mm = no (el Atom 2 no es resistente al agua); tormenta = no; visibilidad < 1 km = no; < 0 °C o de noche = precaución. Son ajustables con `DroneProfile`. **El piloto decide**; esta pieza no sustituye el manual del fabricante ni la normativa local (p. ej. zonas restringidas, registro de operador).

## Uso
```ts
import { dayVerdict, periods, checkHour } from './src/index.js';
const v = dayVerdict(horasDeHoy);   // { verdict, reasons, windows }
const p = periods(horasDeHoy);      // mañana (7–12), tarde (13–18), noche (19–23)
```
