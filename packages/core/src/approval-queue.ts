import { randomUUID } from 'node:crypto';

/**
 * Founder Approval Queue — sensitive actions (external writes, paid
 * generations, production changes) WAIT here for an explicit human decision
 * instead of being auto-approved or blindly failed.
 *
 * - One decision per request (idempotent; later decisions are rejected).
 * - Requests expire (default 15 min) → treated as "not approved".
 * - Cancelling a run rejects its pending requests.
 * - Every transition is reported to an audit callback (decision receipts).
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface ApprovalRequestInput {
  runId: string;
  actionId: string;
  label: string;
  tool?: string;
  operation?: string;
  risk?: string;
  reversible?: boolean;
  target?: string;
  reason?: string;
  estimatedCost?: string;
}

export interface ApprovalRecord extends ApprovalRequestInput {
  id: string;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
}

export interface ApprovalOutcome {
  approved: boolean;
  status: ApprovalStatus;
  reason?: string;
  record: ApprovalRecord;
}

interface Waiter {
  record: ApprovalRecord;
  resolve: (outcome: ApprovalOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ApprovalQueue {
  private readonly waiters = new Map<string, Waiter>();
  private readonly history: ApprovalRecord[] = [];

  constructor(private readonly options: {
    timeoutMs?: number;
    now?: () => Date;
    onTransition?: (record: ApprovalRecord) => void;
    historyLimit?: number;
  } = {}) {}

  /** Registers a request and resolves when decided, expired or cancelled. */
  request(input: ApprovalRequestInput): { record: ApprovalRecord; outcome: Promise<ApprovalOutcome> } {
    const now = this.now();
    const timeoutMs = this.options.timeoutMs ?? 15 * 60 * 1000;
    const record: ApprovalRecord = {
      ...input,
      label: input.label.slice(0, 300),
      id: `approval_${randomUUID()}`,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + timeoutMs).toISOString(),
    };
    let resolveOutcome!: (outcome: ApprovalOutcome) => void;
    const outcome = new Promise<ApprovalOutcome>((resolve) => { resolveOutcome = resolve; });
    const timer = setTimeout(() => this.finish(record.id, 'expired', 'janus-core', 'Sin respuesta a tiempo: no se ejecuta.'), timeoutMs);
    this.waiters.set(record.id, { record, resolve: resolveOutcome, timer });
    this.options.onTransition?.({ ...record });
    return { record: { ...record }, outcome };
  }

  pending(): ApprovalRecord[] {
    return [...this.waiters.values()].map((waiter) => ({ ...waiter.record })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  recent(limit = 20): ApprovalRecord[] {
    return this.history.slice(-limit).reverse().map((record) => ({ ...record }));
  }

  decide(id: string, input: { approved: boolean; decidedBy: string; note?: string }): ApprovalRecord {
    if (!this.waiters.has(id)) {
      const done = this.history.find((record) => record.id === id);
      throw new ApprovalDecisionError(done ? 'already_decided' : 'not_found', done ? `Approval already ${done.status}` : 'Approval request not found');
    }
    return this.finish(id, input.approved ? 'approved' : 'rejected', input.decidedBy, input.note?.slice(0, 500));
  }

  cancelRun(runId: string, by = 'janus-core'): number {
    let count = 0;
    for (const waiter of [...this.waiters.values()]) {
      if (waiter.record.runId !== runId) continue;
      this.finish(waiter.record.id, 'cancelled', by, 'La ejecución fue cancelada.');
      count += 1;
    }
    return count;
  }

  private finish(id: string, status: Exclude<ApprovalStatus, 'pending'>, by: string, note?: string): ApprovalRecord {
    const waiter = this.waiters.get(id)!;
    clearTimeout(waiter.timer);
    this.waiters.delete(id);
    const record: ApprovalRecord = {
      ...waiter.record,
      status,
      decidedAt: this.now().toISOString(),
      decidedBy: by,
      ...(note ? { decisionNote: note } : {}),
    };
    this.history.push(record);
    const limit = this.options.historyLimit ?? 200;
    if (this.history.length > limit) this.history.splice(0, this.history.length - limit);
    this.options.onTransition?.({ ...record });
    waiter.resolve({
      approved: status === 'approved',
      status,
      record: { ...record },
      ...(status === 'approved' ? {} : { reason: note ?? `Aprobación ${status}` }),
    });
    return { ...record };
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}

export class ApprovalDecisionError extends Error {
  constructor(readonly code: 'not_found' | 'already_decided', message: string) {
    super(message);
  }
}
