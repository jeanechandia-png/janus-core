import { formatEuros } from './money.js';
import type { KnowledgeChange, KnowledgeProposal, KnowledgeState } from './types.js';

export interface Readback {
  lines: string[];
  warnings: string[];
  /** Una sola frase para leer en voz alta antes de pedir la aprobación. */
  spoken: string;
}

const BILLING_ES: Record<string, string> = {
  'one-off': 'pago único',
  monthly: 'al mes',
  yearly: 'al año',
  'per-unit': 'por unidad',
};

function vatNote(includes: boolean | undefined): string {
  return includes ? 'IVA incluido' : 'IVA no incluido';
}

/** Describe EXACTAMENTE qué cambiará (antes → después), para que el Founder apruebe lo que realmente se aplicará. */
export function buildReadback(state: KnowledgeState, changes: readonly KnowledgeChange[]): Readback {
  const lines: string[] = [];
  const warnings: string[] = [];

  for (const change of changes) {
    if (change.op === 'set-default-vat') {
      lines.push(`Cambiar el IVA por defecto de ${state.defaultVatPercent === null ? 'sin definir' : `${fmtPercent(state.defaultVatPercent)} %`} a ${fmtPercent(change.percent)} %.`);
      continue;
    }
    if (change.op === 'set-price') {
      const target = state.entries[change.key];
      const name = target ? `«${target.title}»` : `«${change.key}»`;
      const before = target?.priceCents !== undefined ? formatEuros(target.priceCents) : 'sin precio';
      lines.push(`Cambiar el precio de ${name} de ${before} a ${formatEuros(change.priceCents)} (${vatNote(change.priceIncludesVat ?? target?.priceIncludesVat)}).`);
      if (target?.priceCents && target.priceCents > 0) {
        const delta = ((change.priceCents - target.priceCents) / target.priceCents) * 100;
        if (Math.abs(delta) >= 50) {
          warnings.push(`El precio de «${target.title}» cambia un ${delta > 0 ? '+' : ''}${Math.round(delta)} %: confirma que no es un error de dictado.`);
        }
      }
      continue;
    }
    if (change.op === 'retire') {
      const target = state.entries[change.key];
      lines.push(`Retirar «${target?.title ?? change.key}» del conocimiento activo (queda en el historial; deja de usarse con los clientes).`);
      continue;
    }
    // upsert
    const entry = change.entry;
    const existing = Object.values(state.entries).find((item) => item.kind === entry.kind && item.title.toLowerCase() === entry.title.toLowerCase());
    const verb = existing ? 'Actualizar' : 'Añadir';
    switch (entry.kind) {
      case 'product': {
        const price = entry.priceCents !== undefined
          ? ` a ${formatEuros(entry.priceCents)}${entry.billing ? ' ' + BILLING_ES[entry.billing] : ''} (${vatNote(entry.priceIncludesVat)})`
          : ' sin precio todavía';
        lines.push(`${verb} el producto «${entry.title}»${price}${entry.body ? `: ${entry.body}` : ''}.`);
        if (entry.priceCents === undefined && !existing) warnings.push(`«${entry.title}» queda sin precio: los clientes no recibirán una cifra hasta que lo indiques.`);
        break;
      }
      case 'team-member':
        lines.push(`${verb} a ${entry.title} en el equipo${entry.role ? ` como ${entry.role}` : ''}${entry.visibility === 'internal' ? ' (solo uso interno)' : ' (será visible para los clientes)'}.`);
        break;
      case 'faq':
        lines.push(`${verb} la pregunta frecuente «${entry.title}» con la respuesta: ${entry.body}.`);
        break;
      case 'instruction':
        lines.push(`${verb} la instrucción «${entry.title}»: ${entry.body}.`);
        break;
      case 'policy':
        lines.push(`${verb} la política «${entry.title}»: ${entry.body}.`);
        break;
    }
    if (entry.kind === 'team-member' && entry.visibility !== 'internal') {
      warnings.push('Los datos de una persona del equipo se publicarán a los asistentes de cara al público; confirma que tiene su permiso.');
    }
  }

  const spoken = lines.length === 1 ? lines[0]! : `Son ${lines.length} cambios. ${lines.join(' ')}`;
  return { lines, warnings, spoken: warnings.length ? `${spoken} Atención: ${warnings.join(' ')}` : spoken };
}

export function describeProposal(state: KnowledgeState, proposal: KnowledgeProposal): Readback {
  return buildReadback(state, proposal.changes);
}

function fmtPercent(value: number): string {
  return String(value).replace('.', ',');
}
