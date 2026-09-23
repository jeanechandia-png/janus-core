import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomationNodeRegistry } from '../packages/automation/src/node-registry.js';

test('automation node registry tracks versioned node availability', () => {
  const registry = new AutomationNodeRegistry();
  registry.register({
    type: 'gmail',
    version: 1,
    displayName: 'Gmail',
    kind: 'action',
    executionModes: ['deterministic'],
    capabilities: ['send', 'draft'],
    availability: 'available',
    credentialKinds: ['oauth2'],
  });

  assert.equal(registry.get('gmail', 1)?.availability, 'available');
  registry.setAvailability('gmail', 1, 'needs_auth', 'OAuth expired');
  assert.equal(registry.get('gmail', 1)?.availability, 'needs_auth');
});
