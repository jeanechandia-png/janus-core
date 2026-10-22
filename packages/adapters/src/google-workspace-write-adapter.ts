import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { createHash } from 'node:crypto';
import { isRecord, requestJson } from './http-json.js';

/**
 * Google Workspace WRITE adapter — separate from the read-only adapter so the
 * write token (minimal scopes `gmail.compose`, `calendar.events`) is only used
 * here. Verified 2026-10-14 (developers.google.com/workspace):
 * POST https://gmail.googleapis.com/gmail/v1/users/me/drafts  (Draft { message: { raw } }) — creates a DRAFT, never sends;
 * PUT  https://gmail.googleapis.com/gmail/v1/users/me/drafts/{id}  (Draft) — corrects a draft; verified 2026-10-23;
 * POST https://gmail.googleapis.com/gmail/v1/users/me/drafts/send  (Draft { id }) — sends an existing draft; verified 2026-10-23
 *   (all three accept the scope gmail.compose);
 * POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?sendUpdates=none|all — start/end with dateTime+timeZone.
 * Every action is forced to explicit approval by the sensitive-action policy.
 *
 * Sending is a separate, irreversible step: `gmail.draft.send` re-reads the draft and refuses to send unless its recipients
 * (To, Cc and Bcc — a hidden Bcc is never approved implicitly) and subject are exactly what the Founder approved (`input.expect`),
 * and its plain-text body (`expect.bodySha256`, mandatory — see `draftBodyDigest`). If the draft cannot be read or
 * verified, nothing is sent. Residual risk: compare-then-send is not atomic (Gmail has no conditional send); the window is milliseconds.
 */
export interface GoogleWorkspaceWriteAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
  /** Multi-cuenta (ver el adaptador de lectura): `input.account` debe estar en `allowedAccounts`. */
  accountTokenProvider?: (accountId: string) => Promise<string | undefined>;
  allowedAccounts?: ReadonlySet<string>;
  fetchImpl?: typeof fetch;
}

const EMAIL = /^[^\s@<>,;"]{1,64}@[^\s@<>,;"]{1,190}\.[A-Za-z]{2,24}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
const TIME_ZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;
const CALENDAR = /^[A-Za-z0-9._@-]{1,200}$/;

