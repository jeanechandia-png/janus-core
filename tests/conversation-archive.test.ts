import assert from 'node:assert/strict';
import test from 'node:test';
import { replayArchiveChronologically } from '../packages/core/src/conversation-archive.js';
import { SqliteStore } from '../packages/core/src/sqlite-store.js';

test('Janus local conversation archive replays sessions and messages chronologically', async () => {
  const store = new SqliteStore(':memory:');
  try {
    store.upsertConversationSession({
      id: 'chat-2',
      source: 'janus',
      startedAt: '2026-09-22T10:00:00.000Z',
    });
    store.upsertConversationSession({
      id: 'chat-1',
      source: 'janus',
      startedAt: '2026-09-21T10:00:00.000Z',
    });

    store.appendConversationMessage({
      id: 'm2',
      sessionId: 'chat-2',
      at: '2026-09-22T10:00:01.000Z',
      role: 'user',
      content: 'continúa',
      source: 'janus',
    });
    store.appendConversationMessage({
      id: 'm1',
      sessionId: 'chat-1',
      at: '2026-09-21T10:00:01.000Z',
      role: 'user',
      content: 'primera instrucción',
      source: 'janus',
    });

    const provider = {
      name: 'sqlite-test',
      listSessions: async () => store.listConversationSessions(),
      listMessages: async (sessionId: string) => store.listConversationMessages(sessionId),
    };
    const messages = await replayArchiveChronologically(provider);

    assert.deepEqual(messages.map((message) => message.id), ['m1', 'm2']);
    assert.equal(messages[0]?.content, 'primera instrucción');
    assert.equal(messages[1]?.content, 'continúa');
  } finally {
    store.close();
  }
});