/** Normalización de texto y tamaños (neerlandés, español e inglés). */

const STOP = new Set(['de', 'het', 'een', 'en', 'van', 'met', 'la', 'el', 'los', 'las', 'del', 'y', 'con', 'the', 'and', 'of', 'per', 'stuk', 'stuks', 'pak']);

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%,.+ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokens(text: string): string[] {
  return normalize(text).split(' ').filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+([.,]\d+)?(g|gr|kg|ml|cl|l|st)?$/.test(t));
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** "400 g", "1,5 l", "33cl", "6 x 33 cl", "2 stuks" → cantidad normalizada. */
export function parseSize(text: string): { amount: number; unit: 'g' | 'ml' | 'pcs' } | undefined {
  const t = normalize(text).replace(/,/g, '.');
  const multi = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|gr|l|cl|ml)\b/);
  const one = t.match(/(\d+(?:\.\d+)?)\s*(kg|g|gr|l|cl|ml)\b/);
  const pcs = t.match(/(\d+)\s*(st|stuks|pcs|uds|unidades)\b/);
  const conv = (n: number, u: string): { amount: number; unit: 'g' | 'ml' } => {
    if (u === 'kg') return { amount: n * 1000, unit: 'g' };
    if (u === 'g' || u === 'gr') return { amount: n, unit: 'g' };
    if (u === 'l') return { amount: n * 1000, unit: 'ml' };
    if (u === 'cl') return { amount: n * 10, unit: 'ml' };
    return { amount: n, unit: 'ml' };
  };
  if (multi && multi[1] && multi[2] && multi[3]) { const c = conv(Number(multi[2]), multi[3]); return { amount: Math.round(c.amount * Number(multi[1])), unit: c.unit }; }
  if (one && one[1] && one[2]) { const c = conv(Number(one[1]), one[2]); return { amount: Math.round(c.amount), unit: c.unit }; }
  if (pcs && pcs[1]) return { amount: Number(pcs[1]), unit: 'pcs' };
  return undefined;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const euro = (n: number): string => '€' + round2(n).toFixed(2).replace('.', ',');
