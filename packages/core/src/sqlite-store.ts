import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ChronologyRecord, ErrorLesson } from './continuity.js';
import type { ConversationMessage, ConversationSession } from './conversation-archive.js';
import type { DecisionBlueprint, BlueprintRevisionProposal } from './decision-blueprint.js';
import type { DecisionReceipt } from './decision-receipt.js';
import type { LearningObservation, ImprovementProposal } from './outcome-learning.js';
import type { EventSink, JanusEvent, RunSnapshot } from './events.js';

export class SqliteStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  readonly eventSink: EventSink = async (event) => {
    this.appendEvent(event);
  };

  appendEvent(event: JanusEvent): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO events
        (id, run_id, seq, type, at, source, summary, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.runId,
      event.seq,
      event.type,
      event.at,
      event.source,
      event.summary,
      JSON.stringify(event.payload ?? {}),
    );
  }

  upsertConversationSession(session: ConversationSession): void {
    this.db.prepare(`
      INSERT INTO conversation_sessions
        (id, source, started_at, ended_at, metadata_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source = excluded.source,
        started_at = MIN(conversation_sessions.started_at, excluded.started_at),
        ended_at = COALESCE(excluded.ended_at, conversation_sessions.ended_at),
        metadata_json = excluded.metadata_json
    `).run(
      session.id,
      session.source,
      session.startedAt,
      session.endedAt ?? null,
      JSON.stringify(session.metadata ?? {}),
    );
  }

  appendConversationMessage(message: ConversationMessage): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO conversation_messages
        (id, session_id, at, seq, role, content, source, source_ref, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      message.id,
      message.sessionId,
      message.at,
      message.sequence ?? null,
      message.role,
      message.content,
      message.source,
      message.sourceRef ?? null,
      JSON.stringify(message.metadata ?? {}),
    );
  }

  listConversationSessions(limit = 500): ConversationSession[] {
    const rows = this.db.prepare(`
      SELECT id, source, started_at, ended_at, metadata_json
      FROM conversation_sessions
      ORDER BY started_at ASC, id ASC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      source: String(row.source) as ConversationSession['source'],
      startedAt: String(row.started_at),
      ...(row.ended_at == null ? {} : { endedAt: String(row.ended_at) }),
      metadata: JSON.parse(String(row.metadata_json)) as Record<string, unknown>,
    }));
  }

  listConversationMessages(sessionId?: string, limit = 5000): ConversationMessage[] {
    const rows = sessionId
      ? this.db.prepare(`
          SELECT id, session_id, at, seq, role, content, source, source_ref, metadata_json
          FROM conversation_messages
          WHERE session_id = ?
          ORDER BY at ASC, COALESCE(seq, 0) ASC, id ASC
          LIMIT ?
        `).all(sessionId, limit)
      : this.db.prepare(`
          SELECT id, session_id, at, seq, role, content, source, source_ref, metadata_json
          FROM conversation_messages
          ORDER BY at ASC, COALESCE(seq, 0) ASC, id ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      at: String(row.at),
      ...(row.seq == null ? {} : { sequence: Number(row.seq) }),
      role: String(row.role) as ConversationMessage['role'],
      content: String(row.content),
      source: String(row.source) as ConversationMessage['source'],
      ...(row.source_ref == null ? {} : { sourceRef: String(row.source_ref) }),
      metadata: JSON.parse(String(row.metadata_json)) as Record<string, unknown>,
    }));
  }

  appendChronologyRecord(record: ChronologyRecord): void {
    this.db.prepare(`
      INSERT INTO chronology_records
        (id, session_id, at, seq, kind, subject, content, status, supersedes_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.sessionId,
      record.at,
      record.sequence ?? null,
      record.kind,
      record.subject,
      record.content,
      record.status,
      record.supersedesId ?? null,
      JSON.stringify(record.metadata ?? {}),
    );
  }

  listChronologyRecords(limit = 5000): ChronologyRecord[] {
    const rows = this.db.prepare(`
      SELECT id, session_id, at, seq, kind, subject, content, status, supersedes_id, metadata_json
      FROM chronology_records
      ORDER BY at ASC, COALESCE(seq, 0) ASC, id ASC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      at: String(row.at),
      ...(row.seq == null ? {} : { sequence: Number(row.seq) }),
      kind: String(row.kind) as ChronologyRecord['kind'],
      subject: String(row.subject),
      content: String(row.content),
      status: String(row.status) as ChronologyRecord['status'],
      ...(row.supersedes_id == null ? {} : { supersedesId: String(row.supersedes_id) }),
      metadata: JSON.parse(String(row.metadata_json)) as Record<string, unknown>,
    }));
  }

  upsertErrorLesson(lesson: ErrorLesson): void {
    this.db.prepare(`
      INSERT INTO error_lessons
        (
          fingerprint, id, at, error_text, cause, impact, lesson, preventive_rule,
          solutions_json, change_text, verification, verified, recurrence_count,
          priority, requires_protection_review
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET
        id = excluded.id,
        at = excluded.at,
        error_text = excluded.error_text,
        cause = excluded.cause,
        impact = excluded.impact,
        lesson = excluded.lesson,
        preventive_rule = excluded.preventive_rule,
        solutions_json = excluded.solutions_json,
        change_text = excluded.change_text,
        verification = excluded.verification,
        verified = excluded.verified,
        recurrence_count = excluded.recurrence_count,
        priority = excluded.priority,
        requires_protection_review = excluded.requires_protection_review
    `).run(
      lesson.fingerprint,
      lesson.id,
      lesson.at,
      lesson.error,
      lesson.cause,
      lesson.impact,
      lesson.lesson,
      lesson.preventiveRule,
      JSON.stringify(lesson.solutions),
      lesson.change,
      lesson.verification,
      lesson.verified ? 1 : 0,
      lesson.recurrenceCount,
      lesson.priority,
      lesson.requiresProtectionReview ? 1 : 0,
    );
  }

  listErrorLessons(): ErrorLesson[] {
    const rows = this.db.prepare(`
      SELECT
        fingerprint, id, at, error_text, cause, impact, lesson, preventive_rule,
        solutions_json, change_text, verification, verified, recurrence_count,
        priority, requires_protection_review
      FROM error_lessons
      ORDER BY at ASC, id ASC
    `).all() as Record<string, unknown>[];

    return rows.map((row) => ({
      fingerprint: String(row.fingerprint),
      id: String(row.id),
      at: String(row.at),
      error: String(row.error_text),
      cause: String(row.cause),
      impact: String(row.impact),
      lesson: String(row.lesson),
      preventiveRule: String(row.preventive_rule),
      solutions: JSON.parse(String(row.solutions_json)) as string[],
      change: String(row.change_text),
      verification: String(row.verification),
      verified: Number(row.verified) === 1,
      recurrenceCount: Number(row.recurrence_count),
      priority: String(row.priority) as ErrorLesson['priority'],
      requiresProtectionReview: Number(row.requires_protection_review) === 1,
    }));
  }


  upsertDecisionBlueprint(blueprint: DecisionBlueprint): void {
    this.db.prepare(`
      INSERT INTO decision_blueprints
        (blueprint_id, revision, status, created_at, blueprint_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(blueprint_id, revision) DO UPDATE SET
        status = excluded.status,
        created_at = excluded.created_at,
        blueprint_json = excluded.blueprint_json
    `).run(
      blueprint.id,
      blueprint.revision,
      blueprint.status,
      blueprint.createdAt,
      JSON.stringify(blueprint),
    );
  }

  getDecisionBlueprint(blueprintId: string, revision?: number): DecisionBlueprint | null {
    const row = revision === undefined
      ? this.db.prepare(`
          SELECT blueprint_json
          FROM decision_blueprints
          WHERE blueprint_id = ?
          ORDER BY revision DESC
          LIMIT 1
        `).get(blueprintId)
      : this.db.prepare(`
          SELECT blueprint_json
          FROM decision_blueprints
          WHERE blueprint_id = ? AND revision = ?
        `).get(blueprintId, revision);

    if (!row) return null;
    return JSON.parse(String((row as Record<string, unknown>).blueprint_json)) as DecisionBlueprint;
  }

  listDecisionBlueprints(blueprintId?: string): DecisionBlueprint[] {
    const rows = blueprintId
      ? this.db.prepare(`
          SELECT blueprint_json
          FROM decision_blueprints
          WHERE blueprint_id = ?
          ORDER BY revision ASC
        `).all(blueprintId)
      : this.db.prepare(`
          SELECT blueprint_json
          FROM decision_blueprints
          ORDER BY blueprint_id ASC, revision ASC
        `).all();

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.blueprint_json)) as DecisionBlueprint,
    );
  }

  appendDecisionReceipt(receipt: DecisionReceipt): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO decision_receipts
        (
          hash, id, run_id, at, blueprint_id, blueprint_revision,
          previous_receipt_hash, receipt_json
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      receipt.hash,
      receipt.id,
      receipt.runId,
      receipt.at,
      receipt.blueprintId,
      receipt.blueprintRevision,
      receipt.previousReceiptHash ?? null,
      JSON.stringify(receipt),
    );
  }

  listDecisionReceipts(runId?: string, limit = 5000): DecisionReceipt[] {
    const rows = runId
      ? this.db.prepare(`
          SELECT receipt_json
          FROM decision_receipts
          WHERE run_id = ?
          ORDER BY at ASC, rowid ASC
          LIMIT ?
        `).all(runId, limit)
      : this.db.prepare(`
          SELECT receipt_json
          FROM decision_receipts
          ORDER BY at ASC, rowid ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.receipt_json)) as DecisionReceipt,
    );
  }

  appendLearningObservation(observation: LearningObservation): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO learning_observations
        (id, receipt_hash, blueprint_id, blueprint_revision, at, observation_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      observation.id,
      observation.receiptHash,
      observation.blueprintId,
      observation.blueprintRevision,
      observation.at,
      JSON.stringify(observation),
    );
  }

  listLearningObservations(blueprintId?: string, limit = 5000): LearningObservation[] {
    const rows = blueprintId
      ? this.db.prepare(`
          SELECT observation_json
          FROM learning_observations
          WHERE blueprint_id = ?
          ORDER BY at ASC, id ASC
          LIMIT ?
        `).all(blueprintId, limit)
      : this.db.prepare(`
          SELECT observation_json
          FROM learning_observations
          ORDER BY at ASC, id ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.observation_json)) as LearningObservation,
    );
  }

  upsertImprovementProposal(proposal: ImprovementProposal | BlueprintRevisionProposal): void {
    this.db.prepare(`
      INSERT INTO improvement_proposals
        (id, blueprint_id, from_revision, status, created_at, proposal_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        proposal_json = excluded.proposal_json
    `).run(
      proposal.id,
      proposal.blueprintId,
      proposal.fromRevision,
      proposal.status,
      proposal.createdAt,
      JSON.stringify(proposal),
    );
  }

  listImprovementProposals(
    status?: ImprovementProposal['status'],
  ): Array<ImprovementProposal | BlueprintRevisionProposal> {
    const rows = status
      ? this.db.prepare(`
          SELECT proposal_json
          FROM improvement_proposals
          WHERE status = ?
          ORDER BY created_at ASC, id ASC
        `).all(status)
      : this.db.prepare(`
          SELECT proposal_json
          FROM improvement_proposals
          ORDER BY created_at ASC, id ASC
        `).all();

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.proposal_json)) as ImprovementProposal | BlueprintRevisionProposal,
    );
  }

  upsertRun(snapshot: RunSnapshot): void {
    this.db.prepare(`
      INSERT INTO runs
        (id, goal, status, current_step, last_event_seq, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        goal = excluded.goal,
        status = excluded.status,
        current_step = excluded.current_step,
        last_event_seq = excluded.last_event_seq,
        updated_at = excluded.updated_at
    `).run(
      snapshot.runId,
      snapshot.goal,
      snapshot.status,
      snapshot.currentStep ?? null,
      snapshot.lastEventSeq,
      snapshot.startedAt,
      snapshot.updatedAt,
    );
  }

  getRun(runId: string): RunSnapshot | null {
    const row = this.db.prepare(`
      SELECT id, goal, status, current_step, last_event_seq, started_at, updated_at
      FROM runs WHERE id = ?
    `).get(runId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return {
      runId: String(row.id),
      goal: String(row.goal),
      status: String(row.status) as RunSnapshot['status'],
      currentStep: row.current_step == null ? undefined : String(row.current_step),
      lastEventSeq: Number(row.last_event_seq),
      startedAt: String(row.started_at),
      updatedAt: String(row.updated_at),
    };
  }

  listEvents(runId?: string, limit = 500): JanusEvent[] {
    const rows = runId
      ? this.db.prepare(`
          SELECT id, run_id, seq, type, at, source, summary, payload_json
          FROM events WHERE run_id = ? ORDER BY seq ASC LIMIT ?
        `).all(runId, limit)
      : this.db.prepare(`
          SELECT id, run_id, seq, type, at, source, summary, payload_json
          FROM events ORDER BY rowid DESC LIMIT ?
        `).all(limit).reverse();

    return (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      runId: String(row.run_id),
      seq: Number(row.seq),
      type: String(row.type) as JanusEvent['type'],
      at: String(row.at),
      source: String(row.source) as JanusEvent['source'],
      summary: String(row.summary),
      payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    }));
  }

  markInterruptedRuns(): number {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE runs
      SET status = 'blocked', updated_at = ?
      WHERE status IN ('heard', 'running', 'waiting_approval')
    `).run(now);
    return Number(result.changes);
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        current_step TEXT,
        last_event_seq INTEGER NOT NULL DEFAULT 0,
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        UNIQUE(run_id, seq)
      );

      CREATE INDEX IF NOT EXISTS idx_events_run_seq
      ON events(run_id, seq);

      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        metadata_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_sessions_started
      ON conversation_sessions(started_at, id);

      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        at TEXT NOT NULL,
        seq INTEGER,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT NOT NULL,
        source_ref TEXT,
        metadata_json TEXT NOT NULL,
        FOREIGN KEY(session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_time
      ON conversation_messages(session_id, at, seq, id);

      CREATE INDEX IF NOT EXISTS idx_conversation_messages_time
      ON conversation_messages(at, seq, id);

      CREATE TABLE IF NOT EXISTS chronology_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        at TEXT NOT NULL,
        seq INTEGER,
        kind TEXT NOT NULL,
        subject TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        supersedes_id TEXT,
        metadata_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chronology_time
      ON chronology_records(at, seq, id);

      CREATE INDEX IF NOT EXISTS idx_chronology_subject
      ON chronology_records(subject, at);

      CREATE TABLE IF NOT EXISTS error_lessons (
        fingerprint TEXT PRIMARY KEY,
        id TEXT NOT NULL,
        at TEXT NOT NULL,
        error_text TEXT NOT NULL,
        cause TEXT NOT NULL,
        impact TEXT NOT NULL,
        lesson TEXT NOT NULL,
        preventive_rule TEXT NOT NULL,
        solutions_json TEXT NOT NULL,
        change_text TEXT NOT NULL,
        verification TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        recurrence_count INTEGER NOT NULL DEFAULT 1,
        priority TEXT NOT NULL,
        requires_protection_review INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS decision_blueprints (
        blueprint_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        blueprint_json TEXT NOT NULL,
        PRIMARY KEY(blueprint_id, revision)
      );

      CREATE INDEX IF NOT EXISTS idx_decision_blueprints_status
      ON decision_blueprints(status, blueprint_id, revision);

      CREATE TABLE IF NOT EXISTS decision_receipts (
        hash TEXT PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        run_id TEXT NOT NULL,
        at TEXT NOT NULL,
        blueprint_id TEXT NOT NULL,
        blueprint_revision INTEGER NOT NULL,
        previous_receipt_hash TEXT,
        receipt_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_decision_receipts_run_time
      ON decision_receipts(run_id, at);

      CREATE TABLE IF NOT EXISTS learning_observations (
        id TEXT PRIMARY KEY,
        receipt_hash TEXT NOT NULL,
        blueprint_id TEXT NOT NULL,
        blueprint_revision INTEGER NOT NULL,
        at TEXT NOT NULL,
        observation_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_learning_observations_blueprint_time
      ON learning_observations(blueprint_id, at);

      CREATE TABLE IF NOT EXISTS improvement_proposals (
        id TEXT PRIMARY KEY,
        blueprint_id TEXT NOT NULL,
        from_revision INTEGER NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        proposal_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_improvement_proposals_status
      ON improvement_proposals(status, created_at);

    `);
  }
}

export function combineEventSinks(...sinks: EventSink[]): EventSink {
  return async (event) => {
    for (const sink of sinks) await sink(event);
  };
}
