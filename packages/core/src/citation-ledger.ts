export interface CitationSource {
  id: string;
  title?: string;
  uri?: string;
  sourceType: 'file' | 'web' | 'tool' | 'database' | 'user';
  retrievedAt?: string;
  checksum?: string;
}

export interface CitationAnchor {
  sourceId: string;
  locator?: string;
  quoteHash?: string;
}

export interface SupportedClaim {
  claim: string;
  citations: CitationAnchor[];
}

export interface CitationLedger {
  sources: CitationSource[];
  claims: SupportedClaim[];
}

export function validateCitationLedger(ledger: CitationLedger): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const sourceIds = new Set<string>();

  for (const source of ledger.sources) {
    if (!source.id.trim()) errors.push('citation source id is required');
    if (sourceIds.has(source.id)) errors.push(`duplicate citation source id: ${source.id}`);
    sourceIds.add(source.id);
  }

  for (const item of ledger.claims) {
    if (!item.claim.trim()) errors.push('supported claim cannot be empty');
    if (item.citations.length === 0) errors.push(`claim has no citations: ${item.claim.slice(0, 80)}`);
    for (const citation of item.citations) {
      if (!sourceIds.has(citation.sourceId)) {
        errors.push(`claim references unknown citation source: ${citation.sourceId}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function citationCoverage(ledger: CitationLedger): number {
  if (ledger.claims.length === 0) return 1;
  const supported = ledger.claims.filter((item) => item.citations.length > 0).length;
  return supported / ledger.claims.length;
}
