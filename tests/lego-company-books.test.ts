import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  DEFAULT_CHART, balanceSheet, createAccount, createJournalEntry, incomeStatement, journalCsv, parseAmountToMinor, quickLines, reverseEntry, splitVat,
  trialBalance, type JournalEntry, type QuickInput,
} from '../packages/modules/company-books/src/index.js';

let n = 0;
const post = (date: string, description: string, quick: QuickInput, extra: Partial<JournalEntry> = {}): JournalEntry =>
  createJournalEntry({ id: `je_${String(++n).padStart(3, '0')}`, date, description, lines: quickLines(quick), createdAt: '2026-01-01T00:00:00Z', verified: true, source: `quick:${quick.kind}`, ...extra }, DEFAULT_CHART);

/** Año de ejemplo ficticio. */
const year = (): JournalEntry[] => { n = 0; return [
  post('2026-01-05', 'Aportación inicial', { kind: 'owner_contribution', amountMinor: 500_000 }),
  post('2026-01-10', 'Portátil', { kind: 'asset_purchase', amountMinor: 121_000, vatBasisPoints: 2100 }),
  post('2026-02-01', 'Web cliente A (cobrada)', { kind: 'income', amountMinor: 242_000, vatBasisPoints: 2100 }),
  post('2026-02-15', 'Factura cliente B', { kind: 'invoice_issued', amountMinor: 121_000, vatBasisPoints: 2100 }),
  post('2026-03-01', 'Suscripciones', { kind: 'expense', amountMinor: 12_100, vatBasisPoints: 2100, category: '6100' }),
  post('2026-03-10', 'Factura de imprenta', { kind: 'invoice_received', amountMinor: 60_500, vatBasisPoints: 2100, category: '6000' }, { verified: false }),
  post('2026-03-20', 'Cliente B paga', { kind: 'customer_payment', amountMinor: 121_000 }),
  post('2026-04-02', 'Retiro', { kind: 'owner_withdrawal', amountMinor: 50_000 }),
  post('2026-04-28', 'IVA 1T', { kind: 'vat_payment', amountMinor: 30_000 }),
]; };

