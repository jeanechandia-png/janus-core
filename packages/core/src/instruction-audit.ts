/** Reconciles instruction coverage; file existence and passing unit tests never imply full project completion. */
import { evaluateHistoricalContracts, type HistoricalContractCatalog } from './historical-contracts.js';
export interface InstructionAudit {
  schemaVersion: number;
  fullProjectHistoriesAvailable: boolean;
  sources: Array<{ id: string; status: 'read' | 'unavailable' | 'partial' }>;
  requirements: Array<{
    id: string; title: string; status: 'verified_in_code' | 'partial' | 'pending' | 'superseded';
    policySubjects?: string[]; sources: string[]; supersededBy?: string;
    evidence?: Array<{ kind: 'code' | 'test'; path: string; result?: 'pass' }>;
    remaining?: string;
  }>;
  legacy: { declaredCount: number; contractIds: string[]; reconciledIds: string[]; note: string };
}

export function evaluateInstructionAudit(
  audit: InstructionAudit,
  policySubjects: readonly string[],
  exists: (path: string) => boolean,
  previous?: Pick<InstructionAudit, 'requirements' | 'legacy'>,
  contracts?: HistoricalContractCatalog,
) {
  const errors: string[] = [];
  const ids = new Set(audit.requirements.map(r => r.id));
  if (audit.schemaVersion !== 1 || ids.size !== audit.requirements.length) errors.push('schema_or_duplicate_ids');
  const sources = new Set(audit.sources.map(s => s.id));
  if (sources.size !== audit.sources.length || audit.sources.some(s => !['read', 'unavailable', 'partial'].includes(s.status))) errors.push('invalid_sources');
  const policies = new Set(audit.requirements.filter(r => r.status !== 'superseded').flatMap(r => r.policySubjects ?? []));
  for (const subject of policySubjects) if (!policies.has(subject)) errors.push('untracked_policy:' + subject);
  for (const requirement of audit.requirements) {
    if (!requirement.id || !requirement.title || !['verified_in_code', 'partial', 'pending', 'superseded'].includes(requirement.status)) errors.push('invalid_requirement:' + requirement.id);
    if (!requirement.sources.length || requirement.sources.some(s => !sources.has(s))) errors.push('missing_source:' + requirement.id);
    if (requirement.status === 'superseded' && (!requirement.supersededBy || !ids.has(requirement.supersededBy))) errors.push('lost_successor:' + requirement.id);
    if (requirement.status === 'verified_in_code') {
      const evidence = requirement.evidence ?? [];
      if (!evidence.some(e => e.kind === 'code') || !evidence.some(e => e.kind === 'test' && e.result === 'pass')) errors.push('unproved_implementation:' + requirement.id);
      for (const item of evidence) if (item.path.startsWith('/') || item.path.split('/').includes('..') || !exists(item.path)) errors.push('missing_evidence:' + requirement.id);
    }
  }
  const legacy = new Set(audit.legacy.contractIds);
  if (legacy.size !== audit.legacy.contractIds.length || new Set(audit.legacy.reconciledIds).size !== audit.legacy.reconciledIds.length || audit.legacy.reconciledIds.some(id => !legacy.has(id))) errors.push('invalid_legacy_catalog');
  const historical = contracts ? evaluateHistoricalContracts(contracts, exists, audit.legacy.contractIds) : undefined;
  if (historical) errors.push(...historical.errors);
  if (audit.legacy.reconciledIds.length && !historical) errors.push('missing_semantic_contract_catalog');
  if (contracts && contracts.contracts.some(c => !legacy.has(c.id))) errors.push('untracked_semantic_contract');
  if (previous) {
    for (const item of previous.requirements) if (!ids.has(item.id)) errors.push('removed_instruction:' + item.id);
    for (const id of previous.legacy.contractIds) if (!legacy.has(id)) errors.push('removed_legacy_contract:' + id);
  }
  const remaining = audit.requirements.filter(r => r.status === 'partial' || r.status === 'pending');
  const unreconciledLegacy = legacy.size - new Set(audit.legacy.reconciledIds).size;
  const complete = errors.length === 0 && audit.fullProjectHistoriesAvailable && audit.sources.every(s => s.status === 'read') && remaining.length === 0 && unreconciledLegacy === 0 && historical?.allImplemented === true;
  return { valid: errors.length === 0, allInstructionsImplemented: complete,
    errors, knownRequirements: audit.requirements.length, verifiedInCode: audit.requirements.filter(r => r.status === 'verified_in_code').length,
    remaining: remaining.map(r => ({ id: r.id, title: r.title, status: r.status, remaining: r.remaining })), unreconciledLegacy,
    historicalContracts: historical ? { total: historical.total, declared: historical.declared, additional: historical.additional, security: historical.security, implemented: historical.implemented.length, gaps: historical.gaps.length } : null,
    fullProjectHistoriesAvailable: audit.fullProjectHistoriesAvailable };
}
