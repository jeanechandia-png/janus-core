import { createHash } from 'node:crypto';

// Document Restoration Lab — reusable LEGO module (ADR-010, owner instruction 2026-10-20).
// Runs only inside Infinity Lab, InfinitySeed's controlled test environment.
// Purpose: recover damaged, faded, skewed or partial documents and produce clean, searchable,
// editable working copies — never counterfeits.
// Invariants:
//  1. The original is immutable: it is referenced by checksum and never overwritten.
//  2. Every output carries a provenance manifest (original hash, every operation, operator,
//     environment) and a visible «restored / modified copy» mark that cannot be switched off.
//  3. Physical restoration (cleaning, straightening, contrast, repairing tears/stains, OCR)
//     is allowed for every document class.
//  4. Changing the *content* (text, figures, dates, names, signatures, seals, photos) is allowed
//     only for documents the requester owns and that are not official/identity/financial/legal
//     instruments. For those classes Janus restores, never alters.
//  5. Every job is chained in a tamper-evident audit log.

export type LabEnvironment = 'infinity-lab' | 'production' | 'unknown';

export type DocumentClass =
  | 'personal_note'
  | 'business_internal'
  | 'marketing'
  | 'archival_photo'
  | 'letter'
  | 'identity'
  | 'government_issued'
  | 'financial_instrument'
  | 'legal_certificate'
  | 'academic_credential'
  | 'medical_record';

export const PROTECTED_CLASSES: ReadonlySet<DocumentClass> = new Set([
  'identity',
  'government_issued',
  'financial_instrument',
  'legal_certificate',
  'academic_credential',
  'medical_record',
]);

export type PhysicalOperation =
  | 'deskew'
  | 'dewarp'
  | 'denoise'
  | 'contrast'
  | 'stain_removal'
  | 'tear_repair'
  | 'colorize_reference'
  | 'upscale'
  | 'ocr_transcribe'
  | 'reformat_layout'
  | 'translate_working_copy';

export type ContentOperation =
  | 'edit_text'
  | 'replace_figure'
  | 'change_date'
  | 'change_name'
  | 'alter_signature'
  | 'alter_seal'
  | 'replace_photo';

export type RestorationOperation = PhysicalOperation | ContentOperation;

const CONTENT_OPERATIONS: ReadonlySet<RestorationOperation> = new Set([
  'edit_text', 'replace_figure', 'change_date', 'change_name', 'alter_signature', 'alter_seal', 'replace_photo',
]);
/** Never allowed on any class: they exist only so a request can be named and refused. */
const ALWAYS_REFUSED: ReadonlySet<RestorationOperation> = new Set(['alter_signature', 'alter_seal']);

export interface RestorationRequest {
  jobId: string;
  environment: LabEnvironment;
  operatorId: string;
  documentClass: DocumentClass;
  /** True when the operator (or the organisation they act for) owns the document's content. */
  operatorOwnsContent: boolean;
  original: { ref: string; sha256: string; mimeType: string };
  operations: RestorationOperation[];
  purpose: string;
  requestedAt?: string;
}

export interface RestorationPlan {
  jobId: string;
  allowed: RestorationOperation[];
  refused: { operation: RestorationOperation; reason: string }[];
  mark: string;
}

export interface ProvenanceManifest {
  jobId: string;
  environment: 'infinity-lab';
  operatorId: string;
  documentClass: DocumentClass;
  originalSha256: string;
  outputSha256: string;
  operations: RestorationOperation[];
  contentModified: boolean;
  mark: string;
  purpose: string;
  createdAt: string;
  previousAuditHash: string;
  auditHash: string;
}

export const RESTORED_MARK = 'COPIA RESTAURADA — Infinity Lab · no es el original';
export const MODIFIED_MARK = 'COPIA MODIFICADA — Infinity Lab · no es el original';

export function planRestoration(request: RestorationRequest): RestorationPlan {
  if (request.environment !== 'infinity-lab') throw new Error('Document restoration runs only inside the Infinity Lab controlled environment');
  if (!/^[0-9a-f]{64}$/.test(request.original.sha256)) throw new Error('Original must be referenced by its sha256');
  if (!request.purpose.trim()) throw new Error('Every restoration job needs a stated purpose');
  if (!request.operations.length) throw new Error('No operations requested');

  const allowed: RestorationOperation[] = [];
  const refused: RestorationPlan['refused'] = [];
  const isProtected = PROTECTED_CLASSES.has(request.documentClass);
  for (const operation of [...new Set(request.operations)]) {
    if (!CONTENT_OPERATIONS.has(operation)) {
      allowed.push(operation);
    } else if (ALWAYS_REFUSED.has(operation)) {
      refused.push({ operation, reason: 'Signatures and seals are never altered' });
    } else if (isProtected) {
      refused.push({ operation, reason: `Content of ${request.documentClass} documents is restored, never altered` });
    } else if (!request.operatorOwnsContent) {
      refused.push({ operation, reason: 'Content changes need ownership of the document' });
    } else {
      allowed.push(operation);
    }
  }
  const contentModified = allowed.some((operation) => CONTENT_OPERATIONS.has(operation));
  return { jobId: request.jobId, allowed, refused, mark: contentModified ? MODIFIED_MARK : RESTORED_MARK };
}

export function sealRestoration(input: {
  request: RestorationRequest;
  plan: RestorationPlan;
  outputSha256: string;
  previousAuditHash?: string;
  createdAt?: string;
}): ProvenanceManifest {
  const { request, plan } = input;
  if (plan.jobId !== request.jobId) throw new Error('Plan and request do not match');
  if (!/^[0-9a-f]{64}$/.test(input.outputSha256)) throw new Error('Output must be referenced by its sha256');
  if (input.outputSha256 === request.original.sha256 && plan.allowed.length) {
    throw new Error('Output identical to the original; the original is never overwritten');
  }
  const base = {
    jobId: request.jobId,
    environment: 'infinity-lab' as const,
    operatorId: request.operatorId,
    documentClass: request.documentClass,
    originalSha256: request.original.sha256,
    outputSha256: input.outputSha256,
    operations: plan.allowed,
    contentModified: plan.mark === MODIFIED_MARK,
    mark: plan.mark,
    purpose: request.purpose,
    createdAt: input.createdAt ?? new Date().toISOString(),
    previousAuditHash: input.previousAuditHash ?? '0'.repeat(64),
  };
  return { ...base, auditHash: createHash('sha256').update(stableJson(base)).digest('hex') };
}

export function verifyRestorationChain(manifests: readonly ProvenanceManifest[]): boolean {
  let previous = '0'.repeat(64);
  for (const manifest of manifests) {
    if (manifest.previousAuditHash !== previous) return false;
    const { auditHash, ...base } = manifest;
    if (createHash('sha256').update(stableJson(base)).digest('hex') !== auditHash) return false;
    previous = auditHash;
  }
  return true;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