function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function encodeHeaderWord(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

export function buildRfc2822(input: { to: string[]; cc?: string[]; subject: string; body: string }): string {
  const lines = [
    `To: ${input.to.join(', ')}`,
    ...(input.cc?.length ? [`Cc: ${input.cc.join(', ')}`] : []),
    `Subject: ${encodeHeaderWord(headerSafe(input.subject))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.body,
  ];
  return lines.join('\r\n');
}

export class GoogleWorkspaceWriteAdapter implements ToolAdapter {
  readonly name = 'google-workspace-write';
  readonly capabilities: string[] = ['gmail.draft.create', 'gmail.draft.update', 'gmail.draft.send', 'calendar.event.create'];
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GoogleWorkspaceWriteAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Google Workspace write action: ${request.action}` };
    let token: string | undefined;
    if (request.input.account !== undefined) {
      const id = typeof request.input.account === 'string' ? request.input.account : '';
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id) || !this.options.allowedAccounts?.has(id) || !this.options.accountTokenProvider) {
        return { ok: false, error: 'Google Workspace account is not registered for writing by the Founder (a minor\'s account needs the guardian-managed mark).' };
      }
      token = (await this.options.accountTokenProvider(id))?.trim();
      if (!token) return { ok: false, error: `Google Workspace account "${id}" is not authenticated for writing; authorise it with gmail.compose / calendar.events scopes.` };
    } else {
      token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    }
    if (!token) return { ok: false, error: 'Google Workspace write access is not authenticated; provide a token with gmail.compose / calendar.events scopes.' };
    const headers = { authorization: `Bearer ${token}` };
    const input = request.input;

    if (request.action === 'gmail.draft.send') return this.sendDraft(input, headers, onProgress);

    if (request.action === 'gmail.draft.create' || request.action === 'gmail.draft.update') {
      const updating = request.action === 'gmail.draft.update';
      const draftId = updating ? cleanId(input.draftId, DRAFT_ID) : null;
      if (updating && !draftId) return { ok: false, error: 'gmail.draft.update needs the draftId returned when the draft was created' };
      const composed = composeMessage(input, request.action);
      if ('error' in composed) return { ok: false, error: composed.error };
      await onProgress({ phase: 'progress', message: updating ? 'Gmail: corrigiendo BORRADOR (no se envía)' : 'Gmail: creando BORRADOR (no se envía)', percent: 50 });
      const result = await requestJson({
        fetchImpl: this.fetchImpl,
        url: updating ? `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId!)}` : 'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
        method: updating ? 'PUT' : 'POST',
        headers,
        body: updating ? { id: draftId, message: { raw: composed.raw } } : { message: { raw: composed.raw } },
        service: 'Gmail',
      });
      if (!result.ok) return { ok: false, error: result.error };
      const draft = isRecord(result.body) ? result.body : {};
      return {
        ok: true,
        output: { draftId: draft.id ?? draftId ?? null, sent: false, note: updating ? 'Borrador corregido en Gmail; Janus no lo envía.' : 'Borrador creado en Gmail; Janus no lo envía.' },
        ...(typeof draft.id === 'string' ? { externalReference: `gmail:draft:${draft.id}` } : {}),
      };
    }

    const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
    const start = typeof input.start === 'string' ? input.start.trim() : '';
    const end = typeof input.end === 'string' ? input.end.trim() : '';
    const timeZone = typeof input.timeZone === 'string' && TIME_ZONE.test(input.timeZone) ? input.timeZone : 'Europe/Amsterdam';
    const calendarId = typeof input.calendarId === 'string' && CALENDAR.test(input.calendarId) ? input.calendarId : 'primary';
    if (!summary || !DATE_TIME.test(start) || !DATE_TIME.test(end)) return { ok: false, error: 'calendar.event.create needs summary, start and end (ISO date-time)' };
    if (Date.parse(end) <= Date.parse(start)) return { ok: false, error: 'calendar.event.create: end must be after start' };
    const attendees = (Array.isArray(input.attendees) ? input.attendees : []).map((item) => String(item).trim()).filter((address) => EMAIL.test(address)).slice(0, 50);
    const sendUpdates = input.notifyGuests === true && attendees.length > 0 ? 'all' : 'none';
    await onProgress({ phase: 'progress', message: 'Calendar: creando evento', percent: 50 });
    const result = await requestJson({
      fetchImpl: this.fetchImpl,
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}`,
      method: 'POST',
      headers,
      body: {
        summary,
        ...(typeof input.description === 'string' ? { description: input.description.slice(0, 8000) } : {}),
        ...(typeof input.location === 'string' ? { location: input.location.slice(0, 500) } : {}),
        start: { dateTime: start, timeZone },
        end: { dateTime: end, timeZone },
        ...(attendees.length ? { attendees: attendees.map((email) => ({ email })) } : {}),
      },
      service: 'Google Calendar',
    });
    if (!result.ok) return { ok: false, error: result.error };
    const event = isRecord(result.body) ? result.body : {};
    return { ok: true, output: { eventId: event.id ?? null, link: event.htmlLink ?? null, guestsNotified: sendUpdates === 'all' }, ...(typeof event.htmlLink === 'string' ? { externalReference: event.htmlLink } : {}) };
  }

  /** Reads the draft, checks it against what the Founder approved, and only then sends it. Fails closed. */
  private async sendDraft(
    input: Record<string, unknown>,
    headers: Record<string, string>,
    onProgress: (progress: ToolProgress) => void | Promise<void>,
  ): Promise<ToolResult> {
    const draftId = cleanId(input.draftId, DRAFT_ID);
    if (!draftId) return { ok: false, error: 'gmail.draft.send needs the draftId of an existing draft' };
    const expect = isRecord(input.expect) ? input.expect : null;
    const expectedTo = addressSet(expect?.to);
    const expectedCc = addressSet(expect?.cc);
    const expectedBcc = addressSet(expect?.bcc);
    const expectedBody = typeof expect?.bodySha256 === 'string' ? expect.bodySha256.trim().toLowerCase() : null;
    const expectedSubject = typeof expect?.subject === 'string' ? normaliseSubject(expect.subject) : '';
    if (!expect || expectedTo.size === 0 || !expectedSubject) {
      return { ok: false, error: 'gmail.draft.send needs expect.to and expect.subject: the recipients and subject the Founder approved' };
    }
    if (!expectedBody || !/^[0-9a-f]{64}$/.test(expectedBody)) {
      return { ok: false, error: 'gmail.draft.send needs expect.bodySha256: the SHA-256 of the text the Founder approved (see draftBodyDigest). Nothing was sent.' };
    }

    await onProgress({ phase: 'progress', message: 'Gmail: comprobando el borrador antes de enviar', percent: 30 });
    const current = await requestJson({ fetchImpl: this.fetchImpl, url: `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, headers, service: 'Gmail' });
    if (!current.ok) return { ok: false, error: `Nothing was sent: the draft could not be read (${current.error ?? 'error'})` };
    const message = isRecord(current.body) && isRecord(current.body.message) ? current.body.message : null;
    const payload = message && isRecord(message.payload) ? message.payload : null;
    const rawHeaders = payload && Array.isArray(payload.headers) ? payload.headers : null;
    if (!rawHeaders) return { ok: false, error: 'Nothing was sent: the draft headers could not be verified' };
    const header = (name: string): string => {
      const found = rawHeaders.find((item) => isRecord(item) && typeof item.name === 'string' && item.name.toLowerCase() === name);
      return isRecord(found) && typeof found.value === 'string' ? found.value : '';
    };
    const actualTo = addressSet(header('to'));
    const actualCc = addressSet(header('cc'));
    const actualBcc = addressSet(header('bcc'));
    const actualSubject = normaliseSubject(header('subject'));
    if (!sameSet(actualTo, expectedTo) || !sameSet(actualCc, expectedCc) || !sameSet(actualBcc, expectedBcc) || actualSubject !== expectedSubject) {
      return { ok: false, error: 'Nothing was sent: the draft no longer matches the recipients/subject the Founder approved. Review it and approve again.' };
    }
    const text = plainTextBody(payload);
    if (text === null) return { ok: false, error: 'Nothing was sent: the draft body could not be verified' };
    if (draftBodyDigest(text) !== expectedBody) {
      return { ok: false, error: 'Nothing was sent: the draft body no longer matches the text the Founder approved. Review it and approve again.' };
    }

    await onProgress({ phase: 'progress', message: 'Gmail: ENVIANDO el correo aprobado', percent: 70 });
    const sent = await requestJson({ fetchImpl: this.fetchImpl, url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts/send', method: 'POST', headers, body: { id: draftId }, service: 'Gmail' });
    if (!sent.ok) return { ok: false, error: sent.error };
    const result = isRecord(sent.body) ? sent.body : {};
    return {
      ok: true,
      output: { sent: true, messageId: result.id ?? null, threadId: result.threadId ?? null, recipients: actualTo.size + actualCc.size + actualBcc.size, bodyVerified: true },
      ...(typeof result.id === 'string' ? { externalReference: `gmail:message:${result.id}` } : {}),
    };
  }
}

