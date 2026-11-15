# company-books · contabilidad por partida doble (LEGO 1.0.0)

Balance y estado de resultados para una empresa pequeña, a partir de un diario de asientos.

- Importes en céntimos enteros; un asiento solo existe si **Debe = Haber**.
- El diario es de **solo añadir**: un error se anula con un contrasiento (`reverseEntry`), no se borra.
- `quickLines` convierte «cobré», «pagué», «facturé»… en partida doble, separando el IVA incluido.
- `incomeStatement({from,to})` → ventas, margen bruto, resultado de la actividad, resultado neto.
- `balanceSheet({asOf})` → activo, pasivo, patrimonio y la comprobación `balanced`.
- Cada informe dice cuántos asientos no tienen justificante.

```ts
import { DEFAULT_CHART, createJournalEntry, quickLines, incomeStatement, balanceSheet } from './src/index.js';
const entry = createJournalEntry({ id: 'je_001', date: '2026-02-01', description: 'Venta', createdAt: new Date().toISOString(),
  lines: quickLines({ kind: 'income', amountMinor: 121_00, vatBasisPoints: 2100 }) }, DEFAULT_CHART);
incomeStatement([entry], DEFAULT_CHART, { from: '2026-01-01', to: '2026-12-31' });
balanceSheet([entry], DEFAULT_CHART, { asOf: '2026-12-31' });
```

No guarda nada, no importa nada y no lleva datos de ninguna empresa: el anfitrión persiste los asientos (JSON) donde quiera.
No es asesoría fiscal ni genera cuentas anuales oficiales.
