import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateInstructionAudit, type InstructionAudit } from '../packages/core/src/instruction-audit.js';
const fixture = (): InstructionAudit => ({ schemaVersion: 1, fullProjectHistoriesAvailable: false, sources: [{ id: 'user', status: 'read' }], requirements: [{ id: 'voice', title: 'Both voices', status: 'verified_in_code', policySubjects: ['voice'], sources: ['user'], evidence: [{ kind: 'code', path: 'voice.ts' }, { kind: 'test', path: 'voice.test.ts', result: 'pass' }] }], legacy: { declaredCount: 1, contractIds: ['H01'], reconciledIds: [], note: 'not migrated' } });
test('passing code tests cannot certify missing project histories or unreconciled legacy instructions', () => {
  const result = evaluateInstructionAudit(fixture(), ['voice'], () => true);
  assert.equal(result.valid, true); assert.equal(result.allInstructionsImplemented, false); assert.equal(result.unreconciledLegacy, 1);
});
test('lost policies, removed requirements and missing evidence fail closed', () => {
  const previous = fixture(); const next = fixture();
  next.requirements = []; next.legacy.contractIds = [];
  const result = evaluateInstructionAudit(next, ['voice'], () => true, previous);
  assert.ok(result.errors.includes('untracked_policy:voice'));
  assert.ok(result.errors.includes('removed_instruction:voice'));
  assert.ok(result.errors.includes('removed_legacy_contract:H01'));
  assert.equal(evaluateInstructionAudit(fixture(), ['voice'], () => false).valid, false);
});
test('supersession retains the old decision and requires an identified successor', () => {
  const audit = fixture(); audit.requirements.push({ id: 'old-voice', title: 'Historical design', status: 'superseded', sources: ['user'], supersededBy: 'voice' });
  assert.equal(evaluateInstructionAudit(audit, ['voice'], () => true).valid, true);
  audit.requirements[1]!.supersededBy = 'absent';
  assert.equal(evaluateInstructionAudit(audit, ['voice'], () => true).valid, false);
});
