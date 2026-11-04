import type { EntryInput, KnowledgeChange, KnowledgeKind, ValidationResult } from './types.js';

export const LIMITS = Object.freeze({
  title: 120,
  body: 1200,
  instruction: 600,
  role: 120,
  maxEntries: 800,
  maxPriceCents: 100_000_000, // 1.000.000 €
});

const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Patrones de secretos: nunca se guardan en el conocimiento del negocio (Protocolo: secretos fuera de SQLite y código). */
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bxi-api-key\b/i,
  /\b(?:ghp|gho|ghs|github_pat)_[A-Za-z0-9_]{16,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Fa-f0-9]{40,}\b/,
  /\b(?:api[_ -]?key|contraseña|password|clave secreta|token secreto)\b/i,
];

/** Intentos de reescribir las reglas del asistente a través de «datos del negocio». */
const OVERRIDE_PATTERNS: RegExp[] = [
  /ignor(?:a|e|ar|en)\s+(?:todas?\s+)?(?:las\s+|tus\s+|esas\s+)?(?:instrucciones|reglas|normas|restricciones)/i,
  /ignore\s+(?:all|any|previous|prior|the)\b/i,
  /(?:prompt|mensaje)\s+del\s+sistema|system\s+prompt/i,
  /(?:revela|muestra|enseña|dime)\s+(?:tus\s+|el\s+)?(?:instrucciones|prompt|configuraci[oó]n)/i,
  /desactiva\s+(?:las\s+)?(?:reglas|normas|seguridad|filtros)/i,
  /act[uú]a\s+como\s+(?:administrador|root|el\s+fundador)/i,
  /(?:eres|ahora eres)\s+(?:el\s+)?(?:fundador|propietario|administrador)/i,
];

export function checkText(
  raw: string | undefined,
  field: 'title' | 'body' | 'instruction' | 'role',
  required = false,
): ValidationResult<string | undefined> {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return required
      ? { ok: false, code: field === 'title' ? 'invalid_title' : 'invalid_text', message: `Falta el campo «${field}».` }
      : { ok: true, value: undefined };
  }
  const max = field === 'title' ? LIMITS.title : field === 'role' ? LIMITS.role : field === 'instruction' ? LIMITS.instruction : LIMITS.body;
  if (text.length > max) {
    return { ok: false, code: field === 'title' ? 'invalid_title' : 'invalid_text', message: `El campo «${field}» supera ${max} caracteres.` };
  }
  if (CONTROL_CHARS.test(text)) {
    return { ok: false, code: 'invalid_text', message: `El campo «${field}» contiene caracteres no válidos.` };
  }
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    return { ok: false, code: 'risky_text', message: `El campo «${field}» parece contener un secreto o credencial; no se guarda.` };
  }
  if (OVERRIDE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { ok: false, code: 'risky_text', message: `El campo «${field}» intenta cambiar las reglas del asistente; los datos del negocio no pueden hacerlo.` };
  }
  return { ok: true, value: text };
}

export function validateEntryInput(input: EntryInput): ValidationResult<EntryInput> {
  const kinds: KnowledgeKind[] = ['product', 'team-member', 'faq', 'instruction', 'policy'];
  if (!kinds.includes(input.kind)) return { ok: false, code: 'invalid_text', message: 'Tipo de entrada desconocido.' };

  const title = checkText(input.title, 'title', true);
  if (!title.ok) return title;
  const body = checkText(input.body, input.kind === 'instruction' ? 'instruction' : 'body');
  if (!body.ok) return body;
  const role = checkText(input.role, 'role');
  if (!role.ok) return role;

  if (input.kind === 'faq' && !body.value) return { ok: false, code: 'invalid_text', message: 'Una pregunta frecuente necesita su respuesta.' };
  if ((input.kind === 'instruction' || input.kind === 'policy') && !body.value) {
    return { ok: false, code: 'invalid_text', message: 'Falta el texto de la instrucción.' };
  }

  if (input.priceCents !== undefined) {
    if (input.kind !== 'product') return { ok: false, code: 'not_a_product', message: 'Solo los productos llevan precio.' };
    const price = validatePriceCents(input.priceCents);
    if (!price.ok) return price;
  }

  return {
    ok: true,
    value: {
      kind: input.kind,
      title: title.value!,
      ...(body.value ? { body: body.value } : {}),
      ...(role.value ? { role: role.value } : {}),
      ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
      ...(input.priceIncludesVat !== undefined ? { priceIncludesVat: input.priceIncludesVat } : {}),
      ...(input.billing ? { billing: input.billing } : {}),
      ...(input.visibility ? { visibility: input.visibility } : {}),
    },
  };
}

export function validatePriceCents(priceCents: number): ValidationResult<number> {
  if (!Number.isInteger(priceCents) || priceCents < 0 || priceCents > LIMITS.maxPriceCents) {
    return { ok: false, code: 'invalid_price', message: 'El precio debe estar entre 0 € y 1.000.000 €.' };
  }
  return { ok: true, value: priceCents };
}

export function validateVatPercent(percent: number): ValidationResult<number> {
  if (!Number.isFinite(percent) || percent < 0 || percent > 50) {
    return { ok: false, code: 'invalid_vat', message: 'El IVA debe estar entre 0 % y 50 %.' };
  }
  return { ok: true, value: Math.round(percent * 100) / 100 };
}

export function validateChange(change: KnowledgeChange): ValidationResult<KnowledgeChange> {
  switch (change.op) {
    case 'upsert': {
      const entry = validateEntryInput(change.entry);
      return entry.ok ? { ok: true, value: { op: 'upsert', entry: entry.value } } : entry;
    }
    case 'set-price': {
      const price = validatePriceCents(change.priceCents);
      if (!price.ok) return price;
      if (!change.key.startsWith('product:')) return { ok: false, code: 'not_a_product', message: 'Solo los productos llevan precio.' };
      return { ok: true, value: change };
    }
    case 'retire':
      return change.key.trim() ? { ok: true, value: change } : { ok: false, code: 'unknown_key', message: 'Falta la entrada a retirar.' };
    case 'set-default-vat': {
      const vat = validateVatPercent(change.percent);
      return vat.ok ? { ok: true, value: { op: 'set-default-vat', percent: vat.value } } : vat;
    }
    default:
      return { ok: false, code: 'empty_change_set', message: 'Operación desconocida.' };
  }
}
