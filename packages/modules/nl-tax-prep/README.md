# nl-tax-prep · preparación de la declaración ante la Belastingdienst (LEGO 1.0.0)

Convierte las cifras del año en una **hoja de trabajo** para la declaración holandesa (renta de empresario o sociedades),
con resumen de IVA por trimestre, lista de lo que pide la declaración y plazos.

## Por qué no se queda obsoleta

- **Ninguna cifra fiscal está en el código.** Tipos, tramos, deducciones y plazos viven en `packs/nl-<año>.json`,
  y cada cifra cita sus fuentes (Belastingdienst, KVK, Ondernemersplein…).
- Año nuevo = **un archivo de datos nuevo** (o `POST /api/tax/packs` en JANUS). El motor no se toca.
- «Verificada» exige **≥ 2 editores distintos y al menos una fuente oficial**. Con una sola fuente, el informe lo avisa.
- Sin paquete del año pedido **no calcula** (no extrapola). Un paquete revisado hace más de 120 días sale «por revisar».

```ts
import { validateRulePack, buildWorksheet } from './src/index.js';
const pack = validateRulePack(JSON.parse(readFileSync('packs/nl-2026.json', 'utf8')));
buildWorksheet({ year: 2026, legalForm: 'eenmanszaak', profitMinor: 40_000_00, turnoverMinor: 60_000_00, hoursWorked: 1400 }, pack, '2026-11-15');
```

## Límites

Estimación para preparar la declaración con un asesor. **No presenta nada** y no es asesoría fiscal. No cubre pareja fiscal,
vivienda, box 2/3, edad AOW, compensación de pérdidas ni deducciones por inversión. Dos pasos del cálculo están marcados
como inferencia en la propia hoja.
