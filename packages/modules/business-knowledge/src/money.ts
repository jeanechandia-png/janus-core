/** Formato es-ES en euros a partir de céntimos: 13500 -> «135,00 €»; 125050 -> «1.250,50 €». */
export function formatEuros(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${grouped},${rest} €`;
}

/**
 * Interpreta una cantidad dictada o escrita en español.
 * «135» «135,50» «1.250,50» «1250.50» «1.250» (= 1250). Devuelve céntimos o null si es ambigua/ilegible.
 */
export function parseAmountToCents(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;
  let normalized: string;
  const hasDot = text.includes('.');
  const hasComma = text.includes(',');
  if (hasDot && hasComma) {
    if (text.lastIndexOf(',') < text.lastIndexOf('.')) return null; // «1,250.50» (formato inglés): se pide aclaración
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    if ((text.match(/,/g) ?? []).length > 1) return null;
    normalized = text.replace(',', '.');
  } else if (hasDot) {
    const parts = text.split('.');
    const last = parts[parts.length - 1] ?? '';
    normalized = parts.length > 2 || last.length === 3 ? parts.join('') : text; // «1.250» miles; «135.5» decimal
  } else {
    normalized = text;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
