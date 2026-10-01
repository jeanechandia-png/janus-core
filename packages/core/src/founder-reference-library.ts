import { createHash } from 'node:crypto';
import type { ChronologyRecord, KnowledgeStatus } from './continuity.js';

export type FounderReferenceKind = 'reference' | 'policy';

export interface FounderReferenceSeed {
  id: string;
  subject: string;
  kind: FounderReferenceKind;
  classification: Extract<KnowledgeStatus, 'stable' | 'current' | 'temporary'>;
  label: string;
  value: string;
  retention: 'preserve';
  tags?: string[];
}

export interface FounderReferenceLibraryDocument {
  schemaVersion: 1;
  ownerPrincipalId: string;
  updatedAt: string;
  records: FounderReferenceSeed[];
}

export function parseFounderReferenceLibrary(value: unknown): FounderReferenceLibraryDocument {
  if (!isRecord(value)) throw new Error('Founder reference library must be an object');
  if (value.schemaVersion !== 1) throw new Error('Unsupported Founder reference library schema');
  const ownerPrincipalId = safeId(value.ownerPrincipalId, 'ownerPrincipalId');
  const updatedAt = validIso(value.updatedAt, 'updatedAt');
  if (!Array.isArray(value.records) || value.records.length === 0) {
    throw new Error('Founder reference library requires at least one record');
  }

  const records = value.records.map(validateSeed);
  const ids = new Set<string>();
  const subjects = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) throw new Error(`Duplicate Founder reference id: ${record.id}`);
    if (subjects.has(record.subject)) {
      throw new Error(`Duplicate Founder reference subject: ${record.subject}`);
    }
    ids.add(record.id);
    subjects.add(record.subject);
  }

  return {
    schemaVersion: 1,
    ownerPrincipalId,
    updatedAt,
    records,
  };
}

export function founderReferenceChronologyRecord(input: {
  seed: FounderReferenceSeed;
  ownerPrincipalId: string;
  at: string;
  previous?: ChronologyRecord;
}): ChronologyRecord {
  const seed = validateSeed(input.seed);
  const ownerPrincipalId = safeId(input.ownerPrincipalId, 'ownerPrincipalId');
  const at = validIso(input.at, 'at');

  return {
    id: `founder-reference:${seed.id}:${timestampId(at)}:${seedContentId(seed)}`,
    sessionId: 'founder-reference-library',
    at,
    kind: 'instruction',
    subject: seed.subject,
    content: referenceInstruction(seed),
    status: seed.classification,
    ...(input.previous ? { supersedesId: input.previous.id } : {}),
    metadata: {
      ownerPrincipalId,
      referenceId: seed.id,
      referenceKind: seed.kind,
      label: seed.label,
      value: seed.value,
      retention: seed.retention,
      tags: seed.tags ?? [],
      source: 'versioned-founder-reference-library',
    },
  };
}

export function founderReferenceNeedsUpdate(
  seed: FounderReferenceSeed,
  current: ChronologyRecord | undefined,
): boolean {
  if (!current) return true;
  const metadata = current.metadata ?? {};
  return (
    current.status !== seed.classification
    || metadata.referenceId !== seed.id
    || metadata.value !== seed.value
    || metadata.label !== seed.label
    || metadata.retention !== seed.retention
    || JSON.stringify(metadata.tags ?? []) !== JSON.stringify(seed.tags ?? [])
  );
}

function validateSeed(value: unknown): FounderReferenceSeed {
  if (!isRecord(value)) throw new Error('Founder reference record must be an object');
  const id = safeId(value.id, 'record id');
  const subject = requiredText(value.subject, 'subject', 240);
  if (!subject.startsWith('founder-reference:') && !subject.startsWith('founder-policy:')) {
    throw new Error(`Founder reference subject must use founder-reference:/founder-policy/: ${subject}`);
  }
  const kind = value.kind === 'reference' || value.kind === 'policy'
    ? value.kind
    : null;
  if (!kind) throw new Error(`Invalid Founder reference kind for ${id}`);
  const classification = value.classification === 'stable'
    || value.classification === 'current'
    || value.classification === 'temporary'
    ? value.classification
    : null;
  if (!classification) throw new Error(`Invalid Founder reference classification for ${id}`);
  if (value.retention !== 'preserve') {
    throw new Error(`Founder reference ${id} must use retention=preserve`);
  }
  const label = requiredText(value.label, 'label', 200);
  const rawValue = requiredText(value.value, 'value', 3000);
  if (kind === 'reference') {
    let parsed: URL;
    try {
      parsed = new URL(rawValue);
    } catch {
      throw new Error(`Founder reference ${id} must contain a valid URL`);
    }
    if (parsed.protocol !== 'https:') {
      throw new Error(`Founder reference ${id} must use HTTPS`);
    }
  }
  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.map((item) => requiredText(item, 'tag', 100)))].slice(0, 50)
    : undefined;

  return {
    id,
    subject,
    kind,
    classification,
    label,
    value: rawValue,
    retention: 'preserve',
    ...(tags ? { tags } : {}),
  };
}

function referenceInstruction(seed: FounderReferenceSeed): string {
  if (seed.kind === 'policy') {
    return `VIGENTE Founder policy — ${seed.label}: ${seed.value}`;
  }
  return (
    `VIGENTE Founder reference — ${seed.label}. Preserve and use this exact source URL when relevant: `
    + seed.value
  );
}

function safeId(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  const result = value.trim();
  if (!result || result.length > 240 || !/^[A-Za-z0-9_.:-]+$/.test(result)) {
    throw new Error(`${label} is invalid`);
  }
  return result;
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`${label} is required`);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new Error(`${label} is invalid`);
  return result;
}

function validIso(value: unknown, label: string): string {
  const text = requiredText(value, label, 80);
  if (Number.isNaN(Date.parse(text))) throw new Error(`${label} must be an ISO timestamp`);
  return text;
}

function timestampId(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 17);
}

function seedContentId(seed: FounderReferenceSeed): string {
  return createHash('sha256')
    .update(JSON.stringify({
      id: seed.id,
      subject: seed.subject,
      kind: seed.kind,
      classification: seed.classification,
      label: seed.label,
      value: seed.value,
      retention: seed.retention,
      tags: seed.tags ?? [],
    }))
    .digest('hex')
    .slice(0, 12);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
