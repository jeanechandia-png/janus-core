/**
 * CASOS PRIORITARIOS del Founder — seguimiento privado de un asunto con hilo de correo, historial auditable,
 * alertas y próxima acción pendiente de su aprobación.
 *
 * Privacidad por diseño:
 *   - Módulo puro y GENÉRICO: no contiene ningún caso. Los datos de un caso entran en tiempo de ejecución y se
 *     guardan cifrados en el almacenamiento de JANUS; nunca en el repositorio, en pruebas ni en registros.
 *   - Acceso exclusivo del Founder (lo impone el runtime); un caso no se comparte con colaboradores ni asistentes.
 *   - JANUS solo LEE el correo. Nunca responde ni envía: la próxima acción es una recomendación que el Founder aprueba.
 *
 * Vigilancia: un mensaje entra en un caso solo si (a) pertenece al MISMO hilo, o (b) viene de un dominio oficial
 * declarado en el caso Y coincide con el remitente conocido o con alguna de sus palabras clave. Un correo del mismo
 * dominio sin relación con el caso se ignora.
 */

export type CasePriority = 'high' | 'normal';
export type CaseStatus = 'waiting_reply' | 'reply_received' | 'action_needed' | 'scheduled' | 'closed';
export type CaseMonitoringState = 'connection_pending' | 'active' | 'error';
export type CaseSignal = 'reply' | 'appointment' | 'deadline' | 'documents' | 'important';
export type NextActionState = 'pending_approval' | 'approved' | 'done' | 'dismissed';

export interface CaseThread {
  provider: 'gmail';
  account: string;
  threadId: string;
  messageId: string;
  subject: string;
  sentAt: string;
  counterpart: { name: string; email: string };
  /** Dominios oficiales desde los que puede llegar algo relacionado (sin @). */
  relatedDomains: string[];
  /** Palabras que identifican el caso en un correo fuera del hilo (lugar, asunto…). */
  keywords: string[];
}

export interface CaseEvent {
  id: string;
  at: string;
  kind: 'created' | 'sent' | 'reply' | 'related' | 'note' | 'status' | 'next_action' | 'translation';
  summary: string;
  source: 'founder' | 'janus' | 'gmail';
  messageId?: string;
  from?: string;
  signals?: CaseSignal[];
  /** Extracto original (tal cual llegó) y, si el Founder la pidió, su traducción. */
  original?: string;
  translation?: string;
}

export interface CaseAlert {
  key: string;
  at: string;
  signal: CaseSignal;
  text: string;
  messageId: string;
  acknowledgedAt?: string;
  notifiedAt?: string;
}

export interface PriorityCase {
  id: string;
  title: string;
  category: string;
  priority: CasePriority;
  status: CaseStatus;
  statusLabel: string;
  ownerPrincipalId: string;
  context?: string;
  /** Expediente privado para la pieza intérprete (solo desambigua; nunca se muestra al equipo). */
  interpreterBrief?: string;
  /** Glosario extra del caso para el intérprete ({nl, es, note?}). */
  interpreterGlossary?: Array<{ [lang: string]: string | undefined; note?: string }>;
  thread?: CaseThread;
  nextAction?: { text: string; state: NextActionState; decidedAt?: string };
  monitoring: { state: CaseMonitoringState; lastCheckedAt?: string; detail?: string };
  timeline: CaseEvent[];
  alerts: CaseAlert[];
  /** Mensajes ya procesados: evita duplicar entradas y alertas. */
  seenMessageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet?: string;
}

const TIMELINE_MAX = 300;
const clean = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isoOf = (value: unknown, field: string): string => {
  const ms = Date.parse(String(value ?? ''));
  if (!Number.isFinite(ms)) throw new Error(`${field} is not a valid date`);
  return new Date(ms).toISOString();
};
const EMAIL = /^[^\s@<>]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,}$/i;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const STATUS_LABELS: Record<CaseStatus, string> = {
  waiting_reply: 'Correo enviado; esperando respuesta', reply_received: 'Respuesta recibida; pendiente de leer',
  action_needed: 'Requiere una acción', scheduled: 'Cita o plazo programado', closed: 'Cerrado',
};
export const CASE_STATUSES = Object.keys(STATUS_LABELS) as CaseStatus[];

export function addressOf(from: string): string {
  const match = /<([^<>]+)>/.exec(from) ?? /([^\s<>"]+@[^\s<>"]+)/.exec(from);
  return (match ? match[1]! : from).trim().toLowerCase();
}
export const domainOf = (address: string): string => address.slice(address.lastIndexOf('@') + 1).toLowerCase();

