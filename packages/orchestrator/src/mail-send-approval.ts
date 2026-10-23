/**
 * Tarjeta de aprobación del envío de un correo: lo que la persona debe ver ANTES de aprobar.
 *
 * Se alimenta de la salida de `gmail.draft.preview` (solo lectura). La huella `bodySha256` que viaja a `gmail.draft.send` se calculó sobre
 * ese mismo texto con la misma función, así que lo que se aprueba es exactamente lo que el envío comparará. Aquí no hay red ni efectos:
 * solo se valida la forma de la vista previa y se redactan los avisos (copia oculta, muchos destinatarios, texto recortado…).
 * El texto de la tarjeta es TEXTO PLANO: quien lo pinte debe escaparlo (lo hacen los paneles de Janus).
 */
export interface MailDraftPreview {
  draftId: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  text: string;
  textTruncated: boolean;
  bodySha256: string;
}

export interface MailSendApprovalCard {
  headline: string;
  recipients: { to: string[]; cc: string[]; bcc: string[] };
  subject: string;
  body: string;
  /** Primeros 12 caracteres de la huella, para reconocer de qué texto se trata sin leer 64. */
  digestShort: string;
  warnings: string[];
  footer: string;
}

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Valida estrictamente la salida de `gmail.draft.preview`; cualquier forma inesperada devuelve `null` (no se muestra nada que no se pueda verificar). */
export function parseMailDraftPreview(output: unknown): MailDraftPreview | null {
  if (typeof output !== 'object' || output === null) return null;
  const o = output as Record<string, unknown>;
  if (typeof o.draftId !== 'string' || !isStringArray(o.to) || !isStringArray(o.cc) || !isStringArray(o.bcc)) return null;
  if (typeof o.subject !== 'string' || typeof o.text !== 'string' || typeof o.textTruncated !== 'boolean') return null;
  if (typeof o.bodySha256 !== 'string' || !/^[0-9a-f]{64}$/.test(o.bodySha256)) return null;
  if (o.to.length === 0) return null;
  return { draftId: o.draftId, to: o.to, cc: o.cc, bcc: o.bcc, subject: o.subject, text: o.text, textTruncated: o.textTruncated, bodySha256: o.bodySha256 };
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function buildMailSendApprovalCard(preview: MailDraftPreview): MailSendApprovalCard {
  const total = preview.to.length + preview.cc.length + preview.bcc.length;
  const warnings: string[] = [];
  if (preview.bcc.length > 0) warnings.push(`Hay ${plural(preview.bcc.length, 'destinatario', 'destinatarios')} en copia oculta (Cco): ${preview.bcc.join(', ')}. Los demás no lo verán.`);
  if (total > 10) warnings.push(`Se enviará a ${total} destinatarios.`);
  if (preview.textTruncated) warnings.push(`El texto es muy largo y aquí se muestra recortado. Lo que apruebas es el texto COMPLETO (huella ${preview.bodySha256.slice(0, 12)}); revísalo entero en Gmail antes de aprobar.`);
  if (preview.text.trim() === '') warnings.push('El texto del correo está vacío.');
  if (preview.to.some((address) => preview.cc.includes(address) || preview.bcc.includes(address))) warnings.push('Alguna dirección aparece en más de un campo (Para/Cc/Cco).');
  return {
    headline: `Enviar «${preview.subject}» a ${plural(total, 'destinatario', 'destinatarios')}`,
    recipients: { to: preview.to, cc: preview.cc, bcc: preview.bcc },
    subject: preview.subject,
    body: preview.text,
    digestShort: preview.bodySha256.slice(0, 12),
    warnings,
    footer: 'Solo se envía lo que ves aquí. Si el borrador cambia después de aprobar (texto, asunto o destinatarios), el envío se rechaza y tendrás que aprobar de nuevo. Enviar es irreversible.',
  };
}
