import type { ProductHealthSnapshot, ProductOperationalRecord } from './business-operations.js';

/** FinOps es una proyección de lecturas verificadas del Operations Hub existente.
 * No recrea una base de datos ni presupone suscripciones. El origen de los
 * importes EUR debe haberse verificado ANTES de la ingesta al core.
 */
export interface PlatformFinOpsPoint {
  date?: string;
  month?: string;
  eur: number;
}
export interface PlatformFinOpsProvider {
  id: string;
  name: string;
  source: string | null;
  verifiedAt: string | null;
  budgetEur: number | null;
  spentEur: number | null;
  creditsUsed: number | null;
  creditsLimit: number | null;
  charactersUsed: number | null;
  charactersLimit: number | null;
  creditDaily: Array<{date: string; credits: number}>;
  openInvoices: boolean;
  currentOverageEur: number | null;
  daily: PlatformFinOpsPoint[];
  monthly: PlatformFinOpsPoint[];
  renewalDate: string | null;
  health: 'healthy' | 'degraded' | 'down' | 'unknown';
  plan: string | null;
  fallback: string | null;
}
export interface PlatformFinOpsSnapshot {
  generatedAt: string;
  providers: PlatformFinOpsProvider[];
}
function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function euro(value: unknown): number | null {
  const v = numeric(value);
  return v === null ? null : Math.round(v * 100) / 100;
}
function label(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 300) : null;
}
function date(value: unknown): string | null {
  const v = label(value);
  return v && !Number.isNaN(Date.parse(v)) ? v : null;
}
export function buildPlatformFinOpsSnapshot(
  records: ProductOperationalRecord[],
  healthReadings: ProductHealthSnapshot[],
  generatedAt: string,
): PlatformFinOpsSnapshot {
  const providers = records.filter((record) => record.tags?.includes('finops:provider')).map((record) => {
    const history = healthReadings.filter((s) => s.productId === record.id
      && date(s.observedAt) !== null && typeof s.source === 'string' && s.source.trim())
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const latest = history.at(-1);
    const m = latest?.metrics ?? {};
    const days = new Map<string, PlatformFinOpsPoint>();
    const months = new Map<string, PlatformFinOpsPoint>();
    const creditDays = new Map<string, {date: string; credits: number}>();
    for (const reading of history) {
      const keyDay = reading.observedAt.slice(0, 10);
      const keyMonth = reading.observedAt.slice(0, 7);
      const dailyCost = euro(reading.metrics?.dailySpendEur);
      const credits = numeric(reading.metrics?.creditsToday);
      const monthlyToDate = euro(reading.metrics?.spentEur);
      // Los puntos publicados son la ÚLTIMA lectura del día/mes;
      // jamás se suman lecturas acumulativas entre sí.
      if (dailyCost !== null) days.set(keyDay, { date: keyDay, eur: dailyCost });
      if (credits !== null) creditDays.set(keyDay, {date: keyDay, credits});
      if (monthlyToDate !== null) months.set(keyMonth, { month: keyMonth, eur: monthlyToDate });
    }
    return {
      id: record.id,
      name: record.name,
      source: label(latest?.source),
      verifiedAt: date(latest?.observedAt),
      budgetEur: euro(m.budgetEur),
      spentEur: euro(m.spentEur),
      creditsUsed: numeric(m.creditsUsed),
      creditsLimit: numeric(m.creditsLimit),
      charactersUsed: numeric(m.charactersUsed),
      charactersLimit: numeric(m.charactersLimit),
      creditDaily: [...creditDays.values()].slice(-31),
      openInvoices: m.openInvoices === true,
      currentOverageEur: euro(m.currentOverageEur),
      daily: [...days.values()].slice(-31),
      monthly: [...months.values()].slice(-12),
      renewalDate: date(m.renewalDate),
      health: latest?.state ?? 'unknown',
      plan: label(m.plan),
      fallback: label(m.fallback),
      ...(m.paymentFailed === true ? { paymentFailed: true } : {}),
    };
  });
  return { generatedAt, providers };
}
