export type AutomationTriggerSpec =
  | { type: 'manual' }
  | { type: 'schedule'; cron: string; timezone?: string }
  | { type: 'webhook'; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }
  | { type: 'event'; topic: string }
  | { type: 'poll'; intervalMs: number; cursorKey?: string };

export interface TriggerEnvelope {
  id: string;
  workflowId: string;
  workflowRevision: number;
  receivedAt: string;
  trigger: AutomationTriggerSpec;
  payload: unknown;
  dedupeKey?: string;
  sourceRef?: string;
  onlineRequired?: boolean;
}

export interface TriggerValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateAutomationTrigger(trigger: AutomationTriggerSpec): TriggerValidationResult {
  const errors: string[] = [];
  switch (trigger.type) {
    case 'manual':
      break;
    case 'schedule':
      if (!trigger.cron.trim()) errors.push('Schedule trigger cron is required');
      if (trigger.timezone !== undefined && !trigger.timezone.trim()) {
        errors.push('Schedule trigger timezone cannot be empty');
      }
      break;
    case 'webhook':
      if (!trigger.path.startsWith('/')) errors.push('Webhook trigger path must start with /');
      if (trigger.path.includes('..')) errors.push('Webhook trigger path cannot contain ..');
      break;
    case 'event':
      if (!trigger.topic.trim()) errors.push('Event trigger topic is required');
      break;
    case 'poll':
      if (!Number.isFinite(trigger.intervalMs) || trigger.intervalMs < 1_000) {
        errors.push('Poll trigger intervalMs must be at least 1000ms');
      }
      break;
  }
  return { ok: errors.length === 0, errors };
}

export function createTriggerEnvelope(input: Omit<TriggerEnvelope, 'receivedAt'> & { receivedAt?: string }): TriggerEnvelope {
  const validation = validateAutomationTrigger(input.trigger);
  if (!validation.ok) throw new Error(validation.errors.join('; '));
  if (!input.id.trim()) throw new Error('Trigger envelope id is required');
  if (!input.workflowId.trim()) throw new Error('Trigger envelope workflowId is required');
  if (!Number.isInteger(input.workflowRevision) || input.workflowRevision < 1) {
    throw new Error('Trigger envelope workflowRevision must be a positive integer');
  }
  return {
    ...input,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
  };
}

export function shouldQueueTriggerOffline(envelope: TriggerEnvelope, online: boolean): boolean {
  return !online && envelope.onlineRequired === true;
}
