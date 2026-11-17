import { entryKey } from './catalog.js';
import { parseAmountToCents } from './money.js';
import type { Billing, IntentResolution, KnowledgeChange, KnowledgeState, UnresolvedIntent } from './types.js';

/**
 * Intérprete DETERMINISTA de frases dictadas en español. Solo reconoce formas claras; lo demás devuelve
 * `undefined` y el anfitrión puede recurrir a un planificador con modelo (cuya salida estructurada pasa
 * por la misma validación). Nada de lo que se interprete aquí se aplica sin lectura de confirmación y
 * aprobación del Founder.
 */

const FOLD: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };

/** Pliega acentos y mayúsculas CARÁCTER A CARÁCTER: conserva la longitud para extraer del texto original. */
export function fold(text: string): string {
  const composed = text.normalize('NFC');
  let out = '';
  for (const char of composed) {
    const lower = char.toLowerCase();
    out += FOLD[lower] ?? lower;
  }
  return out;
}

const AMOUNT = String.raw`(?<amount>\d[\d.,]*)\s*(?:euros?|eur|€)`;

function detectVatMode(folded: string): boolean | undefined {
  if (/(?:\+\s*iva|mas\s+iva|sin\s+iva|iva\s+(?:no\s+incluido|aparte|excluido)|antes\s+de\s+iva)/.test(folded)) return false;
  if (/(?:iva\s+incluido|con\s+iva|impuestos\s+incluidos)/.test(folded)) return true;
  return undefined;
}

function detectBilling(folded: string): Billing | undefined {
  if (/(?:al\s+mes|mensual(?:es)?|cada\s+mes|por\s+mes)/.test(folded)) return 'monthly';
  if (/(?:al\s+ano|anual(?:es)?|cada\s+ano|por\s+ano)/.test(folded)) return 'yearly';
  if (/(?:pago\s+unico|una\s+sola\s+vez)/.test(folded)) return 'one-off';
  if (/(?:por\s+unidad|cada\s+uno)/.test(folded)) return 'per-unit';
  return undefined;
}

type Indexed = RegExpExecArray & { indices?: RegExpIndicesArray & { groups?: Record<string, [number, number] | undefined> } };

function exec(pattern: RegExp, folded: string): Indexed | null {
  return pattern.exec(folded) as Indexed | null;
}

function slice(original: string, match: Indexed, group: string): string | undefined {
  const range = match.indices?.groups?.[group];
  return range ? original.slice(range[0], range[1]).trim() : undefined;
}

function cleanTail(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const cleaned = text.replace(/^[\s,.:;–—-]+|[\s,.:;–—-]+$/g, '').replace(/\s+/g, ' ');
  return cleaned || undefined;
}