export function validateCaseThread(input: Partial<CaseThread>): CaseThread {
  const account = clean(input.account, 200).toLowerCase();
  const email = clean(input.counterpart?.email, 200).toLowerCase();
  const threadId = clean(input.threadId, 80);
  if (!EMAIL.test(account)) throw new Error('thread account must be an email address');
  if (!EMAIL.test(email)) throw new Error('counterpart email is not valid');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(threadId)) throw new Error('threadId is not valid');
  const relatedDomains = [...new Set([domainOf(email), ...(input.relatedDomains ?? []).map((d) => clean(d, 100).toLowerCase().replace(/^@/, ''))])].filter((d) => DOMAIN.test(d)).slice(0, 5);
  return {
    provider: 'gmail', account, threadId,
    messageId: clean(input.messageId, 80) || threadId,
    subject: clean(input.subject, 300),
    sentAt: isoOf(input.sentAt, 'sentAt'),
    counterpart: { name: clean(input.counterpart?.name, 120), email },
    relatedDomains,
    keywords: [...new Set((input.keywords ?? []).map((k) => clean(k, 60).toLowerCase()).filter((k) => k.length >= 4))].slice(0, 12),
  };
}

export function createPriorityCase(input: { id: string; title: string; category?: string; priority?: CasePriority; ownerPrincipalId: string; context?: string; interpreterBrief?: string; interpreterGlossary?: unknown; thread?: Partial<CaseThread>; nextAction?: string; status?: CaseStatus }, now: string): PriorityCase {
  const title = clean(input.title, 160);
  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(input.id)) throw new Error('case id is not valid');
  if (!title) throw new Error('case title is required');
  if (!input.ownerPrincipalId) throw new Error('case owner is required');
  const at = new Date(now).toISOString();
  const thread = input.thread ? validateCaseThread(input.thread) : undefined;
  const status: CaseStatus = input.status && CASE_STATUSES.includes(input.status) ? input.status : 'waiting_reply';
  const context = clean(input.context, 1500);
  const nextAction = clean(input.nextAction, 500);
  const interpreterBrief = typeof input.interpreterBrief === 'string' ? input.interpreterBrief.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, 12_000) : '';
  const interpreterGlossary = Array.isArray(input.interpreterGlossary)
    ? input.interpreterGlossary.slice(0, 80).flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const term: { [lang: string]: string | undefined; note?: string } = {};
      for (const [key, value] of Object.entries(item as Record<string, unknown>)) if (typeof value === 'string' && value.trim() && /^(note|[a-z]{2})$/.test(key)) term[key] = value.trim().slice(0, 160);
      return Object.keys(term).filter((key) => key !== 'note').length >= 2 ? [term] : [];
    })
    : [];
  const timeline: CaseEvent[] = [{ id: 'ev-1', at, kind: 'created', summary: 'Caso creado', source: 'founder' }];
  if (thread) timeline.unshift({ id: 'ev-0', at: thread.sentAt, kind: 'sent', summary: `Correo enviado a ${thread.counterpart.name || thread.counterpart.email}`, source: 'founder', messageId: thread.messageId });
  return {
    id: input.id, title, category: clean(input.category, 60) || 'Personal / Privado', priority: input.priority === 'normal' ? 'normal' : 'high',
    status, statusLabel: STATUS_LABELS[status], ownerPrincipalId: input.ownerPrincipalId,
    ...(context ? { context } : {}), ...(interpreterBrief ? { interpreterBrief } : {}), ...(interpreterGlossary.length ? { interpreterGlossary } : {}), ...(thread ? { thread } : {}),
    ...(nextAction ? { nextAction: { text: nextAction, state: 'pending_approval' as const } } : {}),
    monitoring: { state: 'connection_pending', detail: 'Gmail aún no está conectado a JANUS.' },
    timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)), alerts: [], seenMessageIds: thread ? [thread.messageId] : [], createdAt: at, updatedAt: at,
  };
}

const push = (c: PriorityCase, event: Omit<CaseEvent, 'id'>): PriorityCase => ({ ...c, timeline: [...c.timeline, { ...event, id: `ev-${c.timeline.length + 1}-${Date.parse(event.at).toString(36)}` }].slice(-TIMELINE_MAX) });

