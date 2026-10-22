/**
 * Continuidad automática entre chats (ADR-002, extensión 2026-10-22).
 * Al abrir un chat nuevo, Janus lee SIN que se lo pidan el chat anterior en orden cronológico,
 * extrae encargos, decisiones, correcciones, pendientes y preguntas abiertas, y los convierte en
 * ChronologyRecord para bootstrapContinuity(). El proveedor del chat es un adaptador; la autoridad
 * sigue siendo la cronología local.
 */
import { bootstrapContinuity, type ChronologyRecord, type ContinuitySnapshot, type SessionArchive } from './continuity.js';

export interface ChatMessage { at: string; role: 'user' | 'assistant' | 'system'; text: string }
export interface ChatTranscript { chatId: string; startedAt: string; messages: ChatMessage[] }

export interface ChatBriefing {
  fromChatIds: string[];
  requests: string[];
  decisions: string[];
  corrections: string[];
  pending: string[];
  openQuestions: string[];
  lastUserMessage?: string;
  records: ChronologyRecord[];
  summary: string;
}

const RX = {
  decision: /(me gusta|aprobad[oa]|elegid[oa]|eleg[ií]|de acuerdo|ok,? (as[ií]|perfecto)|decid[ií]|vamos con|me quedo con)/i,
  correction: /(corrige|corrijo|desaprobad[oa]|descartad[oa]|inaceptable|no me gusta|eso no|me corrijo|en vez de|incumple)/i,
  pending: /(pendiente|falta|luego|despu[eé]s|m[aá]s adelante|todav[ií]a no|por hacer|cuando (termines|continuemos))/i,
  request: /(ejecuta|implementa|haz|hazme|crea|genera|necesito|quiero|agrega|añade|actualiza|revisa|dame)/i
};

const clip = (s: string, n = 220) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s).replace(/\s+/g, ' ').trim();

/** Selecciona los chats previos al actual (por defecto el inmediatamente anterior) y los ordena cronológicamente. */
export function previousChats(transcripts: ChatTranscript[], currentChatId: string, depth = 1): ChatTranscript[] {
  const sorted = [...transcripts].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const idx = sorted.findIndex((t) => t.chatId === currentChatId);
  const before = idx === -1 ? sorted : sorted.slice(0, idx);
  return before.slice(-Math.max(1, depth));
}

export function briefPreviousChats(transcripts: ChatTranscript[], currentChatId: string, depth = 1): ChatBriefing {
  const chats = previousChats(transcripts, currentChatId, depth);
  const msgs = chats.flatMap((c) => c.messages.map((m, i) => ({ ...m, chatId: c.chatId, i })))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.i - b.i);
  const b: ChatBriefing = { fromChatIds: chats.map((c) => c.chatId), requests: [], decisions: [], corrections: [], pending: [], openQuestions: [], records: [], summary: '' };
  let seq = 0;
  const rec = (m: { at: string; chatId: string }, kind: ChronologyRecord['kind'], subject: string, content: string) =>
    b.records.push({ id: m.chatId + ':' + (++seq), sessionId: m.chatId, at: m.at, sequence: seq, kind, subject, content, status: 'current' });

  msgs.forEach((m, k) => {
    if (m.role !== 'user' || !m.text.trim()) return;
    const t = clip(m.text);
    b.lastUserMessage = t;
    if (RX.correction.test(m.text)) { b.corrections.push(t); rec(m, 'instruction', 'correccion:' + seq, t); }
    else if (RX.decision.test(m.text)) { b.decisions.push(t); rec(m, 'decision', 'decision:' + seq, t); }
    if (RX.pending.test(m.text)) { b.pending.push(t); rec(m, 'task', 'pendiente:' + seq, t); }
    if (RX.request.test(m.text)) { b.requests.push(t); rec(m, 'task', 'encargo:' + seq, t); }
    const answered = msgs.slice(k + 1).some((n) => n.role === 'assistant' && n.text.trim().length > 0);
    if (/\?\s*$/.test(m.text.trim()) && !answered) b.openQuestions.push(t);
  });

  b.summary = [
    'Contexto del chat anterior (' + b.fromChatIds.join(', ') + '), en orden cronológico:',
    b.requests.length ? '• Encargos: ' + b.requests.slice(-5).join(' | ') : '',
    b.decisions.length ? '• Decisiones: ' + b.decisions.slice(-5).join(' | ') : '',
    b.corrections.length ? '• Correcciones vigentes: ' + b.corrections.slice(-5).join(' | ') : '',
    b.pending.length ? '• Pendientes: ' + b.pending.slice(-5).join(' | ') : '',
    b.openQuestions.length ? '• Preguntas sin responder: ' + b.openQuestions.join(' | ') : '',
    b.lastUserMessage ? '• Último mensaje del usuario: ' + b.lastUserMessage : ''
  ].filter(Boolean).join('\n');
  return b;
}

/** Arranque automático de un chat nuevo: cronología local + resumen del chat anterior, antes de planificar. */
export function autoBootstrapNewChat(archives: SessionArchive[], transcripts: ChatTranscript[], newChatId: string, depth = 1): { snapshot: ContinuitySnapshot; briefing: ChatBriefing } {
  const briefing = briefPreviousChats(transcripts, newChatId, depth);
  const known = new Set(archives.map((a) => a.sessionId));
  const extra: SessionArchive[] = briefing.fromChatIds.filter((id) => !known.has(id)).map((id) => {
    const t = transcripts.find((x) => x.chatId === id)!;
    return { sessionId: id, startedAt: t.startedAt, records: briefing.records.filter((r) => r.sessionId === id) };
  });
  return { snapshot: bootstrapContinuity([...archives, ...extra]), briefing };
}