function cleanName(text: string | undefined, maxWords = 6): string | undefined {
  const cleaned = cleanTail(text)?.replace(/^(?:el|la|los|las|un|una)\s+/i, '').replace(/^["«“']|["»”']$/g, '');
  if (!cleaned) return undefined;
  return cleaned.split(' ').length <= maxWords && cleaned.length <= 80 ? cleaned : undefined;
}

const PATTERNS = {
  instruction: /(?:guarda|registra|anota|memoriza|apunta|toma\s+nota\s+de|anade)\s+(?:esta\s+|la\s+siguiente\s+|una\s+)?(?:nueva\s+)?instruccion(?:\s+para\s+(?:melanie|janus|el\s+chat|los\s+asistentes|todos))?\s*[:,\-–]?\s*(?<text>.+)$/dis,
  fromNowOn: /(?:a\s+partir\s+de\s+ahora|desde\s+ahora)\s*,?\s*(?<text>.+)$/dis,
  faq: /\bsi\s+(?:alguien\s+|un\s+cliente\s+|los\s+clientes\s+)?(?:pregunta|preguntan|pide|piden)\s+(?:por\s+)?(?<q>.+?)\s*,?\s+(?:responde|contesta|dile|diles|di)\s+(?:que\s+)?(?<a>.+)$/dis,
  retire: /(?:quita|retira|elimina|borra|da\s+de\s+baja|descataloga|ya\s+no\s+vendemos)\s+(?:el\s+|la\s+)?(?:producto|modulo|servicio|plan|paquete)?\s*(?<name>.+)$/dis,
  teamNew: /(?:nuev[oa]\s+(?:integrante|miembro|companer[oa]|colaborador[a]?|fichaje)(?:\s+del\s+equipo)?)(?:\s+(?:se\s+llama|es))?\s*[:,]?\s*(?<name>[^,.;:]+?)(?:\s*[,.;:]?\s*(?:que\s+(?:es|sera|se\s+encarga\s+de)|como|quien\s+es|encargad[oa]\s+de|especialista\s+en|responsable\s+de)\s+(?<role>.+))?$/dis,
  teamJoined: /(?:se\s+(?:ha\s+)?(?:incorporado|unido|sumado)\s+(?:al\s+equipo\s+)?|incorporamos\s+a\s+|fichamos\s+a\s+|damos\s+la\s+bienvenida\s+a\s+)(?<name>[^,.;:]+?)(?:\s+al\s+equipo)?(?:\s*[,.;:]?\s*(?:como|de|que\s+es|encargad[oa]\s+de|responsable\s+de)\s+(?<role>.+))?$/dis,
  addProduct: new RegExp(
    String.raw`(?:anade|anadir|agrega|agregar|crea|crear|incluye|incluir|lanzamos|sumamos|tenemos|hemos\s+lanzado)\s+(?:un\s+|una\s+|el\s+|la\s+)?(?:nuevo\s+|nueva\s+)?(?:producto|modulo|servicio|plan|paquete)(?:\s+nuevo|\s+nueva)?\s*[:,]?\s*(?:llamad[oa]\s+|que\s+se\s+llama\s+|se\s+llama\s+)?(?<name>.+?)(?:\s*[,.;]?\s*(?:que\s+)?(?:cuesta|vale|a|por|con\s+precio\s+de|precio)\s+${AMOUNT}(?<rest>[^]*?))?(?:\s*[,.;]?\s*(?:descripcion|que\s+(?:sirve|incluye|permite))\s*:?\s*(?<desc>.+))?$`,
    'dis',
  ),
  setVat: /(?:cambia|cambiar|actualiza|actualizar|pon|ponle|fija|ajusta|sube|baja)\w*\s+(?:el\s+|los\s+)?(?:tipo\s+de\s+)?iva\b[^]{0,40}?(?:al|a|en|del)\s+(?<pct>\d{1,2}(?:[.,]\d{1,2})?)\s*(?:%|por\s*ciento)/dis,
  priceOf: new RegExp(
    String.raw`(?:precio|tarifa|coste|cuota)\s+(?:del?|de\s+la|de\s+los|de\s+las|para\s+(?:el|la))\s+(?<name>.+?)\s+(?:a|en|por|sea|es\s+de|es|sera\s+de|sera|pase\s+a|pasa\s+a|sube\s+a|baja\s+a|queda\s+en|ponlo\s+en)\s+${AMOUNT}(?<rest>[^]*)$`,
    'dis',
  ),
  costs: new RegExp(
    String.raw`(?<name>[^,.;:]+?)\s+(?:ahora\s+|pasa\s+a\s+)?(?:cuesta|vale|cuestan|valen|costara|costaran)\s+${AMOUNT}(?<rest>[^]*)$`,
    'dis',
  ),
} as const;

export function parseSpanishUtterance(utterance: string): UnresolvedIntent | undefined {
  const original = utterance.replace(/\s+/g, ' ').trim();
  if (!original || original.length > 600) return undefined;
  const folded = fold(original);

  let match = exec(PATTERNS.instruction, folded);
  if (match) {
    const text = cleanTail(slice(original, match, 'text'));
    return text && text.length >= 8 ? { type: 'add-instruction', text } : undefined;
  }

  match = exec(PATTERNS.faq, folded);
  if (match) {
    const question = cleanTail(slice(original, match, 'q'));
    const answer = cleanTail(slice(original, match, 'a'));
    return question && answer ? { type: 'add-faq', question, answer } : undefined;
  }

  match = exec(PATTERNS.retire, folded);
  if (match) {
    const name = cleanTail(slice(original, match, 'name'));
    return name ? { type: 'retire-product', productQuery: name } : undefined;
  }

  match = exec(PATTERNS.teamNew, folded) ?? exec(PATTERNS.teamJoined, folded);
  if (match) {
    const name = cleanName(slice(original, match, 'name'), 4);
    const role = cleanTail(slice(original, match, 'role'));
    return name ? { type: 'add-team-member', name, ...(role ? { role } : {}) } : undefined;
  }

  match = exec(PATTERNS.addProduct, folded);
  if (match) {
    const name = cleanName(slice(original, match, 'name'));
    if (!name) return undefined;
    const amountText = slice(original, match, 'amount');
    const priceCents = amountText ? parseAmountToCents(amountText) : undefined;
    if (amountText && priceCents === null) return undefined;
    const rest = match.groups?.rest ?? '';
    const vat = detectVatMode(fold(rest) + ' ' + folded);
    const description = cleanTail(slice(original, match, 'desc'));
    const billing = detectBilling(folded);
    return {
      type: 'add-product',
      title: name,
      ...(priceCents !== undefined && priceCents !== null ? { priceCents } : {}),
      ...(vat !== undefined ? { priceIncludesVat: vat } : {}),
      ...(billing ? { billing } : {}),
      ...(description ? { description } : {}),
    };
  }

  match = exec(PATTERNS.setVat, folded);
  if (match) {
    const pct = Number((match.groups?.pct ?? '').replace(',', '.'));
    return Number.isFinite(pct) ? { type: 'set-vat', percent: pct } : undefined;
  }

  match = exec(PATTERNS.priceOf, folded) ?? exec(PATTERNS.costs, folded);
  if (match) {
    const amountText = slice(original, match, 'amount');
    const priceCents = amountText ? parseAmountToCents(amountText) : null;
    const name = cleanTail(slice(original, match, 'name'));
    if (priceCents === null || !name) return undefined;
    const vat = detectVatMode(match.groups?.rest ? fold(match.groups.rest) : folded);
    return { type: 'set-price', productQuery: name, priceCents, ...(vat !== undefined ? { priceIncludesVat: vat } : {}) };
  }

  // «A partir de ahora …» es una instrucción SOLO si no era un cambio de precio, IVA, producto, equipo o FAQ.
  match = exec(PATTERNS.fromNowOn, folded);
  if (match) {
    const text = cleanTail(slice(original, match, 'text'));
    return text && text.length >= 8 ? { type: 'add-instruction', text } : undefined;
  }

  return undefined;
}

/** Palabras que no identifican un producto. */
const STOPWORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'en', 'y', 'o', 'que', 'se', 'ahora', 'nuestro', 'nuestra', 'mi', 'tu', 'su', 'para', 'por', 'con', 'sin', 'es', 'son', 'mas', 'menos', 'quiero', 'necesito', 'puedes', 'favor', 'janus', 'melanie', 'oye', 'por']);
const GENERIC = new Set(['producto', 'modulo', 'servicio', 'plan', 'paquete', 'precio', 'tarifa', 'cuota', 'coste']);

