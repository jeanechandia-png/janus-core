/** Semantic migration inventory. A recorded gap is reconciled scope, never implemented functionality. */
export interface HistoricalContract {
  id: string;
  family: string;
  definition: string;
  source: string;
  sourceIndex: number;
  scope: 'declared-454' | 'additional-domain' | 'transversal-security';
  disposition: 'implementation_gap' | 'verified_in_code';
  candidateCode: string[];
  candidateTests: string[];
  gap: string;
  evidence?: { code: string[]; tests: string[]; testNames: string[] };
}
export interface HistoricalContractCatalog {
  schemaVersion: number;
  declaredDomainCount: number;
  sources: Array<{ id: string; title: string; version: string }>;
  contracts: HistoricalContract[];
}

export function evaluateHistoricalContracts(catalog: HistoricalContractCatalog, exists: (path: string) => boolean, previousIds: readonly string[] = []) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const sourceIds = new Set(catalog.sources.map(s => s.id));
  const safeExists = (path: string) => Boolean(path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..') && exists(path));
  if (catalog.schemaVersion !== 1 || sourceIds.size !== catalog.sources.length) errors.push('invalid_contract_schema');
  for (const c of catalog.contracts) {
    if (!/^[A-Z]{1,2}\d{2}$/.test(c.id) || ids.has(c.id) || c.family !== c.id.replace(/\d/g, '')) errors.push('invalid_contract_id:' + c.id);
    ids.add(c.id);
    if (!c.definition.trim() || !sourceIds.has(c.source) || !Number.isInteger(c.sourceIndex) || c.sourceIndex < 1) errors.push('missing_contract_definition:' + c.id);
    if (!['declared-454', 'additional-domain', 'transversal-security'].includes(c.scope)) errors.push('invalid_contract_scope:' + c.id);
    if (!['implementation_gap', 'verified_in_code'].includes(c.disposition)) errors.push('invalid_contract_disposition:' + c.id);
    if (!c.candidateCode.length || !c.candidateTests.length || [...c.candidateCode, ...c.candidateTests].some(p => !safeExists(p))) errors.push('invalid_contract_candidates:' + c.id);
    if (c.disposition === 'implementation_gap' && !c.gap.trim()) errors.push('missing_contract_gap:' + c.id);
    if (c.disposition === 'verified_in_code' && (!c.evidence?.code.length || !c.evidence.tests.length || !c.evidence.testNames.length || [...c.evidence.code, ...c.evidence.tests].some(p => !safeExists(p)))) errors.push('unproved_contract:' + c.id);
  }
  for (const id of previousIds) if (!ids.has(id)) errors.push('removed_contract:' + id);
  const declared = catalog.contracts.filter(c => c.scope === 'declared-454').length;
  if (declared !== catalog.declaredDomainCount) errors.push('declared_contract_count_mismatch');
  const implemented = catalog.contracts.filter(c => c.disposition === 'verified_in_code').map(c => c.id);
  return { valid: !errors.length, errors, total: ids.size, declared, additional: catalog.contracts.filter(c => c.scope === 'additional-domain').length,
    security: catalog.contracts.filter(c => c.scope === 'transversal-security').length, implemented,
    gaps: catalog.contracts.filter(c => c.disposition === 'implementation_gap').map(c => c.id),
    allImplemented: !errors.length && implemented.length === ids.size && ids.size > 0 };
}
