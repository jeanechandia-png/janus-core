import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTINUE_BY_ALTERNATIVES_POLICY,
  buildOperationalBlockerResolution,
  defaultProviderAlternatives,
} from '../packages/core/src/progress-policy.js';

test('provider blocker produces multiple alternatives and parks the dependency when work can continue', () => {
  const alternatives = defaultProviderAlternatives({
    providerName: 'Claude',
    task: 'continue coding',
    localAvailable: false,
    otherModelAvailable: false,
  });
  assert.equal(alternatives.length, 4);

  const resolution = buildOperationalBlockerResolution({
    problem: 'Claude is unavailable.',
    risk: 'Stopping would make the project depend on one provider.',
    cause: 'Provider authentication unavailable.',
    kind: 'provider',
    alternatives,
    parkedIssue: 'Restore provider authentication later.',
  });

  assert.equal(resolution.disposition, 'park_and_continue');
  assert.equal(resolution.alternatives.length, 4);
  assert.match(resolution.recommendation, /park|Use/i);
  assert.ok(resolution.nextAction.length > 0);
});

test('mandatory safety/approval blocker still stops despite available alternatives', () => {
  const resolution = buildOperationalBlockerResolution({
    problem: 'A destructive external action lacks explicit approval.',
    risk: 'Proceeding could cause irreversible damage.',
    cause: 'Required human confirmation is missing.',
    kind: 'approval',
    alternatives: [
      {
        id: 'prepare',
        title: 'prepare the change',
        description: 'Prepare a dry-run and impact report without executing.',
        preservesGoal: true,
        availableNow: true,
        risk: 'low',
        nextAction: 'Generate the dry-run while awaiting approval.',
      },
      {
        id: 'wait',
        title: 'wait for approval',
        description: 'Preserve state and resume after explicit approval.',
        preservesGoal: true,
        availableNow: true,
        risk: 'low',
        nextAction: 'Request approval and preserve the resume point.',
      },
    ],
    mandatoryStop: true,
  });

  assert.equal(resolution.disposition, 'block');
  assert.match(resolution.recommendation, /do not bypass/i);
});

test('blocker protocol rejects a single-option dead end', () => {
  assert.throws(
    () => buildOperationalBlockerResolution({
      problem: 'One provider failed.',
      risk: 'Work might stop.',
      cause: 'Provider unavailable.',
      alternatives: [{
        id: 'wait',
        title: 'wait',
        description: 'Wait only.',
        preservesGoal: true,
        availableNow: true,
        risk: 'low',
        nextAction: 'Wait.',
      }],
    }),
    /2-4 real alternatives/,
  );
});

test('continue-by-alternatives policy defines only genuine mandatory stops', () => {
  assert.equal(CONTINUE_BY_ALTERNATIVES_POLICY.id, 'continue-by-alternatives-v1');
  assert.ok(CONTINUE_BY_ALTERNATIVES_POLICY.mandatoryStops.includes('required human approval'));
  assert.ok(CONTINUE_BY_ALTERNATIVES_POLICY.rule.includes('2-4 real alternatives'));
});
