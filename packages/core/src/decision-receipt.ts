import { createHash } from 'node:crypto';

export interface DecisionReceiptInput {
  id: string;
  runId: string;
  blueprintId: string;
  blueprintRevision: number;
  decisionKind: string;
  selectedWorker: string;
  confidence: number;
  inputRefs: string[];
  outputSummary: string;
  at: string;
  previousReceiptHash?: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionReceipt extends DecisionReceiptInput {
  algorithm: 'sha256';
  hash: string;
}

export function createDecisionReceipt(input: DecisionReceiptInput): DecisionReceipt {
  validateReceiptInput(input);
  const algorithm = 'sha256' as const;
  const hash = createHash(algorithm).update(canonicalPayload(input)).digest('hex');
  return { ...input, algorithm, hash };
}

export function verifyDecisionReceipt(receipt: DecisionReceipt): boolean {
  if (receipt.algorithm !== 'sha256') return false;
  const { algorithm: _algorithm, hash, ...input } = receipt;
  try {
    validateReceiptInput(input);
  } catch {
    return false;
  }
  const expected = createHash('sha256').update(canonicalPayload(input)).digest('hex');
  return hash === expected;
}

export function verifyReceiptChain(receipts: readonly DecisionReceipt[]): {
  ok: boolean;
  brokenAt?: number;
  reason?: string;
} {
  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index]!;
    if (!verifyDecisionReceipt(receipt)) {
      return { ok: false, brokenAt: index, reason: 'receipt hash mismatch' };
    }
    if (index > 0 && receipt.previousReceiptHash !== receipts[index - 1]!.hash) {
      return { ok: false, brokenAt: index, reason: 'receipt chain mismatch' };
    }
  }
  return { ok: true };
}

function validateReceiptInput(input: DecisionReceiptInput): void {
  if (!input.id.trim()) throw new Error('Decision receipt id is required');
  if (!input.runId.trim()) throw new Error('Decision receipt runId is required');
  if (!input.blueprintId.trim()) throw new Error('Decision receipt blueprintId is required');
  if (!Number.isInteger(input.blueprintRevision) || input.blueprintRevision < 1) {
    throw new Error('Decision receipt blueprintRevision must be a positive integer');
  }
  if (!input.decisionKind.trim()) throw new Error('Decision receipt decisionKind is required');
  if (!input.selectedWorker.trim()) throw new Error('Decision receipt selectedWorker is required');
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    throw new Error('Decision receipt confidence must be between 0 and 1');
  }
}

function canonicalPayload(input: DecisionReceiptInput): string {
  return stableJson({
    id: input.id,
    runId: input.runId,
    blueprintId: input.blueprintId,
    blueprintRevision: input.blueprintRevision,
    decisionKind: input.decisionKind,
    selectedWorker: input.selectedWorker,
    confidence: input.confidence,
    inputRefs: input.inputRefs,
    outputSummary: input.outputSummary,
    at: input.at,
    previousReceiptHash: input.previousReceiptHash ?? null,
    metadata: input.metadata ?? {},
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