function tokens(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((token) => (token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token));
}

function significant(text: string): string[] {
  return tokens(text).filter((token) => !STOPWORDS.has(token) && !GENERIC.has(token));
}

export function resolveProductQuery(
  state: KnowledgeState,
  query: string,
): { ok: true; key: string; title: string } | Extract<IntentResolution, { ok: false }> {
  const queryTokens = new Set(tokens(query));
  const products = Object.values(state.entries).filter((entry) => entry.kind === 'product' && entry.active);

  const contained = products
    .map((entry) => ({ entry, sig: significant(entry.title) }))
    .filter(({ sig }) => sig.length > 0 && sig.every((token) => queryTokens.has(token)));

  if (contained.length > 0) {
    const best = Math.max(...contained.map(({ sig }) => sig.length));
    const top = contained.filter(({ sig }) => sig.length === best);
    if (top.length === 1) return { ok: true, key: top[0]!.entry.key, title: top[0]!.entry.title };
    return {
      ok: false,
      reason: 'ambiguous',
      message: `«${query}» puede referirse a varios productos: ${top.map(({ entry }) => `«${entry.title}»`).join(', ')}. ¿A cuál te refieres?`,
      candidates: top.map(({ entry }) => ({ key: entry.key, title: entry.title })),
    };
  }

  const near = products
    .map((entry) => ({ entry, overlap: significant(entry.title).filter((token) => queryTokens.has(token)).length }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 3);
  return {
    ok: false,
    reason: 'not_found',
    message: near.length
      ? `No encuentro un producto llamado «${query}». ¿Quizá ${near.map(({ entry }) => `«${entry.title}»`).join(' o ')}?`
      : `No encuentro ningún producto activo que coincida con «${query}».`,
    ...(near.length ? { candidates: near.map(({ entry }) => ({ key: entry.key, title: entry.title })) } : {}),
  };
}

/** Convierte la intención dictada en cambios concretos usando el estado actual (resuelve el producto por nombre). */
export function resolveIntent(state: KnowledgeState, intent: UnresolvedIntent): IntentResolution {
  switch (intent.type) {
    case 'set-vat':
      return { ok: true, changes: [{ op: 'set-default-vat', percent: intent.percent }] };
    case 'set-price': {
      const found = resolveProductQuery(state, intent.productQuery);
      if (!found.ok) return found;
      const change: KnowledgeChange = {
        op: 'set-price',
        key: found.key,
        priceCents: intent.priceCents,
        ...(intent.priceIncludesVat !== undefined ? { priceIncludesVat: intent.priceIncludesVat } : {}),
      };
      return { ok: true, changes: [change] };
    }
    case 'add-product':
      return {
        ok: true,
        changes: [{
          op: 'upsert',
          entry: {
            kind: 'product',
            title: intent.title,
            ...(intent.description ? { body: intent.description } : {}),
            ...(intent.priceCents !== undefined ? { priceCents: intent.priceCents } : {}),
            ...(intent.priceIncludesVat !== undefined ? { priceIncludesVat: intent.priceIncludesVat } : {}),
            ...(intent.billing ? { billing: intent.billing } : {}),
          },
        }],
      };
    case 'add-team-member':
      return { ok: true, changes: [{ op: 'upsert', entry: { kind: 'team-member', title: intent.name, ...(intent.role ? { role: intent.role } : {}) } }] };
    case 'add-instruction': {
      const title = intent.text.split(' ').slice(0, 6).join(' ');
      return { ok: true, changes: [{ op: 'upsert', entry: { kind: 'instruction', title, body: intent.text } }] };
    }
    case 'add-faq':
      return { ok: true, changes: [{ op: 'upsert', entry: { kind: 'faq', title: intent.question, body: intent.answer } }] };
    case 'retire-product': {
      const found = resolveProductQuery(state, intent.productQuery);
      return found.ok ? { ok: true, changes: [{ op: 'retire', key: found.key }] } : found;
    }
    default:
      return { ok: false, reason: 'invalid', message: 'No entendí qué quieres cambiar.' };
  }
}

export { entryKey };
