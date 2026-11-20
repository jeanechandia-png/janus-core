/** Shared by the existing radar. Euro cents and comparable, current evidence; no inferred savings. */
export interface DealEconomics {
  priceCents: number;
  reference?: { priceCents: number; sourceUrl: string; verifiedAt: string; validUntil: string; sameQuantity: boolean };
  /** Explicit zero is different from unmeasured delivery/travel/waste. */
  extraCostCents?: number;
  materialConditions: string[];
}
export interface DealValue {
  status: 'verified_savings' | 'reference_unconfirmed' | 'no_saving';
  headline: string;
  grossSavingCents: number | null;
  netSavingCents: number | null;
  percent: number | null;
  materialConditions: string[];
  sourceUrl: string | null;
}
const money = (n: number) => `€${(n / 100).toFixed(2)}`;
const cents = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;

export function validateDealEconomics(value: DealEconomics): DealEconomics {
  if (!value || !cents(value.priceCents) || (value.extraCostCents !== undefined && !cents(value.extraCostCents))) throw new Error('deal amounts must be non-negative integer euro cents');
  if (!Array.isArray(value.materialConditions) || value.materialConditions.length > 20 || value.materialConditions.some(c => typeof c !== 'string' || !c.trim() || c.length > 500)) throw new Error('invalid material deal conditions');
  if (value.reference) {
    const r = value.reference;
    let url: URL; try { url = new URL(r.sourceUrl); } catch { throw new Error('invalid reference source'); }
    if (!cents(r.priceCents) || url.protocol !== 'https:' || url.username || url.password || typeof r.sameQuantity !== 'boolean' || !Number.isFinite(Date.parse(r.verifiedAt)) || !Number.isFinite(Date.parse(r.validUntil)) || Date.parse(r.validUntil) <= Date.parse(r.verifiedAt)) throw new Error('invalid reference evidence');
    if (!Number.isSafeInteger(r.priceCents - value.priceCents - (value.extraCostCents ?? 0))) throw new Error('deal arithmetic exceeds safe integer range');
  }
  return { priceCents: value.priceCents, materialConditions: [...value.materialConditions],
    ...(value.extraCostCents !== undefined ? { extraCostCents: value.extraCostCents } : {}),
    ...(value.reference ? { reference: { priceCents: value.reference.priceCents, sourceUrl: value.reference.sourceUrl, verifiedAt: value.reference.verifiedAt, validUntil: value.reference.validUntil, sameQuantity: value.reference.sameQuantity } } : {}) };
}

export function evaluateDealValue(input: DealEconomics, verifiedOpportunity: boolean, now: string): DealValue {
  const d = validateDealEconomics(input), r = d.reference, at = Date.parse(now);
  if (!Number.isFinite(at)) throw new Error('invalid deal evaluation time');
  const base: DealValue = { status: 'reference_unconfirmed', headline: `Pagas ${money(d.priceCents)} · referencia por confirmar`, grossSavingCents: null, netSavingCents: null, percent: null, materialConditions: [...d.materialConditions], sourceUrl: r?.sourceUrl ?? null };
  if (!verifiedOpportunity || !r || !r.sameQuantity || at < Date.parse(r.verifiedAt) || at >= Date.parse(r.validUntil)) return base;
  const gross = r.priceCents - d.priceCents;
  const net = d.extraCostCents === undefined ? null : gross - d.extraCostCents;
  const positive = gross > 0 && (net === null || net > 0);
  return { ...base, status: positive ? 'verified_savings' : 'no_saving', grossSavingCents: gross, netSavingCents: net,
    percent: r.priceCents > 0 ? Math.round(gross / r.priceCents * 100) : null,
    headline: positive ? (net === null ? `Ahorro bruto ${money(gross)} · costes adicionales por confirmar` : `Ahorras ${money(net)} netos`) : `Sin ahorro neto acreditado · pagas ${money(d.priceCents)}` };
}