const DRAFT_ID = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * SHA-256 (hex) del texto de un correo tras normalizar saltos de línea y espacios finales. Quien prepare la aprobación calcula
 * este valor con el texto que el Founder vio; el envío lo compara con el borrador que Gmail tiene en ese momento.
 */
export function draftBodyDigest(body: string): string {
  return createHash('sha256').update(body.replace(/\r\n?/g, '\n').trim(), 'utf8').digest('hex');
}

/** Texto plano de un mensaje de Gmail (parte `text/plain`, a cualquier profundidad). `null` si no hay o no se puede decodificar. */
function plainTextBody(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const decode = (data: unknown): string | null => {
    if (typeof data !== 'string' || !data) return null;
    try { return Buffer.from(data, 'base64url').toString('utf8'); } catch { return null; }
  };
  const walk = (part: unknown, depth: number): string | null => {
    if (!isRecord(part) || depth > 6) return null;
    const mime = typeof part.mimeType === 'string' ? part.mimeType.toLowerCase() : '';
    const body = isRecord(part.body) ? part.body : null;
    if (mime === 'text/plain') return decode(body?.data);
    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        const found = walk(child, depth + 1);
        if (found !== null) return found;
      }
    }
    return null;
  };
  return walk(payload, 0);
}

function cleanId(value: unknown, pattern: RegExp): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return pattern.test(text) ? text : null;
}

function composeMessage(input: Record<string, unknown>, action: string): { raw: string } | { error: string } {
  const list = (value: unknown) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((item) => String(item).trim()).filter(Boolean);
  const to = list(input.to);
  const cc = list(input.cc);
  if (to.length === 0 || to.length > 50 || ![...to, ...cc].every((address) => EMAIL.test(address))) return { error: `${action} needs valid recipient e-mail addresses` };
  const subject = typeof input.subject === 'string' ? input.subject : '';
  const body = typeof input.body === 'string' ? input.body : '';
  if (!subject.trim() || !body.trim() || body.length > 100_000) return { error: `${action} needs subject and body` };
  return { raw: Buffer.from(buildRfc2822({ to, cc, subject, body }), 'utf8').toString('base64url') };
}

/** Lower-cased set of e-mail addresses found in a header value or in a list. */
function addressSet(value: unknown): Set<string> {
  const text = Array.isArray(value) ? value.map(String).join(',') : typeof value === 'string' ? value : '';
  return new Set((text.match(/[^\s<>,;"']+@[^\s<>,;"']+\.[A-Za-z]{2,24}/g) ?? []).map((address) => address.toLowerCase()));
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

/** Compares subjects ignoring RFC 2047 UTF-8/base64 encoding, case of the encoding and spacing. */
function normaliseSubject(value: string): string {
  const decoded = value.replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/gi, (_, b64: string) => Buffer.from(b64, 'base64').toString('utf8'));
  return decoded.replace(/\s+/g, ' ').trim();
}
