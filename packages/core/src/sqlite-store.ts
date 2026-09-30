import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ChronologyRecord, ErrorLesson } from './continuity.js';
import type { ConversationMessage, ConversationSession } from './conversation-archive.js';
import type { DecisionBlueprint, BlueprintRevisionProposal } from './decision-blueprint.js';
import type { DecisionReceipt } from './decision-receipt.js';
import type { LearningObservation, ImprovementProposal } from './outcome-learning.js';
import type { DurableJob, JobStatus } from './job-engine.js';
import type { CitationLedger } from './citation-ledger.js';
import type { ImprovementIndex } from './improvement-index.js';
import {
  KERNEL_PERSISTENCE_SCHEMA_VERSION,
  type CitationLedgerSnapshot,
  type ImprovementIndexHistoryEntry,
  type WorkGraphSnapshot,
} from './kernel-persistence.js';
import type { EventSink, JanusEvent, RunSnapshot } from './events.js';
import type { AuthorityPublicCredential } from './authority.js';
import type {
  CoordinationAssignment,
  CoordinationGrant,
  CoordinationHandoff,
  CoordinationOperatorProfile,
  CoordinationScope,
} from './operator-coordination.js';

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

  upsertAuthorityCredential(credential: AuthorityPublicCredential): void {
    this.db.prepare(`
      INSERT INTO authority_credentials
        (
          principal_id, role, display_name, active, algorithm, public_key_pem,
          created_at, delegated_by, revoked_at
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(principal_id) DO UPDATE SET
        role = excluded.role,
        display_name = excluded.display_name,
        active = excluded.active,
        algorithm = excluded.algorithm,
        public_key_pem = excluded.public_key_pem,
        delegated_by = excluded.delegated_by,
        revoked_at = excluded.revoked_at
    `).run(
      credential.principal.id,
      credential.principal.role,
      credential.principal.displayName ?? null,
      credential.principal.active ? 1 : 0,
      credential.algorithm,
      credential.publicKeyPem,
      credential.createdAt,
      credential.delegatedBy ?? null,
      credential.revokedAt ?? null,
    );
  }

  getAuthorityCredential(principalId: string): AuthorityPublicCredential | null {
    const row = this.db.prepare(`
      SELECT
        principal_id, role, display_name, active, algorithm, public_key_pem,
        created_at, delegated_by, revoked_at
      FROM authority_credentials
      WHERE principal_id = ?
    `).get(principalId) as Record<string, unknown> | undefined;

    return row ? authorityCredentialFromRow(row) : null;
  }

  listAuthorityCredentials(activeOnly = false): AuthorityPublicCredential[] {
    const rows = activeOnly
      ? this.db.prepare(`
          SELECT
            principal_id, role, display_name, active, algorithm, public_key_pem,
            created_at, delegated_by, revoked_at
          FROM authority_credentials
          WHERE active = 1 AND revoked_at IS NULL
          ORDER BY created_at ASC, principal_id ASC
        `).all()
      : this.db.prepare(`
          SELECT
            principal_id, role, display_name, active, algorithm, public_key_pem,
            created_at, delegated_by, revoked_at
          FROM authority_credentials
          ORDER BY created_at ASC, principal_id ASC
        `).all();

    return (rows as Record<string, unknown>[]).map(authorityCredentialFromRow);
  }

  revokeAuthorityCredential(principalId: string, revokedAt: string): boolean {
    const result = this.db.prepare(`
      UPDATE authority_credentials
      SET active = 0, revoked_at = ?
      WHERE principal_id = ? AND active = 1
    `).run(revokedAt, principalId);
    return Number(result.changes) > 0;
  }

  upsertCoordinationOperator(profile: CoordinationOperatorProfile): void {
    this.db.prepare(`
      INSERT INTO coordination_operators
        (principal_id, status, updated_at, profile_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(principal_id) DO UPDATE SET
        status = excluded.status,
        updated_at = excluded.updated_at,
        profile_json = excluded.profile_json
    `).run(
      profile.principalId,
      profile.status,
      profile.updatedAt,
      JSON.stringify(profile),
    );
  }

  getCoordinationOperator(principalId: string): CoordinationOperatorProfile | null {
    const row = this.db.prepare(`
      SELECT profile_json FROM coordination_operators WHERE principal_id = ?
    `).get(principalId) as Record<string, unknown> | undefined;
    return row
      ? JSON.parse(String(row.profile_json)) as CoordinationOperatorProfile
      : null;
  }

  listCoordinationOperators(): CoordinationOperatorProfile[] {
    const rows = this.db.prepare(`
      SELECT profile_json FROM coordination_operators
      ORDER BY updated_at ASC, principal_id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => (
      JSON.parse(String(row.profile_json)) as CoordinationOperatorProfile
    ));
  }

  upsertCoordinationScope(scope: CoordinationScope): void {
    this.db.prepare(`
      INSERT INTO coordination_scopes
        (id, classification, owner_principal_id, created_at, scope_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        classification = excluded.classification,
        owner_principal_id = excluded.owner_principal_id,
        scope_json = excluded.scope_json
    `).run(
      scope.id,
      scope.classification,
      scope.ownerPrincipalId,
      scope.createdAt,
      JSON.stringify(scope),
    );
  }

  listCoordinationScopes(): CoordinationScope[] {
    const rows = this.db.prepare(`
      SELECT scope_json FROM coordination_scopes
      ORDER BY created_at ASC, id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => JSON.parse(String(row.scope_json)) as CoordinationScope);
  }

  upsertCoordinationGrant(grant: CoordinationGrant): void {
    this.db.prepare(`
      INSERT INTO coordination_grants
        (id, principal_id, scope_id, revoked_at, created_at, grant_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        principal_id = excluded.principal_id,
        scope_id = excluded.scope_id,
        revoked_at = excluded.revoked_at,
        grant_json = excluded.grant_json
    `).run(
      grant.id,
      grant.principalId,
      grant.scopeId,
      grant.revokedAt ?? null,
      grant.createdAt,
      JSON.stringify(grant),
    );
  }

  listCoordinationGrants(): CoordinationGrant[] {
    const rows = this.db.prepare(`
      SELECT grant_json FROM coordination_grants
      ORDER BY created_at ASC, id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => JSON.parse(String(row.grant_json)) as CoordinationGrant);
  }

  upsertCoordinationAssignment(assignment: CoordinationAssignment): void {
    this.db.prepare(`
      INSERT INTO coordination_assignments
        (id, assignee_principal_id, status, updated_at, assignment_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        assignee_principal_id = excluded.assignee_principal_id,
        status = excluded.status,
        updated_at = excluded.updated_at,
        assignment_json = excluded.assignment_json
    `).run(
      assignment.id,
      assignment.assigneePrincipalId,
      assignment.status,
      assignment.updatedAt,
      JSON.stringify(assignment),
    );
  }

  getCoordinationAssignment(id: string): CoordinationAssignment | null {
    const row = this.db.prepare(`
      SELECT assignment_json FROM coordination_assignments WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;
    return row
      ? JSON.parse(String(row.assignment_json)) as CoordinationAssignment
      : null;
  }

  listCoordinationAssignments(): CoordinationAssignment[] {
    const rows = this.db.prepare(`
      SELECT assignment_json FROM coordination_assignments
      ORDER BY updated_at ASC, id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => (
      JSON.parse(String(row.assignment_json)) as CoordinationAssignment
    ));
  }

  appendCoordinationHandoff(handoff: CoordinationHandoff): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO coordination_handoffs
        (checksum, id, assignment_id, run_id, created_at, handoff_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      handoff.checksum,
      handoff.id,
      handoff.assignmentId,
      handoff.runId ?? null,
      handoff.createdAt,
      JSON.stringify(handoff),
    );
  }

  listCoordinationHandoffs(assignmentId?: string): CoordinationHandoff[] {
    const rows = assignmentId
      ? this.db.prepare(`
          SELECT handoff_json FROM coordination_handoffs
          WHERE assignment_id = ?
          ORDER BY created_at ASC, id ASC
        `).all(assignmentId)
      : this.db.prepare(`
          SELECT handoff_json FROM coordination_handoffs
          ORDER BY created_at ASC, id ASC
        `).all();
    return (rows as Record<string, unknown>[]).map((row) => (
      JSON.parse(String(row.handoff_json)) as CoordinationHandoff
    ));
  }

  upsertWorkGraph(snapshot: WorkGraphSnapshot): void {
    this.db.prepare(`
      INSERT INTO work_graph_snapshots
        (id, run_id, goal, updated_at, snapshot_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        goal = excluded.goal,
        updated_at = excluded.updated_at,
        snapshot_json = excluded.snapshot_json
    `).run(
      snapshot.id,
      snapshot.runId ?? null,
      snapshot.goal,
      snapshot.updatedAt,
      JSON.stringify(snapshot),
    );
  }

  getWorkGraph(id: string): WorkGraphSnapshot | null {
    const row = this.db.prepare(`
      SELECT snapshot_json
      FROM work_graph_snapshots
      WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return JSON.parse(String(row.snapshot_json)) as WorkGraphSnapshot;
  }

  listWorkGraphs(runId?: string, limit = 1000): WorkGraphSnapshot[] {
    const rows = runId
      ? this.db.prepare(`
          SELECT snapshot_json
          FROM work_graph_snapshots
          WHERE run_id = ?
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(runId, limit)
      : this.db.prepare(`
          SELECT snapshot_json
          FROM work_graph_snapshots
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.snapshot_json)) as WorkGraphSnapshot,
    );
  }

  upsertDurableJob(job: DurableJob): void {
    this.db.prepare(`
      INSERT INTO durable_jobs
        (id, kind, status, created_at, updated_at, job_json)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kind = excluded.kind,
        status = excluded.status,
        updated_at = excluded.updated_at,
        job_json = excluded.job_json
    `).run(
      job.id,
      job.kind,
      job.status,
      job.createdAt,
      job.updatedAt,
      JSON.stringify(job),
    );
  }

  getDurableJob(id: string): DurableJob | null {
    const row = this.db.prepare(`
      SELECT job_json
      FROM durable_jobs
      WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return JSON.parse(String(row.job_json)) as DurableJob;
  }

  listDurableJobs(status?: JobStatus, limit = 1000): DurableJob[] {
    const rows = status
      ? this.db.prepare(`
          SELECT job_json
          FROM durable_jobs
          WHERE status = ?
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(status, limit)
      : this.db.prepare(`
          SELECT job_json
          FROM durable_jobs
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.job_json)) as DurableJob,
    );
  }

  upsertCitationLedger(snapshot: CitationLedgerSnapshot<CitationLedger>): void {
    this.db.prepare(`
      INSERT INTO citation_ledgers
        (id, run_id, updated_at, snapshot_json)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        run_id = excluded.run_id,
        updated_at = excluded.updated_at,
        snapshot_json = excluded.snapshot_json
    `).run(
      snapshot.id,
      snapshot.runId ?? null,
      snapshot.updatedAt,
      JSON.stringify(snapshot),
    );
  }

  getCitationLedger(id: string): CitationLedgerSnapshot<CitationLedger> | null {
    const row = this.db.prepare(`
      SELECT snapshot_json
      FROM citation_ledgers
      WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) return null;
    return JSON.parse(String(row.snapshot_json)) as CitationLedgerSnapshot<CitationLedger>;
  }

  listCitationLedgers(
    runId?: string,
    limit = 1000,
  ): Array<CitationLedgerSnapshot<CitationLedger>> {
    const rows = runId
      ? this.db.prepare(`
          SELECT snapshot_json
          FROM citation_ledgers
          WHERE run_id = ?
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(runId, limit)
      : this.db.prepare(`
          SELECT snapshot_json
          FROM citation_ledgers
          ORDER BY updated_at ASC, id ASC
          LIMIT ?
        `).all(limit);

    return (rows as Record<string, unknown>[]).map(
      (row) => JSON.parse(String(row.snapshot_json)) as CitationLedgerSnapshot<CitationLedger>,
    );
  }

  appendImprovementIndex(index: ImprovementIndex, scopeId = 'global'): void {
    const entry: ImprovementIndexHistoryEntry<ImprovementIndex> = {
      schemaVersion: KERNEL_PERSISTENCE_SCHEMA_VERSION,
      scopeId,
      generatedAt: index.generatedAt,
      index,
    };
    this.db.prepare(`
      INSERT OR IGNORE INTO improvement_index_history
        (scope_id, generated_at, index_json)
      VALUES (?, ?, ?)
    `).run(scopeId, index.generatedAt, JSON.stringify(entry));
  }

  listImprovementIndexHistory(
    scopeId = 'global',
    limit = 500,
  ): Array<ImprovementIndexHistoryEntry<ImprovementIndex>> {
    const rows = this.db.prepare(`
      SELECT index_json
      FROM improvement_index_history
      WHERE scope_id = ?
      ORDER BY generated_at ASC
      LIMIT ?
    `).all(scopeId, limit) as Record<string, unknown>[];

    return rows.map(
      (row) => JSON.parse(String(row.index_json)) as ImprovementIndexHistoryEntry<ImprovementIndex>,
    );
  }

  getLatestImprovementIndex(scopeId = 'global'): ImprovementIndex | null {
    const row = this.db.prepare(`
      SELECT index_json
      FROM improvement_index_history
      WHERE scope_id = ?
      ORDER BY generated_at DESC
      LIMIT 1
    `).get(scopeId) as Record<string, unknown> | undefined;

    if (!row) return null;
    const entry = JSON.parse(String(row.index_json)) as ImprovementIndexHistoryEntry<ImprovementIndex>;
    return entry.index;
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


      CREATE TABLE IF NOT EXISTS authority_credentials (
        principal_id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        display_name TEXT,
        active INTEGER NOT NULL,
        algorithm TEXT NOT NULL,
        public_key_pem TEXT NOT NULL,
        created_at TEXT NOT NULL,
        delegated_by TEXT,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_authority_credentials_active
      ON authority_credentials(active, role, principal_id);

      CREATE TABLE IF NOT EXISTS coordination_operators (
        principal_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        profile_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS coordination_scopes (
        id TEXT PRIMARY KEY,
        classification TEXT NOT NULL,
        owner_principal_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        scope_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS coordination_grants (
        id TEXT PRIMARY KEY,
        principal_id TEXT NOT NULL,
        scope_id TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL,
        grant_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_coordination_grants_principal_scope
      ON coordination_grants(principal_id, scope_id, revoked_at);

      CREATE TABLE IF NOT EXISTS coordination_assignments (
        id TEXT PRIMARY KEY,
        assignee_principal_id TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        assignment_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_coordination_assignments_assignee
      ON coordination_assignments(assignee_principal_id, status, updated_at);

      CREATE TABLE IF NOT EXISTS coordination_handoffs (
        checksum TEXT PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        assignment_id TEXT NOT NULL,
        run_id TEXT,
        created_at TEXT NOT NULL,
        handoff_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_coordination_handoffs_assignment
      ON coordination_handoffs(assignment_id, created_at, id);

      CREATE TABLE IF NOT EXISTS work_graph_snapshots (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        goal TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_work_graph_snapshots_run
      ON work_graph_snapshots(run_id, updated_at, id);

      CREATE TABLE IF NOT EXISTS durable_jobs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        job_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_durable_jobs_status
      ON durable_jobs(status, updated_at, id);

      CREATE TABLE IF NOT EXISTS citation_ledgers (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        updated_at TEXT NOT NULL,
        snapshot_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_citation_ledgers_run
      ON citation_ledgers(run_id, updated_at, id);

      CREATE TABLE IF NOT EXISTS improvement_index_history (
        scope_id TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        index_json TEXT NOT NULL,
        PRIMARY KEY(scope_id, generated_at)
      );

      CREATE INDEX IF NOT EXISTS idx_improvement_index_history_scope_time
      ON improvement_index_history(scope_id, generated_at);
    `);
  }
}

function authorityCredentialFromRow(row: Record<string, unknown>): AuthorityPublicCredential {
  return {
    principal: {
      id: String(row.principal_id),
      role: String(row.role) as AuthorityPublicCredential['principal']['role'],
      ...(row.display_name == null ? {} : { displayName: String(row.display_name) }),
      active: Number(row.active) === 1 && row.revoked_at == null,
    },
    algorithm: String(row.algorithm) as AuthorityPublicCredential['algorithm'],
    publicKeyPem: String(row.public_key_pem),
    createdAt: String(row.created_at),
    ...(row.delegated_by == null ? {} : { delegatedBy: String(row.delegated_by) }),
    ...(row.revoked_at == null ? {} : { revokedAt: String(row.revoked_at) }),
  };
}

export function combineEventSinks(...sinks: EventSink[]): EventSink {
  return async (event) => {
    for (const sink of sinks) await sink(event);
  };
}
