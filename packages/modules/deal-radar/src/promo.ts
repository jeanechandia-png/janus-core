/** Lectura de promociones típicas de supermercados y tiendas en Países Bajos. */
import type { PromoEffect } from './types.js';
import { normalize, round2 } from './text.js';

/**
 * Interpreta el texto de la promoción y devuelve el descuento efectivo por unidad.
 * Formatos: "1+1 gratis", "2+1 gratis", "2e halve prijs", "2e gratis", "25% korting", "-30%",
 * "2 voor 3,00" / "2 voor €3" (requiere precio unitario), "halve prijs", "50% korting op de 2e".
 */
export function parsePromo(promoText: string | undefined, unitPrice?: number): PromoEffect | undefined {
  if (!promoText) return undefined;
  const t = normalize(promoText).replace(/€/g, '');
  let m = t.match(/(\d+)\s*\+\s*(\d+)\s*gratis/);
  if (m && m[1] && m[2]) { const buy = Number(m[1]), free = Number(m[2]); return { discount: round2(free / (buy + free)), units: buy + free, label: buy + '+' + free + ' gratis' }; }
  if (/2e\s*(artikel\s*)?gratis/.test(t)) return { discount: 0.5, units: 2, label: '2.º gratis' };
  if (/2e\s*(artikel\s*)?halve\s*prijs/.test(t) || /50\s*%\s*korting\s*op\s*de\s*2e/.test(t)) return { discount: 0.25, units: 2, label: '2.ª a mitad de precio' };
  if (/halve\s*prijs|mitad\s*de\s*precio/.test(t)) return { discount: 0.5, units: 1, label: 'Mitad de precio' };
  m = t.match(/(\d+(?:[.,]\d+)?)\s*%\s*(korting|descuento|off)?/) || t.match(/-\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (m && m[1]) { const d = Number(m[1].replace(',', '.')) / 100; if (d > 0 && d < 1) return { discount: round2(d), units: 1, label: Math.round(d * 100) + '% de descuento' }; }
  m = t.match(/(\d+)\s*voor\s*(\d+(?:[.,]\d+)?)/);
  if (m && m[1] && m[2] && unitPrice && unitPrice > 0) {
    const n = Number(m[1]), total = Number(m[2].replace(',', '.')), d = 1 - total / (n * unitPrice);
    if (d > 0 && d < 1) return { discount: round2(d), units: n, label: n + ' por €' + total.toFixed(2).replace('.', ',') };
  }
  return undefined;
}

/** Descuento de una oferta: primero por precios explícitos, si no por el texto de la promoción. */
export function offerDiscount(regular: number | undefined, price: number | undefined, promoText: string | undefined, lastPaid?: number): { discount: number; promo?: PromoEffect } {
  const base = regular ?? lastPaid;
  if (base && price && price < base) return { discount: round2(1 - price / base) };
  const promo = parsePromo(promoText, base ?? price);
  return promo ? { discount: promo.discount, promo } : { discount: 0 };
}
