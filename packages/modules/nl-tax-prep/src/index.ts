/**
 * Pieza LEGO «nl-tax-prep»: preparación de la declaración anual ante la Belastingdienst (Países Bajos).
 *
 * Qué hace: a partir de las cifras del año (las entrega la pieza de contabilidad o cualquier otro anfitrión) arma
 * una HOJA DE TRABAJO con el cálculo paso a paso (beneficio → deducciones de empresario → exención mkb → base →
 * impuesto estimado), un resumen de IVA por trimestre, la lista de lo que pide la declaración y los plazos.
 *
 * Anti-obsolescencia (el motivo de este diseño):
 *  - NINGUNA cifra fiscal vive en el código. Todo llega en un «paquete de reglas» por año (datos JSON) donde cada
 *    cifra cita sus fuentes. Cambiar de año = añadir un paquete, sin tocar el código.
 *  - Una cifra solo cuenta como «verificada» con ≥ 2 fuentes de editores distintos y al menos una oficial.
 *  - Sin paquete del año pedido, la pieza NO calcula (no extrapola con cifras de otro año).
 *  - Un paquete revisado hace más de `staleAfterDays` se marca «por revisar» en cada informe.
 *
 * Límites: es una estimación para preparar la declaración con un asesor. No presenta nada ante la Belastingdienst,
 * no cubre pareja fiscal, vivienda, box 2/3, edad AOW ni casos especiales. No es asesoría fiscal.
 * La pieza no guarda nada y no importa nada de fuera.
 */

export const TAX_PREP_POLICY_VERSION = 'nl-tax-prep-v1';

/* ── Paquete de reglas ───────────────────────────────────────────────────────────────────────────────── */

export type SourceKind = 'primary' | 'official' | 'professional' | 'press';
export interface RuleSource { publisher: string; kind: SourceKind; title: string; url: string }
export interface RuleParam<T> { value: T; sources: string[]; note?: string }
export interface Bracket { upToEur: number | null; rateBp: number }
export interface CreditStep { fromEur: number; baseEur: number; ratePer100k: number }
export interface RulePack {
  schema: 'tax-rule-pack-v1'; jurisdiction: string; year: number; status: 'in_force' | 'provisional' | 'announced';
  checkedAt: string; currency: string;
  sources: Record<string, RuleSource>;
  params: {
    box1Brackets: RuleParam<Bracket[]>;
    maxDeductionRateBp: RuleParam<number>;
    zelfstandigenaftrekEur: RuleParam<number>;
    startersaftrekEur: RuleParam<number>;
    urencriteriumHours: RuleParam<number>;
    mkbWinstvrijstellingBp: RuleParam<number>;
    algemeneHeffingskorting: RuleParam<{ maxEur: number; phaseOutFromEur: number; phaseOutPer100k: number; zeroFromEur: number }>;
    arbeidskorting: RuleParam<CreditStep[]>;
    zvw: RuleParam<{ rateBp: number; maxIncomeEur: number }>;
    vpbBrackets: RuleParam<Bracket[]>;
    vatStandardBp: RuleParam<number>;
    vatReducedBp: RuleParam<number>;
    korTurnoverLimitEur: RuleParam<number>;
  };
  deadlines: Array<{ id: string; label: string; date: string; approximate?: boolean; note?: string; sources: string[] }>;
  announced?: Array<{ year: number; text: string; sources: string[] }>;
}

export type Confidence = 'verified' | 'single_source' | 'unsourced';
export interface Citation { confidence: Confidence; sources: RuleSource[]; note?: string }

const PARAM_KEYS = ['box1Brackets', 'maxDeductionRateBp', 'zelfstandigenaftrekEur', 'startersaftrekEur', 'urencriteriumHours', 'mkbWinstvrijstellingBp',
  'algemeneHeffingskorting', 'arbeidskorting', 'zvw', 'vpbBrackets', 'vatStandardBp', 'vatReducedBp', 'korTurnoverLimitEur'] as const;
