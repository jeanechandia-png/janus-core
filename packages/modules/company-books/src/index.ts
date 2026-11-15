/**
 * Pieza LEGO «company-books»: contabilidad por partida doble para una empresa pequeña.
 *
 * Qué entrega: plan de cuentas, asientos equilibrados, balance de comprobación, BALANCE (situación a una fecha)
 * y ESTADO DE RESULTADOS (pérdidas y ganancias de un periodo).
 *
 * Reglas que se comprueban en código:
 *  - Importes en unidades mínimas enteras (céntimos). Nunca decimales flotantes.
 *  - Todo asiento cuadra: suma del Debe = suma del Haber, una sola moneda, al menos dos líneas.
 *  - El diario es de solo añadir: un error se corrige con un asiento de anulación (contrasiento), no borrando.
 *  - El balance siempre comprueba Activo = Pasivo + Patrimonio; si no cuadra, lo dice (`balanced:false`).
 *  - Cada informe cuenta cuántos asientos están sin justificante (`unverifiedEntries`): cifras sin respaldo
 *    se muestran como tales, no como hechos.
 *
 * La pieza no guarda nada, no importa nada de fuera y no lleva datos de ninguna empresa.
 * No es asesoría fiscal: prepara cifras para el contable; no presenta impuestos.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
/** Subgrupo para ordenar los informes. */
export type AccountGroup =
  | 'cash' | 'receivable' | 'tax_asset' | 'fixed_asset' | 'other_asset'
  | 'payable' | 'tax_liability' | 'loan' | 'other_liability'
  | 'capital' | 'drawings' | 'retained'
  | 'revenue' | 'other_income'
  | 'direct_cost' | 'operating' | 'depreciation' | 'financial' | 'income_tax';

export interface Account { code: string; name: string; type: AccountType; group: AccountGroup; system?: boolean; archived?: boolean }
export interface JournalLine { account: string; debitMinor: number; creditMinor: number; memo?: string }
export interface JournalEntry {
  id: string;
  /** Fecha contable AAAA-MM-DD. */
  date: string;
  description: string;
  currency: string;
  lines: JournalLine[];
  /** Hay justificante (factura, extracto) que respalda el asiento. */
  verified: boolean;
  source: string;
  reference?: string;
  /** Producto o proyecto al que pertenece (opcional). */
  productId?: string;
  /** Si este asiento anula a otro, el id del anulado. */
  reverses?: string;
  createdAt: string;
  createdBy?: string;
}

export const BOOKS_POLICY_VERSION = 'company-books-v1';

const GROUP_TYPE: Record<AccountGroup, AccountType> = {
  cash: 'asset', receivable: 'asset', tax_asset: 'asset', fixed_asset: 'asset', other_asset: 'asset',
  payable: 'liability', tax_liability: 'liability', loan: 'liability', other_liability: 'liability',
  capital: 'equity', drawings: 'equity', retained: 'equity',
  revenue: 'income', other_income: 'income',
  direct_cost: 'expense', operating: 'expense', depreciation: 'expense', financial: 'expense', income_tax: 'expense',
};