test('la pieza es LEGO: no importa nada de fuera y no lleva datos de ninguna empresa', () => {
  for (const file of readdirSync('packages/modules/company-books/src')) {
    const source = readFileSync(join('packages/modules/company-books/src', file), 'utf8');
    assert.equal([...source.matchAll(/from '([^']+)'/g)].length, 0, `${file} no debe importar nada`);
    assert.doesNotMatch(source, /infinityseed|echandia|iban|kvk-?nummer/i);
  }
  assert.deepEqual(JSON.parse(readFileSync('packages/modules/company-books/module.json', 'utf8')).dependencies, []);
});

test('un asiento que no cuadra, sin cuentas válidas o con decimales nunca entra', () => {
  const base = { id: 'je_x01', date: '2026-01-01', description: 'x', createdAt: '2026-01-01T00:00:00Z' };
  assert.throws(() => createJournalEntry({ ...base, lines: [{ account: '1000', debitMinor: 100 }, { account: '4000', creditMinor: 99 }] }, DEFAULT_CHART), /not balanced/);
  assert.throws(() => createJournalEntry({ ...base, lines: [{ account: '1000', debitMinor: 100 }, { account: '9999', creditMinor: 100 }] }, DEFAULT_CHART), /unknown account/);
  assert.throws(() => createJournalEntry({ ...base, lines: [{ account: '1000', debitMinor: 10.5 }, { account: '4000', creditMinor: 10.5 }] }, DEFAULT_CHART), /integer/);
  assert.throws(() => createJournalEntry({ ...base, lines: [{ account: '1000', debitMinor: 100, creditMinor: 100 }, { account: '4000', creditMinor: 0 }] }, DEFAULT_CHART), /either debit or credit/);
  assert.throws(() => createJournalEntry({ ...base, date: '2026-02-30', lines: [{ account: '1000', debitMinor: 1 }, { account: '4000', creditMinor: 1 }] }, DEFAULT_CHART), /date/);
  assert.throws(() => createAccount({ code: '7000', name: 'X', group: 'revenue', type: 'expense' }), /belongs to type income/);
});

test('IVA incluido: base + IVA = total, sin perder céntimos', () => {
  assert.deepEqual(splitVat(12_100, 2100), { netMinor: 10_000, vatMinor: 2_100 });
  for (const total of [1, 99, 100, 999, 12_345, 1_000_001]) { const s = splitVat(total, 2100); assert.equal(s.netMinor + s.vatMinor, total); }
  assert.equal(parseAmountToMinor('1.234,56'), 123_456); assert.equal(parseAmountToMinor('1234.5'), 123_450); assert.equal(parseAmountToMinor(12.34), 1_234);
  assert.throws(() => parseAmountToMinor('12,345')); assert.throws(() => parseAmountToMinor('abc')); assert.throws(() => parseAmountToMinor(-1));
});

test('estado de resultados del año de ejemplo', () => {
  const r = incomeStatement(year(), DEFAULT_CHART, { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.revenue.totalMinor, 300_000);            // 2.000 + 1.000 sin IVA
  assert.equal(r.directCosts.totalMinor, 50_000);
  assert.equal(r.grossProfitMinor, 250_000);
  assert.equal(r.operatingExpenses.totalMinor, 10_000);
  assert.equal(r.netResultMinor, 240_000);
  assert.equal(r.netMarginBasisPoints, 8_000);
  assert.deepEqual([r.evidence.entries, r.evidence.unverifiedEntries], [9, 1]);
  // Solo el primer trimestre de enero: sin ventas todavía.
  assert.equal(incomeStatement(year(), DEFAULT_CHART, { from: '2026-01-01', to: '2026-01-31' }).netResultMinor, 0);
});

test('balance: Activo = Pasivo + Patrimonio, siempre', () => {
  const b = balanceSheet(year(), DEFAULT_CHART, { asOf: '2026-12-31' });
  // Banco: 5000 − 1210 + 2420 − 121 + 1210 − 500 − 300 = 6.499
  assert.equal(b.assets[0]!.totalMinor, 649_900);
  assert.equal(b.assets[2]!.totalMinor, 100_000);          // portátil sin IVA
  assert.equal(b.liabilities[0]!.totalMinor, 60_500);      // imprenta por pagar
  assert.equal(b.liabilities[1]!.totalMinor, 33_000);      // IVA repercutido 630 − pago 300
  assert.equal(b.accumulatedResultMinor, 240_000);
  assert.equal(b.totalEquityMinor, 500_000 - 50_000 + 240_000);
  assert.equal(b.totalAssetsMinor, b.totalLiabilitiesAndEquityMinor);
  assert.equal(b.balanced, true); assert.equal(b.differenceMinor, 0);
  for (const asOf of ['2025-12-31', '2026-01-05', '2026-02-15', '2026-03-10', '2026-04-28']) assert.equal(balanceSheet(year(), DEFAULT_CHART, { asOf }).balanced, true, asOf);
  const t = trialBalance(year(), DEFAULT_CHART, 'EUR'); assert.equal(t.balanced, true); assert.equal(t.totalDebitMinor, t.totalCreditMinor);
});

test('corregir = anular con contrasiento; el diario no se borra', () => {
  const entries = year(); const wrong = entries[4]!;
  const reversal = reverseEntry(wrong, { id: 'je_rev1', date: '2026-03-02', createdAt: '2026-03-02T00:00:00Z', reason: 'importe mal' }, DEFAULT_CHART);
  assert.equal(reversal.reverses, wrong.id); assert.match(reversal.description, /Anulación/);
  const r = incomeStatement([...entries, reversal], DEFAULT_CHART, { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.operatingExpenses.totalMinor, 0);
  assert.equal(balanceSheet([...entries, reversal], DEFAULT_CHART, { asOf: '2026-12-31' }).balanced, true);
  assert.throws(() => reverseEntry(reversal, { id: 'je_rev2', date: '2026-03-03', createdAt: '2026-03-03T00:00:00Z' }, DEFAULT_CHART), /cannot be reversed/);
});

test('CSV para el contable: neutraliza fórmulas y conserva el cuadre', () => {
  const evil = post('2026-05-01', '=HYPERLINK("http://x")', { kind: 'income', amountMinor: 100 });
  const csv = journalCsv([evil], DEFAULT_CHART);
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(csv.split('\r\n')[0]!, /^Fecha;Asiento;Descripción/);
  assert.match(csv, /;1,00;;EUR;sí;/);
});

test('puente desde facturas y pagos: mismos datos → mismos asientos, sin inventar nada', async () => {
  const { entriesFromFinanceRecords } = await import('../packages/modules/company-books/src/index.js');
  const docs = [
    { id: 'd1', kind: 'sale_invoice', status: 'paid', currency: 'EUR', issueDate: '2026-02-01', subtotalMinor: 100_000, taxMinor: 21_000, totalMinor: 121_000, number: 'F-001', counterparty: 'Cliente A' },
    { id: 'd2', kind: 'purchase_invoice', status: 'issued', currency: 'EUR', issueDate: '2026-02-10', subtotalMinor: 20_000, taxMinor: 4_200, totalMinor: 24_200, number: 'P-77' },
    { id: 'd3', kind: 'expense', status: 'paid', currency: 'EUR', issueDate: '2026-03-01', totalMinor: 5_000 },
    { id: 'd4', kind: 'sale_invoice', status: 'draft', currency: 'EUR', issueDate: '2026-03-02', totalMinor: 99_900 },
    { id: 'd5', kind: 'sale_invoice', status: 'issued', currency: 'EUR', issueDate: '2026-03-03', subtotalMinor: 100, taxMinor: 50, totalMinor: 999 },
    { id: 'd6', kind: 'other', status: 'issued', currency: 'EUR', issueDate: '2026-03-04', totalMinor: 10 },
    { id: 'd7', kind: 'credit_note', status: 'issued', currency: 'EUR', issueDate: '2026-03-05', subtotalMinor: 10_000, taxMinor: 2_100, totalMinor: 12_100, number: 'R-001' },
  ] as const;
  const pays = [
    { id: 'p1', documentId: 'd1', direction: 'inbound', status: 'reconciled', amountMinor: 121_000, currency: 'EUR', date: '2026-02-15' },
    { id: 'p2', documentId: 'd2', direction: 'outbound', status: 'recorded', amountMinor: 10_000, currency: 'EUR', date: '2026-02-20' },
    { id: 'p3', direction: 'inbound', status: 'recorded', amountMinor: 3_000, currency: 'EUR', date: '2026-03-10' },
    { id: 'p4', documentId: 'd4', direction: 'inbound', status: 'recorded', amountMinor: 99_900, currency: 'EUR', date: '2026-03-11' },
    { id: 'p5', documentId: 'd1', direction: 'outbound', status: 'recorded', amountMinor: 1, currency: 'EUR', date: '2026-03-12' },
    { id: 'p6', documentId: 'd2', direction: 'outbound', status: 'reversed', amountMinor: 14_200, currency: 'EUR', date: '2026-03-13' },
  ] as const;
  const out = entriesFromFinanceRecords(docs, pays, DEFAULT_CHART, { createdAt: '2026-04-01T00:00:00Z' });
  assert.deepEqual(out.entries.map((e: JournalEntry) => e.id), ['fd_d1', 'fd_d2', 'fd_d3', 'fd_d7', 'fp_p1', 'fp_p2', 'fp_p3']);
  assert.deepEqual(out.skipped.map((s: { id: string }) => s.id).sort(), ['d4', 'd5', 'd6', 'p4', 'p5', 'p6']);
  assert.equal(out.warnings.length, 3);
  const r = incomeStatement(out.entries, DEFAULT_CHART, { from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.revenue.totalMinor, 100_000 - 10_000 + 3_000);
  assert.equal(r.directCosts.totalMinor, 20_000); assert.equal(r.operatingExpenses.totalMinor, 5_000);
  assert.equal(r.evidence.unverifiedEntries, 1);
  const b = balanceSheet(out.entries, DEFAULT_CHART, { asOf: '2026-12-31' });
  assert.equal(b.balanced, true);
  assert.equal(b.assets[0]!.totalMinor, 121_000 - 10_000 + 3_000);         // banco
  assert.equal(b.liabilities[0]!.totalMinor, 24_200 - 10_000 + 5_000);     // proveedores: resto de P-77 + gasto «pagado» sin pago
  assert.deepEqual(entriesFromFinanceRecords(docs, pays, DEFAULT_CHART, { createdAt: '2026-04-01T00:00:00Z' }), out, 'determinista');
});
