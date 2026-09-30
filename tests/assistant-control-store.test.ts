import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';
import {
  createAssistantProfileRevision,
  defaultLandingAssistantProfile,
  defaultLandingAssistantSurfaces,
} from '../packages/core/src/assistant-control-plane.js';

test('SQLite persists assistant profile revisions and landing surfaces', () => {
  const store = new SqliteStore(':memory:');
  const v1 = defaultLandingAssistantProfile('2026-10-01T00:00:00.000Z');
  store.upsertAssistantProfileRevision(v1);
  for (const surface of defaultLandingAssistantSurfaces('2026-10-01T00:00:00.000Z')) {
    store.upsertAssistantSurface(surface);
  }

  const v2 = createAssistantProfileRevision({
    profileId: v1.profileId,
    revision: 2,
    status: 'current',
    name: v1.name,
    objective: v1.objective,
    sharedInstructions: [...v1.sharedInstructions, 'Shared revision two.'],
    guardrails: v1.guardrails,
    capabilities: v1.capabilities,
    moduleRefs: [],
    createdAt: '2026-10-01T01:00:00.000Z',
    createdBy: 'founder',
    supersedesRevision: 1,
  });
  store.upsertAssistantProfileRevision({ ...v1, status: 'historical' });
  store.upsertAssistantProfileRevision(v2);

  assert.equal(store.getAssistantProfileRevision(v1.profileId)?.revision, 2);
  assert.equal(store.getAssistantProfileRevision(v1.profileId, 1)?.status, 'historical');
  assert.equal(store.listAssistantProfileRevisions(v1.profileId).length, 2);
  assert.equal(store.listAssistantSurfaces().length, 3);
  assert.equal(store.getAssistantSurface('landing.iba')?.product, 'infinity-business-assistant');

  store.close();
});
