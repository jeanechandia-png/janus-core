import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import { createReusableLibraryItem } from '../packages/core/src/reusable-library.js';
import { buildProjectCheckpoint } from '../packages/core/src/project-context.js';
import { reconstructContinuity } from '../packages/core/src/continuity.js';

test('SQLite persists reusable library revisions and project context checkpoints', () => {
  const store = new SqliteStore(':memory:');

  const item = createReusableLibraryItem({
    id: 'button.infinity.hyperreal',
    revision: 1,
    status: 'current',
    kind: 'button',
    name: 'Infinity hyperreal button',
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
    tags: ['infinity', 'button'],
    spec: { illuminated: true },
  });
  store.upsertReusableLibraryItem(item);

  const project = {
    id: 'project-1',
    name: 'Project One',
    status: 'active' as const,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
  };
  const thread = {
    id: 'thread-1',
    projectId: project.id,
    title: 'Main',
    status: 'active' as const,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'founder',
  };
  const resource = {
    id: 'resource-1',
    projectId: project.id,
    threadId: thread.id,
    name: 'Logo',
    source: 'local' as const,
    sourceRef: 'local://assets/logo.svg',
    createdAt: '2026-10-01T08:01:00.000Z',
    addedBy: 'founder',
  };
  store.upsertProjectWorkspace(project);
  store.upsertProjectThread(thread);
  store.upsertProjectResource(resource);

  const continuity = reconstructContinuity([{
    id: 'task-1',
    sessionId: thread.id,
    at: '2026-10-01T08:10:00.000Z',
    kind: 'task',
    subject: 'active-work',
    content: 'Continue building with catalog components.',
    status: 'current',
    metadata: { projectId: project.id, threadId: thread.id },
  }]);
  const checkpoint = buildProjectCheckpoint({
    project,
    thread,
    continuity,
    createdAt: '2026-10-01T08:11:00.000Z',
  });
  store.appendProjectCheckpoint(checkpoint);
  store.appendProjectCheckpoint(checkpoint);

  assert.equal(store.getReusableLibraryItem(item.id)?.checksum, item.checksum);
  assert.equal(store.listReusableLibraryItems({ tag: 'button' }).length, 1);
  assert.equal(store.getProjectWorkspace(project.id)?.name, project.name);
  assert.equal(store.listProjectThreads(project.id).length, 1);
  assert.equal(store.listProjectResources(project.id).length, 1);
  assert.equal(store.listProjectCheckpoints(project.id).length, 1);
  assert.equal(store.latestProjectCheckpoint(project.id)?.checksum, checkpoint.checksum);

  store.close();
});
