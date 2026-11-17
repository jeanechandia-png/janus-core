# deal-radar — Radar de ofertas (pieza LEGO)

Busca ofertas de lo que de verdad compras y usas, y lo resume cada semana.

| Qué vigila | Cómo |
|---|---|
| **Cesta del supermercado** | Fotos de los productos → visión del anfitrión → `addToBasket()` (EAN, marca, tamaño, último precio; pide revisión si la confianza es baja). |
| **Marcas** (ropa, calzado, electrónica, niños) | `brandWatch('Calvin Klein', ['boxershorts'])`, umbral de descuento propio. |
| **Plataformas y herramientas** | Ofertas con `intro` → `evaluateSubscription()` (coste real, permanencia, fecha para cancelar). |
| **Viajes** | `upcomingHolidays(región)` + `travelSearches()` (tren, avión, bus, hotel, parques; NL y DE) con antelación recomendada. |

Promociones neerlandesas entendidas: `1+1 gratis`, `2+1 gratis`, `2e halve prijs`, `2e gratis`, `25% korting`, `2 voor 3,00`, `halve prijs`.

## Uso
```ts
import { addToBasket, brandWatch, runWeeklyReview, staticSource } from './src/index.js';
const digest = await runWeeklyReview(profile, [miFuenteAH, miFuenteZalando]);
digest.headline // "3 productos de tu cesta en oferta · 2 de tus marcas · ahorro aprox. €14,20"
```

## Reglas
- Sin red ni secretos: las fuentes (`SourceAdapter`) las aporta el anfitrión, tras revisar sus condiciones de uso. `SOURCE_CATALOG` lista candidatas con estado `por-confirmar`.
- Nunca inventa: cada aviso lleva `source`, `observedAt` y, si existe, `url`.
- Fechas de vacaciones: rijksoverheid.nl (consultado 2026-10-22). La región se configura por perfil (`schoolRegion`).

## Pruebas
`node --import tsx --test tests/deal-radar.test.ts`