/** Plan de cuentas inicial: corto y en lenguaje llano. El anfitrión puede añadir cuentas. */
export const DEFAULT_CHART: readonly Account[] = Object.freeze([
  { code: '1000', name: 'Banco', type: 'asset', group: 'cash', system: true },
  { code: '1010', name: 'Caja (efectivo)', type: 'asset', group: 'cash', system: true },
  { code: '1020', name: 'Pasarelas de pago (Stripe, PayPal…)', type: 'asset', group: 'cash', system: true },
  { code: '1100', name: 'Clientes (facturas por cobrar)', type: 'asset', group: 'receivable', system: true },
  { code: '1200', name: 'IVA soportado (por recuperar)', type: 'asset', group: 'tax_asset', system: true },
  { code: '1500', name: 'Equipos y material', type: 'asset', group: 'fixed_asset', system: true },
  { code: '1590', name: 'Amortización acumulada', type: 'asset', group: 'fixed_asset', system: true },
  { code: '2000', name: 'Proveedores (facturas por pagar)', type: 'liability', group: 'payable', system: true },
  { code: '2100', name: 'IVA repercutido (por pagar)', type: 'liability', group: 'tax_liability', system: true },
  { code: '2200', name: 'Impuestos por pagar', type: 'liability', group: 'tax_liability', system: true },
  { code: '2500', name: 'Préstamos', type: 'liability', group: 'loan', system: true },
  { code: '3000', name: 'Capital aportado por los socios', type: 'equity', group: 'capital', system: true },
  { code: '3100', name: 'Retiros de los socios', type: 'equity', group: 'drawings', system: true },
  { code: '4000', name: 'Ventas y servicios', type: 'income', group: 'revenue', system: true },
  { code: '4900', name: 'Otros ingresos', type: 'income', group: 'other_income', system: true },
  { code: '6000', name: 'Costes directos de los servicios', type: 'expense', group: 'direct_cost', system: true },
  { code: '6100', name: 'Software y suscripciones', type: 'expense', group: 'operating', system: true },
  { code: '6200', name: 'Marketing y publicidad', type: 'expense', group: 'operating', system: true },
  { code: '6300', name: 'Comisiones de pasarelas y bancos', type: 'expense', group: 'operating', system: true },
  { code: '6400', name: 'Personal y colaboradores', type: 'expense', group: 'operating', system: true },
  { code: '6500', name: 'Oficina, suministros y telefonía', type: 'expense', group: 'operating', system: true },
  { code: '6600', name: 'Viajes y desplazamientos', type: 'expense', group: 'operating', system: true },
  { code: '6700', name: 'Tasas y otros tributos', type: 'expense', group: 'operating', system: true },
  { code: '6800', name: 'Amortización', type: 'expense', group: 'depreciation', system: true },
  { code: '6850', name: 'Intereses y gastos financieros', type: 'expense', group: 'financial', system: true },
  { code: '6900', name: 'Otros gastos', type: 'expense', group: 'operating', system: true },
  { code: '6950', name: 'Impuesto sobre el beneficio', type: 'expense', group: 'income_tax', system: true },
] as Account[]);

