/** Plataformas y herramientas: promociones de entrada ("primer mes a 5 €, sin permanencia"). */
import type { SubscriptionOffer } from './types.js';
import { round2 } from './text.js';

export interface SubscriptionVerdict {
  /** Coste total en el horizonte (meses) siguiendo la promo y cancelando al terminarla si conviene. */
  costWithPromo: number;
  costRegular: number;
  savings: number;
  noCommitment: boolean;
  /** Fecha límite para cancelar antes de pagar el precio normal (si se quiere solo la promo). */
  cancelBefore?: string;
  verdict: 'aprovechar' | 'revisar' | 'no-compensa';
  note: string;
}

const addMonths = (d: Date, m: number): Date => { const x = new Date(d.getTime()); x.setUTCMonth(x.getUTCMonth() + m); return x; };
const iso = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Evalúa una promo de suscripción.
 * @param horizonMonths meses que de verdad se usaría el servicio.
 * @param currentMonthly lo que se paga hoy por un servicio equivalente (0 si no se tiene).
 */
export function evaluateSubscription(o: SubscriptionOffer, horizonMonths: number, currentMonthly = 0, start = new Date()): SubscriptionVerdict {
  const h = Math.max(1, horizonMonths);
  const promoMonths = Math.min(o.introMonths, h);
  const paidMonths = Math.max(h - promoMonths, o.minCommitmentMonths - promoMonths, 0);
  const costWithPromo = round2(o.introPrice * promoMonths + o.regularPrice * paidMonths);
  const costRegular = round2((currentMonthly || o.regularPrice) * h);
  const savings = round2(costRegular - costWithPromo);
  const noCommitment = o.minCommitmentMonths === 0;
  const cancel = addMonths(start, o.introMonths); cancel.setUTCDate(cancel.getUTCDate() - 2);
  let verdict: SubscriptionVerdict['verdict'] = 'revisar';
  if (savings > 0 && noCommitment) verdict = 'aprovechar';
  else if (savings <= 0) verdict = 'no-compensa';
  const note = noCommitment
    ? 'Sin permanencia: si solo interesa la promoción, cancelar antes del ' + iso(cancel) + '.'
    : 'Permanencia de ' + o.minCommitmentMonths + ' meses: revisar la letra pequeña antes de aceptar.';
  return { costWithPromo, costRegular, savings, noCommitment, cancelBefore: noCommitment ? iso(cancel) : undefined, verdict, note };
}
