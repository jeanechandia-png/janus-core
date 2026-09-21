export type KnowledgeStatus = 'stable' | 'current' | 'temporary' | 'historical';

export type ChronologyKind =
  | 'instruction'
  | 'decision'
  | 'state'
  | 'task'
  | 'error'
  | 'lesson'
  | 'verification';

export interface ChronologyRecord {
  id: string;
  sessionId: string;
  at: string;
  sequence?: number;
  kind: ChronologyKind;
  subject: string;
  content: string;
  status: KnowledgeStatus;
  supersedesId?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionArchive {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  records: ChronologyRecord[];
  errors?: ErrorLesson[];
}

export interface ErrorLessonInput {
  id: string;
  fingerprint: string;
  at: string;
  error: string;
  cause: string;
  impact: string;
  lesson: string;
  preventiveRule: string;
  solutions: string[];
  change: string;
  verification: string;
  verified?: boolean;
}

export interface ErrorLesson extends ErrorLessonInput {
  recurrenceCount: number;
  priority: 'normal' | 'high' | 'critical';
  requiresProtectionReview: boolean;
}

export interface ContinuitySnapshot {
  orderedRecords: ChronologyRecord[];
  currentBySubject: Record<string, ChronologyRecord>;
  historical: ChronologyRecord[];
  activeInstructions: ChronologyRecord[];
  unresolvedErrors: ChronologyRecord[];
  errorLessons: ErrorLesson[];
  preventiveRules: string[];
  resumeFrom?: ChronologyRecord;
  latestSessionId?: string;
}

export class ErrorLedger {
  private readonly byFingerprint = new Map<string, ErrorLesson>();

  constructor(initial: ErrorLesson[] = []) {
    for (const lesson of initial) this.merge(lesson);
  }

  record(input: ErrorLessonInput): ErrorLesson {
    const fingerprint = normalizeFingerprint(input.fingerprint);
    if (!fingerprint) throw new Error('error fingerprint is required');

    const previous = this.byFingerprint.get(fingerprint);
    const recurrenceCount = (previous?.recurrenceCount ?? 0) + 1;
    const lesson: ErrorLesson = {
      ...input,
      fingerprint,
      recurrenceCount,
      priority: priorityFor(recurrenceCount),
      requiresProtectionReview: recurrenceCount > 1,
      verified: input.verified ?? false,
    };
    this.byFingerprint.set(fingerprint, lesson);
    return lesson;
  }

  merge(lesson: ErrorLesson): void {
    const fingerprint = normalizeFingerprint(lesson.fingerprint);
    if (!fingerprint) throw new Error('error fingerprint is required');
    const previous = this.byFingerprint.get(fingerprint);
    if (!previous || lesson.recurrenceCount >= previous.recurrenceCount) {
      this.byFingerprint.set(fingerprint, { ...lesson, fingerprint });
    }
  }

  verify(fingerprint: string, verification: string, at: string): ErrorLesson {
    const key = normalizeFingerprint(fingerprint);
    const existing = this.byFingerprint.get(key);
    if (!existing) throw new Error('error fingerprint not found');
    const updated: ErrorLesson = {
      ...existing,
      verification,
      at,
      verified: true,
    };
    this.byFingerprint.set(key, updated);
    return updated;
  }

  list(): ErrorLesson[] {
    return [...this.byFingerprint.values()].sort((a, b) =>
      compareChronological(a.at, b.at, a.id, b.id),
    );
  }

  preventiveRules(): string[] {
    return [...new Set(this.list().map((item) => item.preventiveRule.trim()).filter(Boolean))];
  }
}

export function bootstrapContinuity(sessions: SessionArchive[]): ContinuitySnapshot {
  const orderedSessions = [...sessions].sort((a, b) =>
    compareChronological(a.startedAt, b.startedAt, a.sessionId, b.sessionId),
  );
  const records = orderedSessions.flatMap((session) => session.records);
  const ledger = new ErrorLedger(orderedSessions.flatMap((session) => session.errors ?? []));
  return reconstructContinuity(records, ledger);
}

export function reconstructContinuity(
  records: ChronologyRecord[],
  ledger = new ErrorLedger(),
): ContinuitySnapshot {
  const seenIds = new Set<string>();
  const orderedRecords = [...records]
    .map((record) => validateRecord(record))
    .sort(compareRecords);

  const current = new Map<string, ChronologyRecord>();
  const historical: ChronologyRecord[] = [];
  const unresolvedErrors: ChronologyRecord[] = [];

  for (const record of orderedRecords) {
    if (seenIds.has(record.id)) throw new Error(`duplicate chronology record id: ${record.id}`);
    seenIds.add(record.id);

    if (record.kind === 'error') {
      if (record.status !== 'historical') unresolvedErrors.push(record);
      continue;
    }
    if (record.status === 'historical') {
      historical.push(record);
      continue;
    }

    const previous = current.get(record.subject);
    if (previous) historical.push({ ...previous, status: 'historical' });

    current.set(record.subject, record);
  }

  const currentRecords = [...current.values()].sort(compareRecords);
  const activeInstructions = currentRecords.filter((record) => record.kind === 'instruction');
  const resumeFrom = [...currentRecords]
    .reverse()
    .find((record) => record.kind === 'task' || record.kind === 'state' || record.kind === 'decision');

  return {
    orderedRecords,
    currentBySubject: Object.fromEntries(currentRecords.map((record) => [record.subject, record])),
    historical: historical.sort(compareRecords),
    activeInstructions,
    unresolvedErrors: unresolvedErrors.sort(compareRecords),
    errorLessons: ledger.list(),
    preventiveRules: ledger.preventiveRules(),
    ...(resumeFrom ? { resumeFrom } : {}),
    ...(orderedRecords.at(-1)?.sessionId ? { latestSessionId: orderedRecords.at(-1)!.sessionId } : {}),
  };
}

function validateRecord(record: ChronologyRecord): ChronologyRecord {
  if (!record.id.trim()) throw new Error('chronology record id is required');
  if (!record.sessionId.trim()) throw new Error('sessionId is required');
  if (!record.subject.trim()) throw new Error('chronology subject is required');
  if (!record.content.trim()) throw new Error('chronology content is required');
  if (!Number.isFinite(Date.parse(record.at))) throw new Error(`invalid chronology timestamp: ${record.at}`);
  return { ...record };
}

function compareRecords(a: ChronologyRecord, b: ChronologyRecord): number {
  const byTime = Date.parse(a.at) - Date.parse(b.at);
  if (byTime !== 0) return byTime;
  const bySequence = (a.sequence ?? 0) - (b.sequence ?? 0);
  if (bySequence !== 0) return bySequence;
  return a.id.localeCompare(b.id);
}

function compareChronological(atA: string, atB: string, idA: string, idB: string): number {
  const byTime = Date.parse(atA) - Date.parse(atB);
  return byTime !== 0 ? byTime : idA.localeCompare(idB);
}

function normalizeFingerprint(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function priorityFor(recurrenceCount: number): ErrorLesson['priority'] {
  if (recurrenceCount >= 3) return 'critical';
  if (recurrenceCount >= 2) return 'high';
  return 'normal';
}
