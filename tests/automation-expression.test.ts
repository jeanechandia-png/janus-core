import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePath,
  resolveWorkflowString,
  resolveWorkflowValue,
} from '../packages/automation/src/expression-engine.js';

const context = {
  input: { email: 'lead@example.com', amount: 42 },
  nodes: { qualify: { output: { score: 0.91 } } },
  vars: { company: 'Infinity' },
};

test('workflow expression engine resolves exact values without eval', () => {
  assert.equal(resolveWorkflowString('{{ $input.amount }}', context), 42);
  assert.equal(resolvePath('$nodes.qualify.output.score', context), 0.91);
});

test('workflow expression engine resolves nested structures and inline text', () => {
  const resolved = resolveWorkflowValue(
    { subject: 'Hello {{ $vars.company }}', score: '{{ $nodes.qualify.output.score }}' },
    context,
  );
  assert.deepEqual(resolved, { subject: 'Hello Infinity', score: 0.91 });
});

test('workflow expression engine rejects unsupported roots', () => {
  assert.throws(() => resolveWorkflowString('{{ $env.SECRET }}', context), /Unsupported/);
});
