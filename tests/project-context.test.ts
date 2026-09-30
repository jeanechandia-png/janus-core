import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructContinuity } from '../packages/core/src/continuity.js';
import {
  buildProjectCheckpoint,
  projectRecords,
  validateProjectResource,
  validateProjectThread,
  validateProjectWorkspace,
  verifyProjectCheckpoint,
} from '../packages/core/src/project-context.js';

test('project continuity isolates chronology by project', () => {
  const records = [
    {
      id: 'a',
      sessionId: 'thread-a',
      at: '2026-10-01T08:00:00.000Z',
      kind: 'instruction' as const,
      subject: 'design',
      content: 'Use hyperreal illuminated buttons.',
      status: 'stable' as const,
      metadata: { projectId: 'project-a', threadId: 'thread-a' },
    },
    {
      id: 'b',
      sessionId: 'thread-b',
      at: '2026-10-01T08:01:00.000Z',
      kind: 'instruction' as const,
      subject: 'design',
      content: 'Use plain buttons.',
      status: 'stable' as const,
      metadata: { projectId: 'project-b', threadId: 'thread-b' },
    },
  ];

  const filtered = projectRecords(records, 'project-a');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.content, 'Use hyperreal illuminated buttons.');
});

test('new thread checkpoint carries project instructions, decisions and resume point', () => {
  const project = validateProjectWorkspace({
    id: 'project-infinity',
    name: 'Infinity Product',
    status: 'active',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
  });
  const thread = validateProjectThread({
    id: 'thread-2',
    projectId: project.id,
    title: 'Fresh chat',
    status: 'active',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    createdBy: 'founder',
  });
  const continuity = reconstructContinuity([
    {
      id: 'instruction-1',
      sessionId: 'thread-1',
      at: '2026-10-01T08:05:00.000Z',
      kind: 'instruction',
      subject: 'design-system',
      content: 'Reuse approved components instead of rebuilding.',
      status: 'stable',
      metadata: { projectId: project.id, threadId: 'thread-1' },
    },
    {
      id: 'decision-1',
      sessionId: 'thread-1',
      at: '2026-10-01T08:10:00.000Z',
      kind: 'decision',
      subject: 'architecture',
      content: 'Use a central reusable library.',
      status: 'current',
      metadata: { projectId: project.id, threadId: 'thread-1' },
    },
    {
      id: 'task-1',
      sessionId: 'thread-1',
      at: '2026-10-01T08:20:00.000Z',
      kind: 'task',
      subject: 'active-work',
      content: 'Implement the translator medallions from the shared catalog.',
      status: 'current',
      metadata: { projectId: project.id, threadId: 'thread-1' },
    },
  ]);

  const checkpoint = buildProjectCheckpoint({
    project,
    thread,
    continuity,
    createdAt: '2026-10-01T09:00:00.000Z',
  });

  assert.equal(checkpoint.projectId, project.id);
  assert.equal(checkpoint.threadId, thread.id);
  assert.equal(checkpoint.activeInstructions.length, 1);
  assert.equal(checkpoint.decisions.length, 1);
  assert.equal(
    checkpoint.resumeFrom?.content,
    'Implement the translator medallions from the shared catalog.',
  );
  assert.equal(verifyProjectCheckpoint(checkpoint), true);
});

test('project resource references can point to local, Google or Apple-backed files without becoming the brain', () => {
  const resource = validateProjectResource({
    id: 'resource-logo',
    projectId: 'project-infinity',
    threadId: 'thread-1',
    name: 'Infinity logo',
    source: 'google_drive',
    sourceRef: 'drive:file:123',
    createdAt: '2026-10-01T10:00:00.000Z',
    addedBy: 'founder',
    mimeType: 'image/svg+xml',
    checksum: 'abc123',
  });

  assert.equal(resource.source, 'google_drive');
  assert.equal(resource.sourceRef, 'drive:file:123');
});
