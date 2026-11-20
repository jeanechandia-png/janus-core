import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { evaluateHistoricalContracts, type HistoricalContractCatalog } from '../packages/core/src/historical-contracts.js';
import { evaluateInstructionAudit, type InstructionAudit } from '../packages/core/src/instruction-audit.js';
const catalog = (): HistoricalContractCatalog => JSON.parse(readFileSync('config/historical-contracts.json', 'utf8'));
const audit = (): InstructionAudit => JSON.parse(readFileSync('config/instruction-audit.json', 'utf8'));

test('semantic inventory retains the 454 declared plus all child, daily life and security requirements', () => {
  const c = catalog(), result = evaluateHistoricalContracts(c, existsSync);
  assert.deepEqual(result.errors, []);
  assert.equal(result.total, 538); assert.equal(result.declared, 454); assert.equal(result.additional, 64); assert.equal(result.security, 20);
  for (const [prefix, count] of [['N', 32], ['B', 32], ['SF', 20]] as const) for (let n = 1; n <= count; n++) {
    const e = c.contracts.find(e => e.id === prefix + String(n).padStart(2, '0'));
    assert.ok(e?.definition); assert.ok(e.sourceIndex > 0);
  }
  assert.equal(result.allImplemented, false);
});
test('catalog rejects dropped contracts, duplicate IDs, unsupported PASS and unsafe evidence paths', () => {
  const c = catalog(); const id = c.contracts[0]!.id;
  c.contracts.shift(); assert.ok(evaluateHistoricalContracts(c, existsSync, [id]).errors.includes('removed_contract:' + id));
  c.contracts.push(c.contracts[0]!); assert.equal(evaluateHistoricalContracts(c, existsSync).valid, false);
  const d = catalog(); d.contracts[0]!.disposition = 'verified_in_code'; delete d.contracts[0]!.evidence;
  assert.ok(evaluateHistoricalContracts(d, existsSync).errors.includes('unproved_contract:' + d.contracts[0]!.id));
  d.contracts[0]!.candidateCode = ['../private']; assert.equal(evaluateHistoricalContracts(d, () => true).valid, false);
});
test('reconciliation cannot mark all instructions implemented while domain gaps remain, even with every history marked read', () => {
  const a = audit(); a.fullProjectHistoriesAvailable = true; a.sources.forEach(s => { s.status = 'read'; });
  a.requirements = []; // Isolate contract coverage from the separate groups gate.
  const result = evaluateInstructionAudit(a, [], existsSync, undefined, catalog());
  assert.equal(result.valid, true); assert.equal(result.unreconciledLegacy, 0);
  assert.equal(result.allInstructionsImplemented, false); assert.ok(result.historicalContracts!.gaps > 0);
  assert.equal(evaluateInstructionAudit(a, [], existsSync).valid, false, 'a list of reconciled IDs without definitions is insufficient');
});
