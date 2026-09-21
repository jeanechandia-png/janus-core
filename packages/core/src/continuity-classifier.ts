import { createHash } from 'node:crypto';
import type { ChronologyRecord } from './continuity.js';
import type { ConversationMessage } from './conversation-archive.js';

export function classifyExplicitContinuity(message: ConversationMessage): ChronologyRecord[] {
  if (message.role !== 'user') return [];
  const content = compact(message.content);
  if (!content) return [];

  const records: ChronologyRecord[] = [];
  if (isStrongDirective(content)) {
    records.push({
      id: 'continuity:' + message.id + ':instruction',
      sessionId: message.sessionId,
      at: message.at,
      sequence: message.sequence,
      kind: 'instruction',
      subject: 'directive:' + fingerprint(content),
      content,
      status: isStableDirective(content) ? 'stable' : 'current',
      metadata: { sourceMessageId: message.id, classifier: 'explicit-v1' },
    });
  }

  if (isExplicitErrorReport(content)) {
    records.push({
      id: 'continuity:' + message.id + ':error',
      sessionId: message.sessionId,
      at: message.at,
      sequence: message.sequence == null ? undefined : message.sequence + 1,
      kind: 'error',
      subject: 'reported-error:' + fingerprint(content),
      content,
      status: 'current',
      metadata: {
        sourceMessageId: message.id,
        classifier: 'explicit-v1',
        diagnosisRequired: true,
      },
    });
  }

  return records;
}

function isStrongDirective(content: string): boolean {
  return /\b(siempre|nunca|debe(?:n)?|tiene(?:n)? que|es vital|regla|por defecto|autom[aá]ticamente|obligatorio|no debe(?:n)?)\b/i.test(content);
}

function isStableDirective(content: string): boolean {
  return /\b(siempre|nunca|es vital|regla|por defecto|obligatorio)\b/i.test(content);
}

function isExplicitErrorReport(content: string): boolean {
  const namesError = /\b(error|fallo|equivocaci[oó]n|problema repetido|reincidencia)\b/i.test(content);
  const learningIntent = /\b(no (?:se )?repita|no olvidar|lecci[oó]n|regla preventiva|causa|impacto|corregir)\b/i.test(content);
  return namesError && learningIntent;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 4000);
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 16);
}