const SIGNALS: Array<[CaseSignal, RegExp, string]> = [
  ['appointment', /\b(afspraak|uitnodig\w*|langskomen|verhoor|gesprek op|op het bureau|cita|appointment|interview)\b/i, 'Menciona una cita o un encuentro'],
  ['deadline', /\b(uiterlijk|termijn|v[oó]{1,2}r \d|binnen \d+ (dagen|weken)|deadline|plazo|antes del)\b/i, 'Menciona un plazo'],
  ['documents', /\b(document\w*|bewijs\w*|stukken|foto'?s|verklaring|identiteitsbewijs|legitimatie|aanleveren|meenemen|adjunt\w*|documentaci[oó]n)\b/i, 'Pide o menciona documentación'],
  ['important', /\b(aangifte|proces-verbaal|zaaknummer|dossier|tolk|besluit|geseponeerd|denuncia|int[eé]rprete)\b/i, 'Contiene un cambio importante del caso'],
];

export function detectSignals(text: string): CaseSignal[] {
  return SIGNALS.filter(([, pattern]) => pattern.test(text)).map(([signal]) => signal);
}

/** ¿Este correo es del caso? `thread` = mismo hilo; `related` = dominio oficial + remitente conocido o palabra clave. */
export function matchMessage(c: PriorityCase, message: MailMessage): 'thread' | 'related' | null {
  const thread = c.thread;
  if (!thread) return null;
  const sender = addressOf(message.from);
  if (sender === thread.account) return null; // lo que envía el propio Founder no es una respuesta
  if (message.threadId === thread.threadId) return 'thread';
  if (!thread.relatedDomains.includes(domainOf(sender))) return null;
  if (sender === thread.counterpart.email) return 'related';
  const haystack = `${message.subject} ${message.snippet ?? ''}`.toLowerCase();
  return thread.keywords.some((keyword) => haystack.includes(keyword)) ? 'related' : null;
}

export interface IngestResult { case: PriorityCase; added: CaseEvent[]; alerts: CaseAlert[] }

/** Incorpora mensajes nuevos: una entrada y sus alertas por mensaje, una sola vez (por id de mensaje). */
export function ingestMessages(c: PriorityCase, messages: readonly MailMessage[], now: string): IngestResult {
  if (c.status === 'closed') return { case: c, added: [], alerts: [] };
  const at = new Date(now).toISOString();
  let next = c;
  const added: CaseEvent[] = [];
  const alerts: CaseAlert[] = [];
  const ordered = [...messages].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  for (const message of ordered) {
    if (!message.id || next.seenMessageIds.includes(message.id)) continue;
    const match = matchMessage(next, message);
    if (!match) continue;
    const when = Number.isFinite(Date.parse(message.date)) ? new Date(Date.parse(message.date)).toISOString() : at;
    const original = clean(message.snippet, 400);
    const signals: CaseSignal[] = ['reply', ...detectSignals(`${message.subject} ${original}`)];
    const before = next.timeline.length;
    next = push(next, { at: when, kind: match === 'thread' ? 'reply' : 'related', source: 'gmail', messageId: message.id, from: addressOf(message.from), signals,
      summary: match === 'thread' ? 'Respuesta nueva en el hilo original' : 'Correo relacionado desde una dirección oficial', ...(original ? { original } : {}) });
    added.push(next.timeline[before]!);
    for (const signal of signals) {
      const text = signal === 'reply' ? (match === 'thread' ? 'Hay una respuesta nueva en el hilo' : 'Llegó un correo relacionado') : SIGNALS.find(([s]) => s === signal)![2];
      alerts.push({ key: `${message.id}:${signal}`, at: when, signal, text, messageId: message.id });
    }
    next = { ...next, seenMessageIds: [...next.seenMessageIds, message.id].slice(-500) };
  }
  if (!added.length) return { case: next, added, alerts };
  const signalsNow = new Set(alerts.map((alert) => alert.signal));
  const status: CaseStatus = signalsNow.has('appointment') || signalsNow.has('deadline') ? 'scheduled' : signalsNow.has('documents') ? 'action_needed' : 'reply_received';
  next = { ...next, status, statusLabel: STATUS_LABELS[status], alerts: [...next.alerts, ...alerts].slice(-200), updatedAt: at,
    nextAction: { text: status === 'reply_received' ? 'Leer la respuesta y decidir cómo contestar.' : status === 'action_needed' ? 'Revisar qué documentación piden y prepararla.' : 'Confirmar la cita o el plazo y anotarlo en la agenda.', state: 'pending_approval' } };
  return { case: next, added, alerts };
}

export function setMonitoring(c: PriorityCase, state: CaseMonitoringState, now: string, detail?: string): PriorityCase {
  const monitoring = { state, lastCheckedAt: new Date(now).toISOString(), ...(detail ? { detail: clean(detail, 200) } : {}) };
  return { ...c, monitoring };
}

export function setCaseStatus(c: PriorityCase, status: CaseStatus, now: string, note?: string): PriorityCase {
  if (!CASE_STATUSES.includes(status)) throw new Error('unknown case status');
  const at = new Date(now).toISOString();
  return push({ ...c, status, statusLabel: STATUS_LABELS[status], updatedAt: at }, { at, kind: 'status', source: 'founder', summary: `Estado: ${STATUS_LABELS[status]}${clean(note, 200) ? ` — ${clean(note, 200)}` : ''}` });
}

export function addCaseNote(c: PriorityCase, text: string, now: string): PriorityCase {
  const note = clean(text, 1000);
  if (!note) throw new Error('note text is required');
  const at = new Date(now).toISOString();
  return push({ ...c, updatedAt: at }, { at, kind: 'note', source: 'founder', summary: note });
}

/** El Founder decide sobre la acción recomendada. Aprobar NO envía ni ejecuta nada: solo queda constancia. */
export function decideNextAction(c: PriorityCase, decision: 'approved' | 'done' | 'dismissed', now: string): PriorityCase {
  if (decision !== 'approved' && decision !== 'done' && decision !== 'dismissed') throw new Error('unknown decision');
  if (!c.nextAction) throw new Error('the case has no next action');
  if (c.nextAction.state === 'done' || c.nextAction.state === 'dismissed') throw new Error('next action is already closed');
  const at = new Date(now).toISOString();
  const label = { approved: 'aprobada', done: 'hecha', dismissed: 'descartada' }[decision];
  return push({ ...c, nextAction: { ...c.nextAction, state: decision, decidedAt: at }, updatedAt: at }, { at, kind: 'next_action', source: 'founder', summary: `Próxima acción ${label}: ${c.nextAction.text}` });
}

export function proposeNextAction(c: PriorityCase, text: string, now: string): PriorityCase {
  const action = clean(text, 500);
  if (!action) throw new Error('next action text is required');
  return { ...c, nextAction: { text: action, state: 'pending_approval' }, updatedAt: new Date(now).toISOString() };
}

export function acknowledgeAlert(c: PriorityCase, key: string, now: string): PriorityCase {
  if (!c.alerts.some((alert) => alert.key === key)) throw new Error('alert not found');
  return { ...c, alerts: c.alerts.map((alert) => (alert.key === key && !alert.acknowledgedAt ? { ...alert, acknowledgedAt: new Date(now).toISOString() } : alert)) };
}

export function attachTranslation(c: PriorityCase, eventId: string, translation: string, now: string): PriorityCase {
  const text = clean(translation, 2000);
  if (!text) throw new Error('translation is empty');
  if (!c.timeline.some((event) => event.id === eventId && event.original)) throw new Error('event has no original text');
  return { ...c, timeline: c.timeline.map((event) => (event.id === eventId ? { ...event, translation: text } : event)), updatedAt: new Date(now).toISOString() };
}

/** Consulta de Gmail para el caso: solo remitentes de sus dominios oficiales y solo desde el envío original. */
export function gmailQueryFor(c: PriorityCase): string | null {
  if (!c.thread) return null;
  const day = c.thread.sentAt.slice(0, 10).replace(/-/g, '/');
  return `from:(${c.thread.relatedDomains.map((domain) => `@${domain}`).join(' OR ')}) after:${day}`;
}

export function gmailThreadUrl(thread: Pick<CaseThread, 'account' | 'threadId'>): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(thread.account)}#all/${encodeURIComponent(thread.threadId)}`;
}

/** Vista para la tarjeta y la pestaña. Nunca se sirve a nadie que no sea el dueño del caso. */
export function caseView(c: PriorityCase) {
  const pending = c.alerts.filter((alert) => !alert.acknowledgedAt);
  const { interpreterBrief, interpreterGlossary, ...rest } = c;
  return {
    ...rest,
    // El expediente del intérprete no viaja a la pantalla: solo se indica que existe.
    interpreter: { ready: !!interpreterBrief, briefChars: interpreterBrief?.length ?? 0, glossaryTerms: interpreterGlossary?.length ?? 0 },
    gmailUrl: c.thread ? gmailThreadUrl(c.thread) : null,
    pendingAlerts: pending.length,
    monitoringLabel: c.monitoring.state === 'active' ? 'Monitorización activa' : c.monitoring.state === 'error' ? 'Error de conexión' : 'Conexión pendiente',
    timeline: [...c.timeline].sort((a, b) => b.at.localeCompare(a.at)),
  };
}
