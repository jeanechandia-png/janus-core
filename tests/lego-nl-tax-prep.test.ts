import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { bracketTax, buildWorksheet, citation, packHealth, selectPack, validateRulePack, vatByQuarter, type RulePack } from '../packages/modules/nl-tax-prep/src/index.js';

const raw = (): Record<string, any> => JSON.parse(readFileSync('packages/modules/nl-tax-prep/packs/nl-2026.json', 'utf8'));
const pack = validateRulePack(raw());
const line = (w: ReturnType<typeof buildWorksheet>, key: string): number => w.lines.find((l) => l.key === key)!.amountMinor;

test('la pieza es LEGO y NO lleva cifras fiscales en el código: todas viven en el paquete de reglas', () => {
  for (const file of readdirSync('packages/modules/nl-tax-prep/src')) {
    const source = readFileSync(join('packages/modules/nl-tax-prep/src', file), 'utf8');
    assert.equal([...source.matchAll(/from '([^']+)'/g)].length, 0);
    for (const figure of ['38883', '78426', '3575', '3756', '1270', '2123', '1225', '3115', '5685']) assert.ok(!source.includes(figure), `la cifra ${figure} está escrita en el código`);
  }
});

test('paquete 2026: cada cifra cita fuentes; ≥2 editores con una oficial = verificada', () => {
  assert.equal(citation(pack, 'box1Brackets').confidence, 'verified');
  assert.equal(citation(pack, 'zelfstandigenaftrekEur').confidence, 'verified');
  assert.equal(citation(pack, 'mkbWinstvrijstellingBp').confidence, 'verified');
  assert.equal(citation(pack, 'zvw').confidence, 'single_source');
  const health = packHealth(pack, '2026-11-15');
  assert.equal(health.stale, false); assert.ok(health.weak.includes('zvw')); assert.equal(health.unsourced, 0);
  assert.equal(packHealth(pack, '2027-06-01').stale, true);
  for (const source of Object.values(pack.sources)) assert.match(source.url, /^https:\/\//);
});

test('paquetes inválidos se rechazan; sin paquete del año no se calcula', () => {
  const bad1 = raw(); bad1.params.box1Brackets.sources = ['no-existe'];
  assert.throws(() => validateRulePack(bad1), /unknown source/);
  const bad2 = raw(); bad2.sources['kvk-tarieven'].url = 'javascript:alert(1)';
  assert.throws(() => validateRulePack(bad2), /https url/);
  const bad3 = raw(); bad3.params.box1Brackets.value[1].upToEur = 100;
  assert.throws(() => validateRulePack(bad3), /thresholds/);
  const bad4 = raw(); bad4.jurisdiction = 'ES';
  assert.throws(() => validateRulePack(bad4), /only accepts NL/);
  assert.equal(selectPack([pack], 2027), null);
  assert.throws(() => buildWorksheet({ year: 2027, legalForm: 'eenmanszaak', profitMinor: 0, turnoverMinor: 0 }, pack, '2026-11-15'), /no se extrapolan/);
});

test('impuesto por tramos', () => {
  const table = pack.params.box1Brackets.value;
  assert.equal(bracketTax(0, table), 0); assert.equal(bracketTax(-5, table), 0);
  assert.equal(bracketTax(1_000_000, table), 357_500);                       // 10.000 € × 35,75 %
  assert.equal(bracketTax(5_000_000, table), Math.round(3_888_300 * 0.3575 + 1_111_700 * 0.3756));
  assert.equal(bracketTax(10_000_000, table), Math.round(3_888_300 * 0.3575 + 3_954_300 * 0.3756 + 2_157_400 * 0.495));
});

test('hoja de trabajo de un autónomo: beneficio 40.000 €, con horas y starter', () => {
  const w = buildWorksheet({ year: 2026, legalForm: 'eenmanszaak', profitMinor: 4_000_000, turnoverMinor: 6_000_000, hoursWorked: 1400, starter: true, unverifiedEntries: 0 }, pack, '2026-11-15');
  assert.equal(w.regime, 'inkomstenbelasting');
  assert.equal(line(w, 'za'), -120_000); assert.equal(line(w, 'sa'), -212_300);
  assert.equal(line(w, 'after'), 3_667_700);
  assert.equal(line(w, 'mkb'), -Math.round(3_667_700 * 0.127));
  const taxable = 3_667_700 - Math.round(3_667_700 * 0.127);
  assert.equal(line(w, 'taxable_profit'), taxable);
  assert.equal(line(w, 'tax_gross'), Math.round(taxable * 0.3575));
  // Bonificación general: 3.115 − 6,398 % × (base − 29.736)
  assert.equal(line(w, 'ahk'), -Math.round(311_500 - (taxable - 2_973_600) * 0.06398));
  // Bonificación por trabajo sobre 40.000: 5.300 + 1,95 % × (40.000 − 25.845)
  assert.equal(line(w, 'ak'), -Math.round(530_000 + (4_000_000 - 2_584_500) * 0.0195));
  assert.equal(line(w, 'zvw'), Math.round(taxable * 0.0485));
  assert.equal(w.estimatedTaxMinor, line(w, 'income_tax') + line(w, 'zvw'));
  assert.ok(w.lines.every((l) => l.basis !== 'rule' || l.citation!.sources.length > 0));
  assert.ok(w.deadlines.some((d) => d.id === 'ib' && d.approximate));
  assert.equal(w.deadlines.find((d) => d.id === 'btw-q4')!.daysLeft, 77);
  assert.match(w.disclaimer, /No es asesoría fiscal/);
});

test('sin horas no hay deducciones; empresa sin registrar no se calcula; bv va por sociedades', () => {
  const noHours = buildWorksheet({ year: 2026, legalForm: 'eenmanszaak', profitMinor: 4_000_000, turnoverMinor: 6_000_000 }, pack, '2026-11-15');
  assert.equal(line(noHours, 'za'), 0); assert.equal(line(noHours, 'sa'), 0);
  assert.ok(noHours.warnings.some((x) => /urencriterium/.test(x)));
  const few = buildWorksheet({ year: 2026, legalForm: 'eenmanszaak', profitMinor: 50_000, turnoverMinor: 100_000, hoursWorked: 1300 }, pack, '2026-11-15');
  assert.equal(line(few, 'za'), -50_000, 'sin starter la deducción se limita al beneficio');
  assert.ok(few.warnings.some((x) => /KOR/.test(x)));
  const unreg = buildWorksheet({ year: 2026, legalForm: 'unregistered', profitMinor: 4_000_000, turnoverMinor: 6_000_000 }, pack, '2026-11-15');
  assert.equal(unreg.estimatedTaxMinor, null); assert.equal(unreg.regime, 'none');
  assert.ok(unreg.warnings.some((x) => /NO registrada/.test(x)));
  const bv = buildWorksheet({ year: 2026, legalForm: 'bv', profitMinor: 30_000_000, turnoverMinor: 50_000_000 }, pack, '2026-11-15');
  assert.equal(bv.estimatedTaxMinor, Math.round(20_000_000 * 0.19 + 10_000_000 * 0.258));
  const loss = buildWorksheet({ year: 2026, legalForm: 'eenmanszaak', profitMinor: -500_000, turnoverMinor: 0, hoursWorked: 1300 }, pack, '2026-11-15');
  assert.equal(loss.estimatedTaxMinor, 0); assert.equal(line(loss, 'za'), 0);
});

test('IVA por trimestre: el pago a Hacienda no cuenta como IVA del trimestre', () => {
  const entries = [
    { date: '2026-02-01', source: 'quick:income', lines: [{ account: '1000', debitMinor: 12_100, creditMinor: 0 }, { account: '4000', debitMinor: 0, creditMinor: 10_000 }, { account: '2100', debitMinor: 0, creditMinor: 2_100 }] },
    { date: '2026-03-01', source: 'quick:expense', lines: [{ account: '6100', debitMinor: 1_000, creditMinor: 0 }, { account: '1200', debitMinor: 210, creditMinor: 0 }, { account: '1000', debitMinor: 0, creditMinor: 1_210 }] },
    { date: '2026-04-28', source: 'quick:vat_payment', lines: [{ account: '2100', debitMinor: 1_890, creditMinor: 0 }, { account: '1000', debitMinor: 0, creditMinor: 1_890 }] },
  ];
  const q = vatByQuarter(entries, 2026, { vatCharged: '2100', vatPaid: '1200', revenue: ['4000'] }, pack as RulePack);
  assert.deepEqual([q[0]!.turnoverMinor, q[0]!.vatChargedMinor, q[0]!.vatPaidMinor, q[0]!.balanceMinor, q[0]!.dueDate], [10_000, 2_100, 210, 1_890, '2026-04-30']);
  assert.deepEqual([q[1]!.vatChargedMinor, q[1]!.balanceMinor, q[1]!.dueDate], [0, 0, '2026-07-31']);
});
