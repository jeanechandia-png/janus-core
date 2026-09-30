import { createHash, randomUUID } from 'node:crypto';
import type { ChronologyRecord, ContinuitySnapshot } from './continuity.js';

export type ProjectStatus = 'active' | 'archived';
export type ProjectThreadStatus = 'active' | 'closed';
export type ProjectResourceSource =
  | 'local'
  | 'google_drive'
  | 'apple_icloud'
  | 'upload'
  | 'import'
  | 'other';

export interface ProjectWorkspace {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  coordinationScopeId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectThread {
  id: string;
  projectId: string;
  title: string;
  status: ProjectThreadStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectResourceRef {
  id: string;
  projectId: string;
  threadId?: string;
  name: string;
  source: ProjectResourceSource;
  sourceRef: string;
  createdAt: string;
  addedBy: string;
  mimeType?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectContextCheckpoint {
  id: string;
  projectId: string;
  threadId: string;
  createdAt: string;
  summary: string;
  activeInstructions: Array<{
    subject: string;
    content: string;
    at: string;
    status: string;
  }>;
  decisions: Array<{
    subject: string;
    content: string;
    at: string;
  }>;
  unresolvedErrors: Array<{
    subject: string;
    content: string;
    at: string;
  }>;
  nextActions: string[];
  resumeFrom?: {
    subject: string;
    content: string;
    at: string;
  };
  evidenceRefs: string[];
  checksum: string;
}

export function validateProjectWorkspace(project: ProjectWorkspace): ProjectWorkspace {
  if (!safeId(project.id)) throw new Error('project id is invalid');
  if (!project.name.trim()) throw new Error('project name is required');
  if (!project.createdBy.trim()) throw new Error('project createdBy is required');
  validateIso(project.createdAt, 'project createdAt');
  validateIso(project.updatedAt, 'project updatedAt');
  return {
    ...project,
    id: project.id.trim(),
    name: project.name.trim(),
    createdBy: project.createdBy.trim(),
    coordinationScopeId: project.coordinationScopeId?.trim() || undefined,
    description: project.description?.trim() || undefined,
    metadata: project.metadata ? structuredClone(project.metadata) : undefined,
  };
}

export function validateProjectThread(thread: ProjectThread): ProjectThread {
  if (!safeId(thread.id)) throw new Error('thread id is invalid');
  if (!safeId(thread.projectId)) throw new Error('thread projectId is invalid');
  if (!thread.title.trim()) throw new Error('thread title is required');
  if (!thread.createdBy.trim()) throw new Error('thread createdBy is required');
  validateIso(thread.createdAt, 'thread createdAt');
  validateIso(thread.updatedAt, 'thread updatedAt');
  return {
    ...thread,
    id: thread.id.trim(),
    projectId: thread.projectId.trim(),
    title: thread.title.trim(),
    createdBy: thread.createdBy.trim(),
    metadata: thread.metadata ? structuredClone(thread.metadata) : undefined,
  };
}

export function validateProjectResource(resource: ProjectResourceRef): ProjectResourceRef {
  if (!safeId(resource.id)) throw new Error('resource id is invalid');
  if (!safeId(resource.projectId)) throw new Error('resource projectId is invalid');
  if (resource.threadId && !safeId(resource.threadId)) throw new Error('resource threadId is invalid');
  if (!resource.name.trim()) throw new Error('resource name is required');
  if (!resource.sourceRef.trim()) throw new Error('resource sourceRef is required');
  if (!resource.addedBy.trim()) throw new Error('resource addedBy is required');
  validateIso(resource.createdAt, 'resource createdAt');
  return {
    ...resource,
    id: resource.id.trim(),
    projectId: resource.projectId.trim(),
    threadId: resource.threadId?.trim() || undefined,
    name: resource.name.trim(),
    sourceRef: resource.sourceRef.trim(),
    addedBy: resource.addedBy.trim(),
    mimeType: resource.mimeType?.trim() || undefined,
    checksum: resource.checksum?.trim() || undefined,
    metadata: resource.metadata ? structuredClone(resource.metadata) : undefined,
  };
}

export function projectRecords(
  records: readonly ChronologyRecord[],
  projectId: string,
): ChronologyRecord[] {
  return records.filter((record) => record.metadata?.projectId === projectId);
}

export function buildProjectCheckpoint(input: {
  project: ProjectWorkspace;
  thread: ProjectThread;
  continuity: ContinuitySnapshot;
  nextActions?: readonly string[];
  evidenceRefs?: readonly string[];
  createdAt?: string;
}): ProjectContextCheckpoint {
  const createdAt = input.createdAt ?? new Date().toISOString();
  validateIso(createdAt, 'checkpoint createdAt');

  const decisions = input.continuity.orderedRecords
    .filter((record) => record.kind === 'decision')
    .slice(-30)
    .map((record) => ({
      subject: record.subject,
      content: record.content,
      at: record.at,
    }));
  const activeInstructions = input.continuity.activeInstructions
    .slice(-50)
    .map((record) => ({
      subject: record.subject,
      content: record.content,
      at: record.at,
      status: record.status,
    }));
  const unresolvedErrors = input.continuity.unresolvedErrors
    .slice(-20)
    .map((record) => ({
      subject: record.subject,
      content: record.content,
      at: record.at,
    }));
  const nextActions = clean(input.nextActions ?? inferNextActions(input.continuity));
  const resumeFrom = input.continuity.resumeFrom
    ? {
        subject: input.continuity.resumeFrom.subject,
        content: input.continuity.resumeFrom.content,
        at: input.continuity.resumeFrom.at,
      }
    : undefined;
  const summary = [
    `Project: ${input.project.name}.`,
    resumeFrom ? `Resume from: ${resumeFrom.content}` : 'No explicit resume point recorded.',
    activeInstructions.length > 0
      ? `${activeInstructions.length} active instruction(s) retained.`
      : 'No active instruction recorded.',
    decisions.length > 0
      ? `${decisions.length} recent decision(s) retained.`
      : 'No recent decision recorded.',
    nextActions.length > 0
      ? `Next: ${nextActions.slice(0, 3).join(' | ')}`
      : 'No explicit next action recorded.',
  ].join(' ');

  const evidenceRefs = clean([
    ...(input.evidenceRefs ?? []),
    ...input.continuity.orderedRecords.slice(-80).map((record) => `chronology:${record.id}`),
  ]);
  const id = `checkpoint_${randomUUID()}`;
  const unsigned = {
    id,
    projectId: input.project.id,
    threadId: input.thread.id,
    createdAt,
    summary,
    activeInstructions,
    decisions,
    unresolvedErrors,
    nextActions,
    ...(resumeFrom ? { resumeFrom } : {}),
    evidenceRefs,
  };
  const checksum = createHash('sha256').update(stableJson(unsigned)).digest('hex');
  return { ...unsigned, checksum };
}

export function verifyProjectCheckpoint(checkpoint: ProjectContextCheckpoint): boolean {
  const { checksum, ...unsigned } = checkpoint;
  const expected = createHash('sha256').update(stableJson(unsigned)).digest('hex');
  return expected === checksum;
}

function inferNextActions(continuity: ContinuitySnapshot): string[] {
  const latestTasks = continuity.orderedRecords
    .filter((record) => record.kind === 'task' || record.kind === 'state')
    .slice(-5)
    .map((record) => record.content);
  return latestTasks.length > 0 ? [latestTasks.at(-1)!] : [];
}

function clean(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safeId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value.trim());
}

function validateIso(value: string, label: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} is invalid`);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
