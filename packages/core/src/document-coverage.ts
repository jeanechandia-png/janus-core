export interface DocumentUnit {
  id: string;
  ordinal: number;
  text: string;
  sourceLabel?: string;
}

export interface DocumentCoverage {
  totalUnits: number;
  processedUnits: number;
  missingUnitIds: string[];
  complete: boolean;
}

export function assessDocumentCoverage(
  units: readonly DocumentUnit[],
  processedUnitIds: ReadonlySet<string>,
): DocumentCoverage {
  const missingUnitIds = units
    .filter((unit) => !processedUnitIds.has(unit.id))
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((unit) => unit.id);

  return {
    totalUnits: units.length,
    processedUnits: units.length - missingUnitIds.length,
    missingUnitIds,
    complete: missingUnitIds.length === 0,
  };
}

export function requireWholeDocumentCoverage(
  units: readonly DocumentUnit[],
  processedUnitIds: ReadonlySet<string>,
): void {
  const coverage = assessDocumentCoverage(units, processedUnitIds);
  if (!coverage.complete) {
    throw new Error(
      `Whole-document processing incomplete: ${coverage.processedUnits}/${coverage.totalUnits} units processed; missing=${coverage.missingUnitIds.join(',')}`,
    );
  }
}

export function orderDocumentUnits(units: readonly DocumentUnit[]): DocumentUnit[] {
  const ids = new Set<string>();
  for (const unit of units) {
    if (!unit.id.trim()) throw new Error('document unit id is required');
    if (ids.has(unit.id)) throw new Error(`duplicate document unit id: ${unit.id}`);
    ids.add(unit.id);
  }
  return [...units].sort((a, b) => a.ordinal - b.ordinal);
}
