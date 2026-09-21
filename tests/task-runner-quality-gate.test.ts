import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryGate } from '../packages/core/src/delivery-gate.js';
import type { JanusEvent } from '../packages/core/src/events.js';
import { createOfflineQualityReviewers } from '../packages/core/src/quality-reviewers.js';
import { TaskRunner } from '../packages/core/src/task-runner.js';

test('TaskRunner releases artifacts only after all automatic quality gates pass', async () => {
  const events: JanusEvent[] = [];
  const runner = new TaskRunner('deliver a clean result', {
    sink: async (event) => { events.push(event); },
    deliveryGate: new DeliveryGate(createOfflineQualityReviewers()),
  });

  await runner.heard('text');
  const snapshot = await runner.execute([{
    id: 'deliver',
    label: 'Deliver',
    run: async ({ emit }) => {
      await emit('artifact.updated', 'Final result', {
        artifactId: 'clean',
        artifactKind: 'text',
        preview: 'Resultado claro, coherente y listo para entregar.',
      });
    },
  }]);

  assert.equal(snapshot.status, 'completed');
  const types = events.map((event) => event.type);
  assert.ok(types.includes('quality.started'));
  assert.ok(types.includes('quality.passed'));
  assert.ok(types.includes('artifact.updated'));
  assert.ok(types.indexOf('quality.passed') < types.indexOf('artifact.updated'));
});

test('TaskRunner refuses a final artifact that fails a required gate', async () => {
  const events: JanusEvent[] = [];
  const runner = new TaskRunner('reject bad result', {
    sink: async (event) => { events.push(event); },
    deliveryGate: new DeliveryGate(createOfflineQualityReviewers()),
  });

  await runner.heard('text');
  await assert.rejects(
    runner.execute([{
      id: 'deliver',
      label: 'Deliver',
      run: async ({ emit }) => {
        await emit('artifact.updated', 'Broken markdown', {
          artifactId: 'bad',
          artifactKind: 'document',
          preview: '```text\nUnclosed code block',
        });
      },
    }]),
    /Delivery Gate rejected artifact/,
  );

  const types = events.map((event) => event.type);
  assert.ok(types.includes('quality.failed'));
  assert.equal(types.includes('artifact.updated'), false);
  assert.ok(types.includes('run.failed'));
});