/* ── Validación ──────────────────────────────────────────────────────────────────────────────────────── */

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
const minor = (value: unknown, label: string): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer in minor units (cents)`);
  return value;
};
export const normalizeCurrency = (value: unknown): string => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('currency must be a 3-letter ISO code');
  return code;
};

export function createAccount(input: Partial<Account>): Account {
  const code = text(input.code, 12);
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{1,11}$/.test(code)) throw new Error('account code must be 2-12 letters/digits');
  const name = text(input.name, 80);
  if (!name) throw new Error('account name is required');
  const group = input.group as AccountGroup;
  if (!Object.prototype.hasOwnProperty.call(GROUP_TYPE, group)) throw new Error('unknown account group');
  const type = GROUP_TYPE[group];
  if (input.type && input.type !== type) throw new Error(`group ${group} belongs to type ${type}`);
  return { code, name, type, group, ...(input.system ? { system: true } : {}), ...(input.archived ? { archived: true } : {}) };
}

export interface EntryInput {
  id: string; date: string; description: string; currency?: string; lines: Array<Partial<JournalLine>>;
  verified?: boolean; source?: string; reference?: string; productId?: string; reverses?: string; createdAt: string; createdBy?: string;
}

/** Valida y normaliza un asiento contra el plan de cuentas. Lanza error si no cuadra. */
export function createJournalEntry(input: EntryInput, chart: readonly Account[]): JournalEntry {
  const id = text(input.id, 80);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,79}$/.test(id)) throw new Error('entry id is invalid');
  if (!isDate(input.date)) throw new Error('entry date must be YYYY-MM-DD');
  const description = text(input.description, 240);
  if (!description) throw new Error('entry description is required');
  const currency = normalizeCurrency(input.currency ?? 'EUR');
  if (!Array.isArray(input.lines) || input.lines.length < 2 || input.lines.length > 40) throw new Error('an entry needs between 2 and 40 lines');
  const accounts = new Map(chart.map((account) => [account.code, account]));
  let debit = 0; let credit = 0;
  const lines = input.lines.map((raw, index) => {
    const code = text(raw.account, 12);
    const account = accounts.get(code);
    if (!account) throw new Error(`line ${index + 1}: unknown account ${code || '(empty)'}`);
    if (account.archived) throw new Error(`line ${index + 1}: account ${code} is archived`);
    const debitMinor = minor(raw.debitMinor, `line ${index + 1} debit`);
    const creditMinor = minor(raw.creditMinor, `line ${index + 1} credit`);
    if ((debitMinor > 0) === (creditMinor > 0)) throw new Error(`line ${index + 1}: use either debit or credit, greater than zero`);
    debit += debitMinor; credit += creditMinor;
    const memo = text(raw.memo, 160);
    return { account: code, debitMinor, creditMinor, ...(memo ? { memo } : {}) };
  });
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) throw new Error('entry total is too large');
  if (debit !== credit) throw new Error(`entry is not balanced: debit ${debit} ≠ credit ${credit}`);
  const reference = text(input.reference, 120);
  const productId = text(input.productId, 80);
  const reverses = text(input.reverses, 80);
  const createdBy = text(input.createdBy, 120);
  const createdAt = typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : '';
  if (!createdAt) throw new Error('createdAt must be an ISO timestamp');
  return {
    id, date: input.date, description, currency, lines, verified: input.verified === true, source: text(input.source, 80) || 'manual',
    ...(reference ? { reference } : {}), ...(productId ? { productId } : {}), ...(reverses ? { reverses } : {}), createdAt, ...(createdBy ? { createdBy } : {}),
  };
}

/** Contrasiento: mismas líneas con Debe y Haber intercambiados. Así se corrige sin borrar. */
export function reverseEntry(entry: JournalEntry, options: { id: string; date: string; createdAt: string; reason?: string; createdBy?: string }, chart: readonly Account[]): JournalEntry {
  if (entry.reverses) throw new Error('a reversal entry cannot be reversed; post a new entry instead');
  const reason = text(options.reason, 120);
  return createJournalEntry({
    id: options.id, date: options.date, currency: entry.currency, createdAt: options.createdAt, createdBy: options.createdBy,
    description: `Anulación de «${entry.description.slice(0, 150)}»${reason ? ` — ${reason}` : ''}`,
    lines: entry.lines.map((line) => ({ account: line.account, debitMinor: line.creditMinor, creditMinor: line.debitMinor })),
    verified: entry.verified, source: 'reversal', reverses: entry.id, ...(entry.productId ? { productId: entry.productId } : {}),
  }, chart.map((account) => ({ ...account, archived: false })));
}

/* ── Asientos sencillos: «cobré», «pagué», «facturé»… sin saber contabilidad ──────────────────────── */

export type QuickKind = 'income' | 'expense' | 'invoice_issued' | 'invoice_received' | 'customer_payment' | 'supplier_payment'
  | 'owner_contribution' | 'owner_withdrawal' | 'asset_purchase' | 'loan_received' | 'loan_repayment' | 'vat_payment' | 'transfer';

export interface QuickInput {
  kind: QuickKind;
  /** Importe TOTAL (con IVA incluido si lo hay), en céntimos. */
  amountMinor: number;
  /** Tipo de IVA en puntos básicos sobre la base (2100 = 21 %). 0 o ausente = sin IVA. */
  vatBasisPoints?: number;
  /** Cuenta de ingreso o gasto (por defecto 4000 / 6900). */
  category?: string;
  /** Cuenta de dinero: 1000 banco (por defecto), 1010 caja, 1020 pasarelas. */
  moneyAccount?: string;
  /** Solo para `transfer`: cuenta de dinero de destino. */
  toAccount?: string;
}

/** Separa un total con IVA incluido en base e IVA, sin perder céntimos (base + IVA = total). */
export function splitVat(totalMinor: number, vatBasisPoints: number): { netMinor: number; vatMinor: number } {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new Error('amount must be a non-negative integer in cents');
  if (!Number.isInteger(vatBasisPoints) || vatBasisPoints < 0 || vatBasisPoints > 10_000) throw new Error('vatBasisPoints must be between 0 and 10000');
  const netMinor = Math.round((totalMinor * 10_000) / (10_000 + vatBasisPoints));
  return { netMinor, vatMinor: totalMinor - netMinor };
}

/** Traduce una operación sencilla a líneas de partida doble. */
export function quickLines(input: QuickInput): JournalLine[] {
  const total = input.amountMinor;
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('amount must be a positive integer in cents');
  const money = input.moneyAccount || '1000';
  const { netMinor, vatMinor } = splitVat(total, input.vatBasisPoints ?? 0);
  const dr = (account: string, amount: number): JournalLine => ({ account, debitMinor: amount, creditMinor: 0 });
  const cr = (account: string, amount: number): JournalLine => ({ account, debitMinor: 0, creditMinor: amount });
  const withVat = (lines: JournalLine[], vatLine: JournalLine): JournalLine[] => (vatMinor > 0 ? [...lines, vatLine] : lines);
  switch (input.kind) {
    case 'income': return withVat([dr(money, total), cr(input.category || '4000', netMinor)], cr('2100', vatMinor));
    case 'invoice_issued': return withVat([dr('1100', total), cr(input.category || '4000', netMinor)], cr('2100', vatMinor));
    case 'customer_payment': return [dr(money, total), cr('1100', total)];
    case 'expense': return withVat([dr(input.category || '6900', netMinor), cr(money, total)], dr('1200', vatMinor));
    case 'invoice_received': return withVat([dr(input.category || '6900', netMinor), cr('2000', total)], dr('1200', vatMinor));
    case 'supplier_payment': return [dr('2000', total), cr(money, total)];
    case 'owner_contribution': return [dr(money, total), cr('3000', total)];
    case 'owner_withdrawal': return [dr('3100', total), cr(money, total)];
    case 'asset_purchase': return withVat([dr(input.category || '1500', netMinor), cr(money, total)], dr('1200', vatMinor));
    case 'loan_received': return [dr(money, total), cr('2500', total)];
    case 'loan_repayment': return [dr('2500', total), cr(money, total)];
    case 'vat_payment': return [dr('2100', total), cr(money, total)];
    case 'transfer': {
      if (!input.toAccount || input.toAccount === money) throw new Error('transfer needs a different destination account');
      return [dr(input.toAccount, total), cr(money, total)];
    }
    default: throw new Error('unknown quick kind');
  }
}

export const QUICK_LABELS: Readonly<Record<QuickKind, string>> = Object.freeze({
  income: 'Cobro (venta cobrada en el momento)', expense: 'Pago (gasto pagado en el momento)',
  invoice_issued: 'Factura emitida (aún sin cobrar)', invoice_received: 'Factura recibida (aún sin pagar)',
  customer_payment: 'Un cliente paga una factura', supplier_payment: 'Pago de una factura a un proveedor',
  owner_contribution: 'Aportación de un socio', owner_withdrawal: 'Retiro de un socio',
  asset_purchase: 'Compra de equipo', loan_received: 'Préstamo recibido', loan_repayment: 'Devolución de préstamo',
  vat_payment: 'Pago de IVA a Hacienda', transfer: 'Traspaso entre cuentas propias',
});

/* ── Saldos ──────────────────────────────────────────────────────────────────────────────────────────── */

const DEBIT_NATURE: Record<AccountType, boolean> = { asset: true, expense: true, liability: false, equity: false, income: false };

export interface AccountBalance { code: string; name: string; type: AccountType; group: AccountGroup; debitMinor: number; creditMinor: number; balanceMinor: number }
export interface Period { from?: string; to?: string }

const inPeriod = (date: string, period: Period): boolean => (!period.from || date >= period.from) && (!period.to || date <= period.to);

/** Saldos por cuenta (signo natural: activo/gasto = Debe − Haber; pasivo/patrimonio/ingreso = Haber − Debe). */
export function accountBalances(entries: readonly JournalEntry[], chart: readonly Account[], currency: string, period: Period = {}): AccountBalance[] {
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const entry of entries) {
    if (entry.currency !== currency || !inPeriod(entry.date, period)) continue;
    for (const line of entry.lines) {
      const sum = totals.get(line.account) ?? { debit: 0, credit: 0 };
      sum.debit += line.debitMinor; sum.credit += line.creditMinor;
      totals.set(line.account, sum);
    }
  }
  return chart.flatMap((account) => {
    const sum = totals.get(account.code);
    if (!sum) return [];
    const balanceMinor = DEBIT_NATURE[account.type] ? sum.debit - sum.credit : sum.credit - sum.debit;
    return [{ code: account.code, name: account.name, type: account.type, group: account.group, debitMinor: sum.debit, creditMinor: sum.credit, balanceMinor }];
  }).sort((a, b) => a.code.localeCompare(b.code));
}

export interface TrialBalance { currency: string; period: Period; rows: AccountBalance[]; totalDebitMinor: number; totalCreditMinor: number; balanced: boolean }
export function trialBalance(entries: readonly JournalEntry[], chart: readonly Account[], currency: string, period: Period = {}): TrialBalance {
  const rows = accountBalances(entries, chart, currency, period);
  const totalDebitMinor = rows.reduce((sum, row) => sum + row.debitMinor, 0);
  const totalCreditMinor = rows.reduce((sum, row) => sum + row.creditMinor, 0);
  return { currency, period, rows, totalDebitMinor, totalCreditMinor, balanced: totalDebitMinor === totalCreditMinor };
}

export interface ReportLine { code: string; name: string; amountMinor: number }
export interface ReportSection { key: string; label: string; lines: ReportLine[]; totalMinor: number }
export interface Evidence { entries: number; unverifiedEntries: number; firstDate: string | null; lastDate: string | null }

const section = (key: string, label: string, rows: AccountBalance[], groups: AccountGroup[], sign = 1): ReportSection => {
  const lines = rows.filter((row) => groups.includes(row.group) && row.balanceMinor !== 0).map((row) => ({ code: row.code, name: row.name, amountMinor: row.balanceMinor * sign }));
  return { key, label, lines, totalMinor: lines.reduce((sum, line) => sum + line.amountMinor, 0) };
};
const evidence = (entries: readonly JournalEntry[], currency: string, period: Period): Evidence => {
  const used = entries.filter((entry) => entry.currency === currency && inPeriod(entry.date, period));
  const dates = used.map((entry) => entry.date).sort();
  return { entries: used.length, unverifiedEntries: used.filter((entry) => !entry.verified).length, firstDate: dates[0] ?? null, lastDate: dates.at(-1) ?? null };
};

/* ── Estado de resultados (pérdidas y ganancias) ─────────────────────────────────────────────────────── */

export interface IncomeStatement {
  kind: 'income_statement'; policyVersion: string; currency: string; from: string; to: string;
  revenue: ReportSection; directCosts: ReportSection; grossProfitMinor: number;
  operatingExpenses: ReportSection; depreciation: ReportSection; operatingResultMinor: number;
  otherIncome: ReportSection; financial: ReportSection; resultBeforeTaxMinor: number;
  incomeTax: ReportSection; netResultMinor: number;
  /** Margen neto en puntos básicos sobre ventas (null si no hay ventas). */
  netMarginBasisPoints: number | null;
  evidence: Evidence;
}

export function incomeStatement(entries: readonly JournalEntry[], chart: readonly Account[], options: { from: string; to: string; currency?: string }): IncomeStatement {
  if (!isDate(options.from) || !isDate(options.to) || options.from > options.to) throw new Error('period must be from ≤ to in YYYY-MM-DD');
  const currency = normalizeCurrency(options.currency ?? 'EUR');
  const period = { from: options.from, to: options.to };
  const rows = accountBalances(entries, chart, currency, period);
  const revenue = section('revenue', 'Ventas y servicios', rows, ['revenue']);
  const directCosts = section('direct_costs', 'Costes directos', rows, ['direct_cost']);
  const operatingExpenses = section('operating', 'Gastos de funcionamiento', rows, ['operating']);
  const depreciation = section('depreciation', 'Amortización', rows, ['depreciation']);
  const otherIncome = section('other_income', 'Otros ingresos', rows, ['other_income']);
  const financial = section('financial', 'Gastos financieros', rows, ['financial']);
  const incomeTax = section('income_tax', 'Impuesto sobre el beneficio', rows, ['income_tax']);
  const grossProfitMinor = revenue.totalMinor - directCosts.totalMinor;
  const operatingResultMinor = grossProfitMinor - operatingExpenses.totalMinor - depreciation.totalMinor;
  const resultBeforeTaxMinor = operatingResultMinor + otherIncome.totalMinor - financial.totalMinor;
  const netResultMinor = resultBeforeTaxMinor - incomeTax.totalMinor;
  return {
    kind: 'income_statement', policyVersion: BOOKS_POLICY_VERSION, currency, from: options.from, to: options.to,
    revenue, directCosts, grossProfitMinor, operatingExpenses, depreciation, operatingResultMinor,
    otherIncome, financial, resultBeforeTaxMinor, incomeTax, netResultMinor,
    netMarginBasisPoints: revenue.totalMinor > 0 ? Math.round((netResultMinor * 10_000) / revenue.totalMinor) : null,
    evidence: evidence(entries, currency, period),
  };
}

/* ── Balance (situación a una fecha) ─────────────────────────────────────────────────────────────────── */

export interface BalanceSheet {
  kind: 'balance_sheet'; policyVersion: string; currency: string; asOf: string;
  assets: ReportSection[]; totalAssetsMinor: number;
  liabilities: ReportSection[]; totalLiabilitiesMinor: number;
  equity: ReportSection[]; totalEquityMinor: number;
  /** Resultado acumulado hasta la fecha (ingresos − gastos de toda la historia), ya incluido en el patrimonio. */
  accumulatedResultMinor: number;
  totalLiabilitiesAndEquityMinor: number;
  /** Activo − (Pasivo + Patrimonio). Debe ser 0. */
  differenceMinor: number;
  balanced: boolean;
  evidence: Evidence;
}

export function balanceSheet(entries: readonly JournalEntry[], chart: readonly Account[], options: { asOf: string; currency?: string }): BalanceSheet {
  if (!isDate(options.asOf)) throw new Error('asOf must be YYYY-MM-DD');
  const currency = normalizeCurrency(options.currency ?? 'EUR');
  const period = { to: options.asOf };
  const rows = accountBalances(entries, chart, currency, period);
  const assets = [
    section('cash', 'Dinero disponible', rows, ['cash']),
    section('receivable', 'Por cobrar', rows, ['receivable', 'tax_asset', 'other_asset']),
    section('fixed', 'Equipos (neto de amortización)', rows, ['fixed_asset']),
  ];
  const liabilities = [
    section('payable', 'Por pagar a proveedores', rows, ['payable']),
    section('tax', 'Impuestos por pagar', rows, ['tax_liability']),
    section('loans', 'Préstamos y otras deudas', rows, ['loan', 'other_liability']),
  ];
  const accumulatedResultMinor = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.balanceMinor, 0)
    - rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.balanceMinor, 0);
  const capital = section('capital', 'Capital aportado', rows, ['capital', 'retained']);
  // Los retiros tienen saldo acreedor negativo de forma natural: restan patrimonio.
  const drawings = section('drawings', 'Retiros de los socios', rows, ['drawings']);
  const result: ReportSection = { key: 'result', label: 'Resultado acumulado', lines: [{ code: '—', name: 'Ingresos menos gastos hasta la fecha', amountMinor: accumulatedResultMinor }], totalMinor: accumulatedResultMinor };
  const equity = [capital, drawings, result];
  const total = (sections: ReportSection[]): number => sections.reduce((sum, item) => sum + item.totalMinor, 0);
  const totalAssetsMinor = total(assets);
  const totalLiabilitiesMinor = total(liabilities);
  const totalEquityMinor = total(equity);
  const differenceMinor = totalAssetsMinor - totalLiabilitiesMinor - totalEquityMinor;
  return {
    kind: 'balance_sheet', policyVersion: BOOKS_POLICY_VERSION, currency, asOf: options.asOf,
    assets, totalAssetsMinor, liabilities, totalLiabilitiesMinor, equity, totalEquityMinor, accumulatedResultMinor,
    totalLiabilitiesAndEquityMinor: totalLiabilitiesMinor + totalEquityMinor, differenceMinor, balanced: differenceMinor === 0,
    evidence: evidence(entries, currency, period),
  };
}

/* ── Utilidades para el anfitrión ────────────────────────────────────────────────────────────────────── */

/** «1.234,56», «1234,56», «1234.5» o «1234» → céntimos. Lanza error si no es un importe claro. */
export function parseAmountToMinor(value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error('amount is invalid');
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 1e-6 || !Number.isSafeInteger(cents)) throw new Error('amount has more than two decimals');
    return cents;
  }
  const raw = typeof value === 'string' ? value.replace(/[\s€$]/g, '') : '';
  // Miles solo con punto (1.234,56); decimales con coma o punto. «12,345» es ambiguo y se rechaza.
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error('amount is not a clear number (use 1234,56)');
  const cents = Number(match[1]!.replace(/\./g, '')) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('amount is too large');
  return cents;
}

/** Monedas con asientos, EUR primero. */
export function currenciesIn(entries: readonly JournalEntry[]): string[] {
  const set = new Set(entries.map((entry) => entry.currency));
  return [...set].sort((a, b) => (a === 'EUR' ? -1 : b === 'EUR' ? 1 : a.localeCompare(b)));
}

/** Exporta el diario a CSV (para el contable). Separador «;», importes con coma decimal. */
export function journalCsv(entries: readonly JournalEntry[], chart: readonly Account[]): string {
  const names = new Map(chart.map((account) => [account.code, account.name]));
  const cell = (value: string): string => {
    // Neutraliza fórmulas de hoja de cálculo y escapa comillas.
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const money = (cents: number): string => (cents ? `${Math.trunc(cents / 100)},${String(cents % 100).padStart(2, '0')}` : '');
  const rows = ['Fecha;Asiento;Descripción;Cuenta;Nombre de la cuenta;Debe;Haber;Moneda;Justificante;Referencia;Anula a'];
  for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))) {
    for (const line of entry.lines) {
      rows.push([entry.date, cell(entry.id), cell(entry.description), cell(line.account), cell(names.get(line.account) ?? ''), money(line.debitMinor), money(line.creditMinor), entry.currency, entry.verified ? 'sí' : 'no', cell(entry.reference ?? ''), cell(entry.reverses ?? '')].join(';'));
    }
  }
  return `${rows.join('\r\n')}\r\n`;
}
