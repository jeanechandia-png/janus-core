import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Mensajes internos del colaborador (nada sale del ecosistema).
 *
 * Regla del CEO (10-nov-2026): un colaborador no envía archivos ni correos hacia fuera. Si necesita comunicar
 * algo, se lo pide a JANUS; JANUS evalúa con reglas fijas y solo llega al CEO lo que pasa el filtro:
 *  - destinatario fuera de la lista interna  → se rechaza solo, sin molestar al CEO;
 *  - destinatario interno                    → se entrega en la bandeja interna (no es un correo).
 * El envío real por correo a direcciones de empresa queda «pendiente de activación» (requiere credenciales).
 * Módulo puro salvo el cifrado, que usa solo node:crypto.
 */
export interface InternalRecipient { id: string; label: string }

export const DEFAULT_INTERNAL_RECIPIENTS: readonly InternalRecipient[] = [{ id: 'ceo', label: 'CEO' }];

/** JANUS_INTERNAL_RECIPIENTS="ceo:CEO,empresa:Empresa". Solo etiquetas: las direcciones no viven en JANUS. */
export function parseInternalRecipients(raw: string | undefined): InternalRecipient[] {
  const parsed = (raw ?? '').split(',').map((entry) => {
    const [id, ...rest] = entry.split(':');
    const cleanId = (id ?? '').trim().toLowerCase();
    const label = rest.join(':').trim();
    return /^[a-z0-9_-]{1,32}$/.test(cleanId) && label && label.length <= 60 ? { id: cleanId, label } : null;
  }).filter((entry): entry is InternalRecipient => entry !== null);
  const unique = [...new Map(parsed.map((entry) => [entry.id, entry])).values()];
  return unique.length ? unique : DEFAULT_INTERNAL_RECIPIENTS.map((entry) => ({ ...entry }));
}

export type WorkMessageStatus = 'delivered' | 'rejected';

export interface WorkMessage {
  id: string;
  fromPrincipalId: string;
  recipientId: string;
  projectId?: string;
  subject: string;
  body: string;
  status: WorkMessageStatus;
  /** Motivo legible de la decisión automática de JANUS. */
  decision: 'internal_recipient' | 'recipient_outside_company';
  createdAt: string;
  readAt?: string;
  /** Solo en mensajes del CEO hacia un colaborador: quién lo recibe. Sin este campo, el mensaje va hacia el CEO. */
  toPrincipalId?: string;
  /** Mensaje al que responde (mismo hilo). */
  replyToId?: string;
  /** Archivos del proyecto que acompañan al mensaje (se abren dentro del panel, con los permisos del proyecto). */
  attachments?: Array<{ resourceId: string; name: string }>;
}

export const WORK_MESSAGE_ATTACHMENTS_MAX = 8;

/** Mensaje del CEO a un colaborador. Nunca sale del ecosistema: se entrega en el panel de esa persona. */
export function composeFounderMessage(input: {
  id: string;
  fromPrincipalId: string;
  toPrincipalId: string;
  subject: string;
  body: string;
  projectId?: string;
  replyToId?: string;
  attachments?: ReadonlyArray<{ resourceId: string; name: string }>;
  now: string;
}): WorkMessage {
  const subject = input.subject.trim();
  const body = input.body.trim();
  const attachments = (input.attachments ?? []).map((entry) => ({ resourceId: String(entry.resourceId).trim(), name: String(entry.name).trim().slice(0, 200) })).filter((entry) => entry.resourceId && entry.name);
  if (!subject) throw new Error('message subject is required');
  if (subject.length > WORK_MESSAGE_SUBJECT_MAX) throw new Error('message subject is too long');
  if (!body && attachments.length === 0) throw new Error('message body is required');
  if (body.length > WORK_MESSAGE_BODY_MAX) throw new Error('message body is too long');
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(input.toPrincipalId)) throw new Error('message recipient is required');
  if (attachments.length > WORK_MESSAGE_ATTACHMENTS_MAX) throw new Error('too many attachments');
  if (attachments.length && !input.projectId) throw new Error('attachments need a project');
  return {
    id: input.id,
    fromPrincipalId: input.fromPrincipalId,
    recipientId: input.toPrincipalId,
    toPrincipalId: input.toPrincipalId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.replyToId ? { replyToId: input.replyToId } : {}),
    ...(attachments.length ? { attachments } : {}),
    subject,
    body: body || '(archivo adjunto)',
    status: 'delivered',
    decision: 'internal_recipient',
    createdAt: new Date(input.now).toISOString(),
  };
}

/** ¿Este mensaje espera lectura del CEO? (los que el CEO envía no cuentan como «nuevos» para él). */
export const isMessageForFounder = (message: WorkMessage): boolean => !message.toPrincipalId;

export const WORK_MESSAGE_SUBJECT_MAX = 160;
export const WORK_MESSAGE_BODY_MAX = 4000;

/** Decide sin intervención humana. Cualquier cosa que parezca una dirección externa se rechaza. */
export function evaluateWorkMessage(input: {
  id: string;
  fromPrincipalId: string;
  recipient: string;
  subject: string;
  body: string;
  projectId?: string;
  allowed: readonly InternalRecipient[];
  now: string;
}): WorkMessage {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error('message subject is required');
  if (subject.length > WORK_MESSAGE_SUBJECT_MAX) throw new Error('message subject is too long');
  if (!body) throw new Error('message body is required');
  if (body.length > WORK_MESSAGE_BODY_MAX) throw new Error('message body is too long');
  const wanted = input.recipient.trim().toLowerCase();
  if (!wanted || wanted.length > 200) throw new Error('message recipient is required');
  const match = input.allowed.find((entry) => entry.id === wanted);
  return {
    id: input.id,
    fromPrincipalId: input.fromPrincipalId,
    // Nunca se guarda una dirección externa tal cual: solo el hecho de que se intentó.
    recipientId: match ? match.id : 'external',
    ...(input.projectId ? { projectId: input.projectId } : {}),
    subject,
    body,
    status: match ? 'delivered' : 'rejected',
    decision: match ? 'internal_recipient' : 'recipient_outside_company',
    createdAt: new Date(input.now).toISOString(),
  };
}

/* ── Cifrado en reposo de textos privados (agenda personal) ────────────────────────────────────────────── */
const SEAL_PREFIX = 'enc:v1:';

/** Deriva una clave propia a partir de la clave del almacén de credenciales (nunca se usa esa clave directamente). */
export function derivePrivateTextKey(vaultKeyBase64: string | undefined): Buffer | null {
  if (!vaultKeyBase64?.trim()) return null;
  const master = Buffer.from(vaultKeyBase64.trim(), 'base64');
  if (master.length < 32) return null;
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'janus-work-private-text-v1', 32));
}

export function sealPrivateText(text: string, key: Buffer | null): string {
  if (!key || !text || text.startsWith(SEAL_PREFIX)) return text;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const sealed = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return SEAL_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64url');
}

/** Si no se puede abrir (clave cambiada o dato manipulado) devuelve cadena vacía: nunca texto corrupto. */
export function openPrivateText(value: string, key: Buffer | null): string {
  if (!value.startsWith(SEAL_PREFIX)) return value;
  if (!key) return '';
  try {
    const raw = Buffer.from(value.slice(SEAL_PREFIX.length), 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export const isSealedText = (value: string): boolean => value.startsWith(SEAL_PREFIX);
