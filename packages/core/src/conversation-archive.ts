export type ConversationSource = 'janus' | 'chatgpt' | 'claude' | 'import' | 'other';
export type ConversationRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ConversationSession {
  id: string;
  source: ConversationSource;
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  at: string;
  sequence?: number;
  role: ConversationRole;
  content: string;
  source: ConversationSource;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationArchiveProvider {
  readonly name: string;
  listSessions(): Promise<ConversationSession[]>;
  listMessages(sessionId: string): Promise<ConversationMessage[]>;
}

export function orderConversationMessages(messages: ConversationMessage[]): ConversationMessage[] {
  return [...messages].sort((a, b) => {
    const byTime = Date.parse(a.at) - Date.parse(b.at);
    if (byTime !== 0) return byTime;
    const bySequence = (a.sequence ?? 0) - (b.sequence ?? 0);
    return bySequence !== 0 ? bySequence : a.id.localeCompare(b.id);
  });
}

export async function replayArchiveChronologically(
  provider: ConversationArchiveProvider,
): Promise<ConversationMessage[]> {
  const sessions = await provider.listSessions();
  const orderedSessions = [...sessions].sort((a, b) => {
    const byTime = Date.parse(a.startedAt) - Date.parse(b.startedAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });

  const messages: ConversationMessage[] = [];
  for (const session of orderedSessions) {
    messages.push(...await provider.listMessages(session.id));
  }
  return orderConversationMessages(messages);
}