type ParamKey = typeof PARAM_KEYS[number];

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isInt = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const brackets = (value: unknown, label: string): Bracket[] => {
  if (!Array.isArray(value) || !value.length || value.length > 8) throw new Error(`${label}: brackets required`);
  let previous = 0;
  return value.map((raw, index) => {
    const item = raw as Bracket;
    const last = index === value.length - 1;
    if (!isInt(item.rateBp, 0, 10_000)) throw new Error(`${label}: invalid rate`);
    if (last ? item.upToEur !== null : !isInt(item.upToEur, previous + 1, 100_000_000)) throw new Error(`${label}: thresholds must grow and the last one must be open`);
    if (!last) previous = item.upToEur as number;
    return { upToEur: item.upToEur, rateBp: item.rateBp };
  });
};

/** Valida un paquete de reglas (también los que llegan de fuera: son datos, no instrucciones). */
export function validateRulePack(input: unknown): RulePack {
  const pack = input as RulePack;
  if (!pack || typeof pack !== 'object' || pack.schema !== 'tax-rule-pack-v1') throw new Error('unknown rule pack schema');
  if (pack.jurisdiction !== 'NL') throw new Error('this module only accepts NL rule packs');
  if (!isInt(pack.year, 2020, 2100)) throw new Error('invalid year');
  if (!['in_force', 'provisional', 'announced'].includes(pack.status)) throw new Error('invalid status');
  if (!isDate(pack.checkedAt)) throw new Error('checkedAt must be YYYY-MM-DD');
  if (pack.currency !== 'EUR') throw new Error('currency must be EUR');
  const sources: Record<string, RuleSource> = {};
  for (const [id, raw] of Object.entries(pack.sources ?? {})) {
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) throw new Error(`invalid source id ${id}`);
    const url = typeof raw?.url === 'string' ? raw.url : '';
    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s<>"]*)?$/i.test(url)) throw new Error(`source ${id}: https url required`);
    if (!['primary', 'official', 'professional', 'press'].includes(raw.kind)) throw new Error(`source ${id}: invalid kind`);
    const publisher = String(raw.publisher ?? '').trim().slice(0, 80); const title = String(raw.title ?? '').trim().slice(0, 200);
    if (!publisher || !title) throw new Error(`source ${id}: publisher and title required`);
    sources[id] = { publisher, kind: raw.kind, title, url };
  }
  const refs = (list: unknown, label: string): string[] => {
    if (!Array.isArray(list)) throw new Error(`${label}: sources list required`);
    for (const id of list) if (typeof id !== 'string' || !sources[id]) throw new Error(`${label}: unknown source ${String(id)}`);
    return [...new Set(list as string[])];
  };
  const p = pack.params as RulePack['params'];
  if (!p) throw new Error('params required');
  const note = (raw: { note?: string }): { note?: string } => (typeof raw.note === 'string' && raw.note.trim() ? { note: raw.note.trim().slice(0, 300) } : {});
  const num = (key: ParamKey, min: number, max: number): RuleParam<number> => {
    const raw = p[key] as RuleParam<number>;
    if (!raw || !isInt(raw.value, min, max)) throw new Error(`${key}: invalid value`);
    return { value: raw.value, sources: refs(raw.sources, key), ...note(raw) };
  };
  const ahk = p.algemeneHeffingskorting?.value; const zvw = p.zvw?.value;
  if (!ahk || !isInt(ahk.maxEur, 0, 100_000) || !isInt(ahk.phaseOutFromEur, 0, 10_000_000) || !isInt(ahk.phaseOutPer100k, 0, 100_000) || !isInt(ahk.zeroFromEur, ahk.phaseOutFromEur, 10_000_000)) throw new Error('algemeneHeffingskorting: invalid value');
  if (!zvw || !isInt(zvw.rateBp, 0, 10_000) || !isInt(zvw.maxIncomeEur, 0, 10_000_000)) throw new Error('zvw: invalid value');
  const steps = p.arbeidskorting?.value;
  if (!Array.isArray(steps) || !steps.length || steps.length > 10) throw new Error('arbeidskorting: steps required');
  steps.forEach((step, index) => {
    if (!isInt(step.fromEur, 0, 10_000_000) || !isInt(step.baseEur, 0, 100_000) || !isInt(step.ratePer100k, -100_000, 100_000)) throw new Error('arbeidskorting: invalid step');
    if (index && step.fromEur <= steps[index - 1]!.fromEur) throw new Error('arbeidskorting: steps must grow');
  });
  const deadlines = (Array.isArray(pack.deadlines) ? pack.deadlines : []).slice(0, 30).map((raw) => {
    if (!isDate(raw.date)) throw new Error('deadline date must be YYYY-MM-DD');
    return { id: String(raw.id).slice(0, 40), label: String(raw.label).slice(0, 160), date: raw.date, ...(raw.approximate ? { approximate: true } : {}), ...note(raw), sources: refs(raw.sources, 'deadline') };
  });
  const announced = (Array.isArray(pack.announced) ? pack.announced : []).slice(0, 20).map((raw) => ({ year: Number(raw.year), text: String(raw.text).slice(0, 300), sources: refs(raw.sources, 'announced') }));
  return {
    schema: 'tax-rule-pack-v1', jurisdiction: 'NL', year: pack.year, status: pack.status, checkedAt: pack.checkedAt, currency: 'EUR', sources,
    params: {
      box1Brackets: { value: brackets(p.box1Brackets?.value, 'box1Brackets'), sources: refs(p.box1Brackets?.sources, 'box1Brackets'), ...note(p.box1Brackets) },
      maxDeductionRateBp: num('maxDeductionRateBp', 0, 10_000),
      zelfstandigenaftrekEur: num('zelfstandigenaftrekEur', 0, 100_000),
      startersaftrekEur: num('startersaftrekEur', 0, 100_000),
      urencriteriumHours: num('urencriteriumHours', 0, 8_784),
      mkbWinstvrijstellingBp: num('mkbWinstvrijstellingBp', 0, 10_000),
      algemeneHeffingskorting: { value: { ...ahk }, sources: refs(p.algemeneHeffingskorting.sources, 'algemeneHeffingskorting'), ...note(p.algemeneHeffingskorting) },
      arbeidskorting: { value: steps.map((step) => ({ ...step })), sources: refs(p.arbeidskorting.sources, 'arbeidskorting'), ...note(p.arbeidskorting) },
      zvw: { value: { ...zvw }, sources: refs(p.zvw.sources, 'zvw'), ...note(p.zvw) },
      vpbBrackets: { value: brackets(p.vpbBrackets?.value, 'vpbBrackets'), sources: refs(p.vpbBrackets?.sources, 'vpbBrackets'), ...note(p.vpbBrackets) },
      vatStandardBp: num('vatStandardBp', 0, 10_000), vatReducedBp: num('vatReducedBp', 0, 10_000),
      korTurnoverLimitEur: num('korTurnoverLimitEur', 0, 10_000_000),
    },
    deadlines, ...(announced.length ? { announced } : {}),
  };
}

