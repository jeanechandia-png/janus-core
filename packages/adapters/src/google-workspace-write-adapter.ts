import type { ToolAdapter, ToolProgress, ToolRequest, ToolResult } from '../../gateways/src/contracts.js';
import { isRecord, requestJson } from './http-json.js';

/**
 * Google Workspace WRITE adapter — separate from the read-only adapter so the
 * write token (minimal scopes `gmail.compose`, `calendar.events`) is only used
 * here. Verified 2026-10-14 (developers.google.com/workspace):
 * POST https://gmail.googleapis.com/gmail/v1/users/me/drafts  (Draft { message: { raw } }) — creates a DRAFT, never sends;
 * POST https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events?sendUpdates=none|all — start/end with dateTime+timeZone.
 * Both actions are forced to explicit approval by the sensitive-action policy.
 */
export interface GoogleWorkspaceWriteAdapterOptions {
  tokenProvider?: () => Promise<string | undefined>;
  token?: string;
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
  readonly capabilities: string[] = ['gmail.draft.create', 'calendar.event.create'];
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GoogleWorkspaceWriteAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async execute(request: ToolRequest, onProgress: (progress: ToolProgress) => void | Promise<void>): Promise<ToolResult> {
    if (!this.capabilities.includes(request.action)) return { ok: false, error: `Unsupported Google Workspace write action: ${request.action}` };
    const token = (this.options.tokenProvider ? await this.options.tokenProvider() : this.options.token)?.trim();
    if (!token) return { ok: false, error: 'Google Workspace write access is not authenticated; provide a token with gmail.compose / calendar.events scopes.' };
    const headers = { authorization: `Bearer ${token}` };
    const input = request.input;

    if (request.action === 'gmail.draft.create') {
      const list = (value: unknown) => (Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []).map((item) => String(item).trim()).filter(Boolean);
      const to = list(input.to);
      const cc = list(input.cc);
      if (to.length === 0 || to.length > 50 || ![...to, ...cc].every((address) => EMAIL.test(address))) return { ok: false, error: 'gmail.draft.create needs valid recipient e-mail addresses' };
      const subject = typeof input.subject === 'string' ? input.subject : '';
      const body = typeof input.body === 'string' ? input.body : '';
      if (!subject.trim() || !body.trim() || body.length > 100_000) return { ok: false, error: 'gmail.draft.create needs subject and body' };
      const raw = Buffer.from(buildRfc2822({ to, cc, subject, body }), 'utf8').toString('base64url');
      await onProgress({ phase: 'progress', message: 'Gmail: creando BORRADOR (no se envía)', percent: 50 });
      const result = await requestJson({ fetchImpl: this.fetchImpl, url: 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', method: 'POST', headers, body: { message: { raw } }, service: 'Gmail' });
      if (!result.ok) return { ok: false, error: result.error };
      const draft = isRecord(result.body) ? result.body : {};
      return { ok: true, output: { draftId: draft.id ?? null, sent: false, note: 'Borrador creado en Gmail; Janus no lo envía.' }, ...(typeof draft.id === 'string' ? { externalReference: `gmail:draft:${draft.id}` } : {}) };
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
}