/** «Verificada» = al menos 2 editores distintos y al menos una fuente oficial o primaria. */
export function citation(pack: RulePack, key: ParamKey): Citation {
  const param = pack.params[key] as RuleParam<unknown>;
  const sources = param.sources.map((id) => pack.sources[id]!).filter(Boolean);
  const publishers = new Set(sources.map((source) => source.publisher));
  const official = sources.some((source) => source.kind === 'primary' || source.kind === 'official');
  const confidence: Confidence = !sources.length ? 'unsourced' : publishers.size >= 2 && official ? 'verified' : 'single_source';
  return { confidence, sources, ...(param.note ? { note: param.note } : {}) };
}

export interface PackHealth { year: number; status: RulePack['status']; checkedAt: string; ageDays: number; stale: boolean; verified: number; singleSource: number; unsourced: number; weak: string[] }
export function packHealth(pack: RulePack, today: string, staleAfterDays = 120): PackHealth {
  const ageDays = Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${pack.checkedAt}T00:00:00Z`)) / 86_400_000));
  const all = PARAM_KEYS.map((key) => [key, citation(pack, key).confidence] as const);
  return {
    year: pack.year, status: pack.status, checkedAt: pack.checkedAt, ageDays, stale: ageDays > staleAfterDays,
    verified: all.filter(([, c]) => c === 'verified').length, singleSource: all.filter(([, c]) => c === 'single_source').length,
    unsourced: all.filter(([, c]) => c === 'unsourced').length, weak: all.filter(([, c]) => c !== 'verified').map(([key]) => key),
  };
}

/** Elige el paquete del año exacto. Nunca usa el de otro año. */
export function selectPack(packs: readonly RulePack[], year: number): RulePack | null {
  const matches = packs.filter((pack) => pack.year === year && pack.jurisdiction === 'NL');
  return matches.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0] ?? null;
}

/* ── Cálculo ─────────────────────────────────────────────────────────────────────────────────────────── */

const EUR = 100;
/** Negativo sin «-0». */
const neg = (value: number): number => (value === 0 ? 0 : -value);
/** Impuesto por tramos sobre un importe en céntimos. */
export function bracketTax(amountMinor: number, table: readonly Bracket[]): number {
  if (amountMinor <= 0) return 0;
  let tax = 0; let floor = 0;
  for (const bracket of table) {
    const ceiling = bracket.upToEur === null ? Infinity : bracket.upToEur * EUR;
    if (amountMinor > floor) tax += (Math.min(amountMinor, ceiling) - floor) * bracket.rateBp / 10_000;
    floor = ceiling;
  }
  return Math.round(tax);
}

export type LegalForm = 'eenmanszaak' | 'vof' | 'bv' | 'unregistered';
export type Basis = 'books' | 'input' | 'rule' | 'computed' | 'estimate';

export interface TaxFigures {
  year: number;
  legalForm: LegalForm;
  /** Beneficio contable del año antes del impuesto sobre el beneficio, en céntimos (de la contabilidad). */
  profitMinor: number;
  /** Ventas del año sin IVA, en céntimos. */
  turnoverMinor: number;
  /** Horas dedicadas a la empresa en el año (para el urencriterium). Sin dato = no se aplica la deducción. */
  hoursWorked?: number;
  /** ¿Cumple las condiciones de la startersaftrek? Lo declara el usuario. */
  starter?: boolean;
  /** Otros ingresos de box 1 (p. ej. sueldo), en céntimos. */
  otherBox1IncomeMinor?: number;
  /** Parte del beneficio que corresponde al socio (vof), en puntos básicos. 10000 = 100 %. */
  shareBp?: number;
  /** Asientos sin justificante en el año (lo informa la contabilidad). */
  unverifiedEntries?: number;
}

export interface WorksheetLine { key: string; label: string; dutch?: string; amountMinor: number; basis: Basis; citation?: Citation; note?: string }
export interface TaxWorksheet {
  kind: 'nl_tax_worksheet'; policyVersion: string; year: number; legalForm: LegalForm; regime: 'inkomstenbelasting' | 'vennootschapsbelasting' | 'none';
  lines: WorksheetLine[];
  estimatedTaxMinor: number | null;
  warnings: string[];
  /** Los mismos avisos como códigos (mismo orden), para productos en varios idiomas. */
  warningCodes: Array<{ code: string; params?: Record<string, string | number> }>;
  checklist: Array<{ item: string; dutch?: string; ready: boolean | null }>;
  deadlines: Array<{ id: string; label: string; date: string; approximate: boolean; daysLeft: number; note?: string; sources: RuleSource[] }>;
  announced: Array<{ year: number; text: string; sources: RuleSource[] }>;
  pack: PackHealth;
  disclaimer: string;
}

const DISCLAIMER = 'Estimación para preparar la declaración. No es asesoría fiscal ni una declaración presentada: revísela con un asesor (boekhouder / belastingadviseur) antes de enviarla a la Belastingdienst.';

function generalCredit(incomeMinor: number, rule: RulePack['params']['algemeneHeffingskorting']['value']): number {
  if (incomeMinor >= rule.zeroFromEur * EUR) return 0;
  const over = Math.max(0, incomeMinor - rule.phaseOutFromEur * EUR);
  return Math.max(0, Math.round(rule.maxEur * EUR - over * rule.phaseOutPer100k / 100_000));
}
function labourCredit(labourIncomeMinor: number, steps: readonly CreditStep[]): number {
  if (labourIncomeMinor <= 0) return 0;
  const step = [...steps].reverse().find((item) => labourIncomeMinor >= item.fromEur * EUR) ?? steps[0]!;
  return Math.max(0, Math.round(step.baseEur * EUR + (labourIncomeMinor - step.fromEur * EUR) * step.ratePer100k / 100_000));
}

export function buildWorksheet(figures: TaxFigures, pack: RulePack, today: string): TaxWorksheet {
  if (pack.year !== figures.year) throw new Error(`rule pack is for ${pack.year}, not ${figures.year}: no se extrapolan cifras de otro año`);
  if (!Number.isSafeInteger(figures.profitMinor) || !Number.isSafeInteger(figures.turnoverMinor)) throw new Error('figures must be integers in cents');
  if (!isDate(today)) throw new Error('today must be YYYY-MM-DD');
  const P = pack.params; const health = packHealth(pack, today);
  const lines: WorksheetLine[] = []; const warnings: string[] = []; const warningCodes: TaxWorksheet['warningCodes'] = [];
  const warn = (code: string, text: string, params?: Record<string, string | number>): void => { warnings.push(text); warningCodes.push(params ? { code, params } : { code }); };
  const add = (line: WorksheetLine): void => { lines.push(line); };
  const shareBp = figures.legalForm === 'vof' ? (isInt(figures.shareBp, 1, 10_000) ? figures.shareBp : 10_000) : 10_000;
  let estimatedTaxMinor: number | null = null;
  let regime: TaxWorksheet['regime'] = 'none';

  add({ key: 'turnover', label: 'Ventas del año (sin IVA)', dutch: 'omzet', amountMinor: figures.turnoverMinor, basis: 'books' });
  add({ key: 'profit', label: 'Beneficio según la contabilidad', dutch: 'winst uit onderneming', amountMinor: figures.profitMinor, basis: 'books' });

  if (health.stale) warn('pack_stale', `Las reglas fiscales de ${pack.year} se revisaron hace ${health.ageDays} días: hay que volver a comprobarlas en las fuentes oficiales.`, { year: pack.year, days: health.ageDays });
  if (pack.status !== 'in_force') warn('pack_not_in_force', `Las reglas de ${pack.year} son ${pack.status === 'provisional' ? 'provisionales' : 'solo anunciadas'}: pueden cambiar.`, { year: pack.year, status: pack.status });
  if (health.weak.length) warn('single_source', `Cifras con una sola fuente (por confirmar): ${health.weak.join(', ')}.`, { params: health.weak.join(', ') });
  if (figures.unverifiedEntries) warn('unverified_entries', `${figures.unverifiedEntries} asiento(s) del año no tienen justificante: el beneficio no está respaldado por completo.`, { count: figures.unverifiedEntries ?? 0 });

  if (figures.legalForm === 'unregistered') {
    warn('unregistered', 'La empresa figura como NO registrada. Sin inscripción en la KVK y sin saber su forma jurídica no se puede decidir qué impuesto aplica: confírmelo antes de usar ningún cálculo.');
  } else if (figures.legalForm === 'bv') {
    regime = 'vennootschapsbelasting';
    const taxable = Math.max(0, figures.profitMinor);
    estimatedTaxMinor = bracketTax(taxable, P.vpbBrackets.value);
    add({ key: 'vpb', label: 'Impuesto de sociedades estimado', dutch: 'vennootschapsbelasting', amountMinor: estimatedTaxMinor, basis: 'estimate', citation: citation(pack, 'vpbBrackets'), note: 'Cálculo simple sobre el beneficio contable. No incluye el sueldo del director (dga), ajustes fiscales ni pérdidas de otros años.' });
    warn('bv_simple', 'Una bv declara impuesto de sociedades y su director tiene además obligaciones de nómina: este cálculo es solo orientativo.');
  } else {
    regime = 'inkomstenbelasting';
    const profit = Math.round(figures.profitMinor * shareBp / 10_000);
    if (shareBp !== 10_000) add({ key: 'share', label: `Su parte del beneficio (${shareBp / 100} %)`, dutch: 'winstaandeel', amountMinor: profit, basis: 'computed' });
    const hoursKnown = typeof figures.hoursWorked === 'number' && figures.hoursWorked >= 0;
    const meetsHours = hoursKnown && (figures.hoursWorked as number) >= P.urencriteriumHours.value;
    if (!hoursKnown) warn('hours_missing', `No hay registro de horas. Las deducciones de empresario exigen al menos ${P.urencriteriumHours.value} horas al año (urencriterium): no se aplican hasta tener el dato.`, { hours: P.urencriteriumHours.value });
    else if (!meetsHours) warn('hours_below', `Con ${figures.hoursWorked} horas no se alcanza el mínimo de ${P.urencriteriumHours.value} (urencriterium): sin deducciones de empresario.`, { worked: figures.hoursWorked ?? 0, hours: P.urencriteriumHours.value });
    const starter = meetsHours && figures.starter === true;
    let za = meetsHours ? P.zelfstandigenaftrekEur.value * EUR : 0;
    // Sin startersaftrek, la zelfstandigenaftrek no puede superar el beneficio.
    if (za && !starter && za > Math.max(0, profit)) { za = Math.max(0, profit); warn('za_capped', 'La zelfstandigenaftrek se limita al beneficio; el resto puede compensarse en años siguientes.'); }
    const sa = starter ? P.startersaftrekEur.value * EUR : 0;
    add({ key: 'za', label: 'Deducción de autónomo', dutch: 'zelfstandigenaftrek', amountMinor: neg(za), basis: 'rule', citation: citation(pack, 'zelfstandigenaftrekEur'), ...(meetsHours ? {} : { note: 'No aplicada: falta acreditar las horas.' }) });
    add({ key: 'sa', label: 'Deducción de inicio de actividad', dutch: 'startersaftrek', amountMinor: neg(sa), basis: 'rule', citation: citation(pack, 'startersaftrekEur'), ...(starter ? {} : { note: 'No aplicada: solo si usted confirma que cumple las condiciones de starter.' }) });
    const afterDeductions = profit - za - sa;
    add({ key: 'after', label: 'Beneficio tras deducciones de empresario', dutch: 'winst na ondernemersaftrek', amountMinor: afterDeductions, basis: 'computed' });
    const mkb = Math.round(afterDeductions * P.mkbWinstvrijstellingBp.value / 10_000);
    add({ key: 'mkb', label: `Exención pyme (${P.mkbWinstvrijstellingBp.value / 100} %)`, dutch: 'mkb-winstvrijstelling', amountMinor: neg(mkb), basis: 'rule', citation: citation(pack, 'mkbWinstvrijstellingBp'), ...(afterDeductions < 0 ? { note: 'Con pérdidas, la exención reduce la pérdida compensable.' } : {}) });
    const taxableProfit = afterDeductions - mkb;
    add({ key: 'taxable_profit', label: 'Beneficio sujeto a impuesto', dutch: 'belastbare winst uit onderneming', amountMinor: taxableProfit, basis: 'computed' });
    const other = Number.isSafeInteger(figures.otherBox1IncomeMinor) ? (figures.otherBox1IncomeMinor as number) : 0;
    if (other) add({ key: 'other', label: 'Otros ingresos del trabajo (dato suyo)', dutch: 'overig inkomen box 1', amountMinor: other, basis: 'input' });
    const box1 = Math.max(0, taxableProfit + other);
    add({ key: 'box1', label: 'Base imponible (box 1)', dutch: 'belastbaar inkomen box 1', amountMinor: box1, basis: 'computed' });
    const gross = bracketTax(box1, P.box1Brackets.value);
    add({ key: 'tax_gross', label: 'Impuesto antes de bonificaciones', dutch: 'inkomstenbelasting en premie volksverzekeringen', amountMinor: gross, basis: 'estimate', citation: citation(pack, 'box1Brackets') });
    // En el tramo alto, las deducciones solo «ahorran» al tipo máximo de deducción.
    const top = P.box1Brackets.value.at(-1)!; const topFloor = (P.box1Brackets.value.at(-2)?.upToEur ?? 0) * EUR;
    const deductions = za + sa + Math.max(0, mkb);
    const before = box1 + deductions;
    const inTop = Math.max(0, Math.min(deductions, before - topFloor));
    const correction = top.rateBp > P.maxDeductionRateBp.value ? Math.round(inTop * (top.rateBp - P.maxDeductionRateBp.value) / 10_000) : 0;
    if (correction) add({ key: 'tariff', label: 'Ajuste: las deducciones cuentan como máximo al tipo reducido', dutch: 'tariefsaanpassing aftrekposten', amountMinor: correction, basis: 'estimate', citation: citation(pack, 'maxDeductionRateBp'), note: 'INFERENCIA: se asume que el ajuste alcanza también a la exención pyme.' });
    const general = generalCredit(box1, P.algemeneHeffingskorting.value);
    const labour = labourCredit(Math.max(0, profit) + Math.max(0, other), P.arbeidskorting.value);
    add({ key: 'ahk', label: 'Bonificación general', dutch: 'algemene heffingskorting', amountMinor: neg(general), basis: 'estimate', citation: citation(pack, 'algemeneHeffingskorting') });
    add({ key: 'ak', label: 'Bonificación por trabajo', dutch: 'arbeidskorting', amountMinor: neg(labour), basis: 'estimate', citation: citation(pack, 'arbeidskorting'), note: 'INFERENCIA: se toma como ingreso del trabajo el beneficio antes de deducciones más los otros ingresos del trabajo.' });
    const income = Math.max(0, gross + correction - general - labour);
    add({ key: 'income_tax', label: 'Impuesto sobre la renta estimado', dutch: 'te betalen inkomstenbelasting', amountMinor: income, basis: 'estimate' });
    const zvwBase = Math.max(0, Math.min(taxableProfit, P.zvw.value.maxIncomeEur * EUR));
    const zvw = Math.round(zvwBase * P.zvw.value.rateBp / 10_000);
    add({ key: 'zvw', label: 'Aportación al seguro de salud', dutch: 'inkomensafhankelijke bijdrage Zvw', amountMinor: zvw, basis: 'estimate', citation: citation(pack, 'zvw') });
    estimatedTaxMinor = income + zvw;
    add({ key: 'total', label: 'Total estimado a pagar por el año', amountMinor: estimatedTaxMinor, basis: 'estimate', note: 'Antes de restar lo ya pagado a cuenta (voorlopige aanslag) o retenido en nómina.' });
  }

  if (figures.turnoverMinor > 0 && figures.turnoverMinor < P.korTurnoverLimitEur.value * EUR && figures.legalForm !== 'unregistered') {
    warn('kor_hint', `Las ventas del año están por debajo de ${P.korTurnoverLimitEur.value.toLocaleString('es-ES')} €: podría valorarse la kleineondernemersregeling (KOR) del IVA con un asesor.`, { limit: P.korTurnoverLimitEur.value });
  }
  const resolve = (ids: string[]): RuleSource[] => ids.map((id) => pack.sources[id]!).filter(Boolean);
  const daysTo = (date: string): number => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return {
    kind: 'nl_tax_worksheet', policyVersion: TAX_PREP_POLICY_VERSION, year: figures.year, legalForm: figures.legalForm, regime, lines, estimatedTaxMinor, warnings, warningCodes,
    checklist: [
      { item: 'Estado de resultados del año', dutch: 'winst-en-verliesrekening', ready: true },
      { item: 'Balance al inicio y al final del año', dutch: 'balans', ready: true },
      { item: 'Todos los asientos con justificante (facturas, extractos)', dutch: 'administratie', ready: figures.unverifiedEntries === undefined ? null : figures.unverifiedEntries === 0 },
      { item: 'Registro de horas dedicadas a la empresa', dutch: 'urenregistratie', ready: typeof figures.hoursWorked === 'number' },
      { item: 'Forma jurídica e inscripción en la KVK confirmadas', dutch: 'rechtsvorm / KVK', ready: figures.legalForm !== 'unregistered' },
      { item: 'Declaraciones de IVA de los cuatro trimestres presentadas', dutch: 'btw-aangiften', ready: null },
      { item: 'Retiros y aportaciones personales del año', dutch: 'privéonttrekkingen en -stortingen', ready: null },
      { item: 'Acceso con DigiD a Mijn Belastingdienst', dutch: 'DigiD', ready: null },
    ],
    deadlines: pack.deadlines.map((d) => ({ id: d.id, label: d.label, date: d.date, approximate: !!d.approximate, daysLeft: daysTo(d.date), ...(d.note ? { note: d.note } : {}), sources: resolve(d.sources) })),
    announced: (pack.announced ?? []).map((a) => ({ year: a.year, text: a.text, sources: resolve(a.sources) })),
    pack: health, disclaimer: DISCLAIMER,
  };
}

/* ── IVA por trimestre ───────────────────────────────────────────────────────────────────────────────── */

/** Movimiento contable mínimo que necesita el resumen de IVA (compatible con el diario de «company-books»). */
export interface VatEntryLike { date: string; source?: string; lines: Array<{ account: string; debitMinor: number; creditMinor: number }> }
export interface VatQuarter { quarter: 1 | 2 | 3 | 4; from: string; to: string; turnoverMinor: number; vatChargedMinor: number; vatPaidMinor: number; balanceMinor: number; dueDate: string | null }

export function vatByQuarter(entries: readonly VatEntryLike[], year: number, accounts: { vatCharged: string; vatPaid: string; revenue: string[] }, pack?: RulePack): VatQuarter[] {
  const ends = ['03-31', '06-30', '09-30', '12-31']; const starts = ['01-01', '04-01', '07-01', '10-01'];
  return ([1, 2, 3, 4] as const).map((quarter) => {
    const from = `${year}-${starts[quarter - 1]}`; const to = `${year}-${ends[quarter - 1]}`;
    let turnover = 0; let charged = 0; let paid = 0;
    for (const entry of entries) {
      if (entry.date < from || entry.date > to) continue;
      // Los pagos de IVA a Hacienda liquidan la deuda: no son IVA del trimestre.
      const settlement = /vat_payment$/.test(entry.source ?? '');
      for (const line of entry.lines) {
        if (accounts.revenue.includes(line.account)) turnover += line.creditMinor - line.debitMinor;
        if (settlement) continue;
        if (line.account === accounts.vatCharged) charged += line.creditMinor - line.debitMinor;
        if (line.account === accounts.vatPaid) paid += line.debitMinor - line.creditMinor;
      }
    }
    const due = pack?.year === year ? pack.deadlines.find((d) => d.id === `btw-q${quarter}`)?.date ?? null : null;
    return { quarter, from, to, turnoverMinor: turnover, vatChargedMinor: charged, vatPaidMinor: paid, balanceMinor: charged - paid, dueDate: due };
  });
}
