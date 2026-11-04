import { createHash } from 'node:crypto';
import type {
  KnowledgeChange,
  KnowledgeEntry,
  KnowledgeProposal,
  KnowledgeRevision,
  KnowledgeState,
  ValidationResult,
} from './types.js';
import { LIMITS, validateChange } from './validate.js';

export function emptyState(): KnowledgeState {
  return { schema: 'infinity.business-knowledge.state/v1', revision: 0, currency: 'EUR', defaultVatPercent: null, entries: {} };
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sin-nombre';
}

export function entryKey(kind: string, title: string): string {
  return `${kind}:${slugify(title)}`;
}

/** JSON canónico (claves ordenadas) para checksums deterministas. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function stateChecksum(state: KnowledgeState): string {
  return sha256Hex(canonicalJson(state));
}

export function validateChanges(changes: readonly KnowledgeChange[]): ValidationResult<KnowledgeChange[]> {
  if (changes.length === 0) return { ok: false, code: 'empty_change_set', message: 'No hay cambios que aplicar.' };
  const cleaned: KnowledgeChange[] = [];
  for (const change of changes) {
    const result = validateChange(change);
    if (!result.ok) return result;
    cleaned.push(result.value);
  }
  return { ok: true, value: cleaned };
}

/** Proposal TTL por defecto: 30 minutos (la aprobación debe llegar mientras la lectura de confirmación sigue vigente). */
export const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export function createProposal(input: {
  id: string;
  state: KnowledgeState;
  changes: readonly KnowledgeChange[];
  source: KnowledgeProposal['source'];
  utterance?: string;
  now: Date;
  ttlMs?: number;
}): ValidationResult<KnowledgeProposal> {
  const checked = validateChanges(input.changes);
  if (!checked.ok) return checked;
  // Se comprueba que el conjunto es aplicable AHORA (claves existentes, límites) antes de pedir aprobación.
  const dryRun = reduceChanges(input.state, checked.value, input.state.revision + 1);
  if (!dryRun.ok) return dryRun;
  const utterance = input.utterance?.replace(/\s+/g, ' ').trim().slice(0, 500);
  return {
    ok: true,
    value: {
      id: input.id,
      changes: checked.value,
      source: input.source,
      ...(utterance ? { utterance } : {}),
      createdAt: input.now.toISOString(),
      expiresAt: new Date(input.now.getTime() + (input.ttlMs ?? PROPOSAL_TTL_MS)).toISOString(),
      baseRevision: input.state.revision,
    },
  };
}

function reduceChanges(state: KnowledgeState, changes: readonly KnowledgeChange[], revision: number): ValidationResult<KnowledgeState> {
  const entries: Record<string, KnowledgeEntry> = { ...state.entries };
  let defaultVatPercent = state.defaultVatPercent;

  for (const change of changes) {
    if (change.op === 'set-default-vat') {
      defaultVatPercent = change.percent;
      continue;
    }
    if (change.op === 'upsert') {
      const key = entryKey(change.entry.kind, change.entry.title);
      const previous = entries[key];
      if (!previous && Object.keys(entries).length >= LIMITS.maxEntries) {
        return { ok: false, code: 'too_many_entries', message: `Se alcanzó el máximo de ${LIMITS.maxEntries} entradas.` };
      }
      entries[key] = {
        key,
        kind: change.entry.kind,
        title: change.entry.title,
        ...(change.entry.body !== undefined ? { body: change.entry.body } : previous?.body !== undefined ? { body: previous.body } : {}),
        ...(change.entry.role !== undefined ? { role: change.entry.role } : previous?.role !== undefined ? { role: previous.role } : {}),
        ...(change.entry.priceCents !== undefined ? { priceCents: change.entry.priceCents } : previous?.priceCents !== undefined ? { priceCents: previous.priceCents } : {}),
        ...(change.entry.priceIncludesVat !== undefined ? { priceIncludesVat: change.entry.priceIncludesVat } : previous?.priceIncludesVat !== undefined ? { priceIncludesVat: previous.priceIncludesVat } : {}),
        ...(change.entry.billing ? { billing: change.entry.billing } : previous?.billing ? { billing: previous.billing } : {}),
        visibility: change.entry.visibility ?? previous?.visibility ?? 'public',
        active: true,
        createdAtRevision: previous?.createdAtRevision ?? revision,
        updatedAtRevision: revision,
      };
      continue;
    }
    const target = entries[change.key];
    if (!target) return { ok: false, code: 'unknown_key', message: `No existe la entrada «${change.key}».` };
    if (change.op === 'set-price') {
      if (target.kind !== 'product') return { ok: false, code: 'not_a_product', message: `«${target.title}» no es un producto.` };
      entries[change.key] = {
        ...target,
        priceCents: change.priceCents,
        ...(change.priceIncludesVat !== undefined ? { priceIncludesVat: change.priceIncludesVat } : {}),
        updatedAtRevision: revision,
      };
    } else if (change.op === 'retire') {
      entries[change.key] = { ...target, active: false, updatedAtRevision: revision };
    }
  }

  return { ok: true, value: { ...state, revision, defaultVatPercent, entries } };
}

/**
 * Aplica una propuesta YA aprobada. Sin referencia de aprobación no hay revisión (el módulo no decide
 * quién aprueba; el producto anfitrión aporta la prueba: p. ej. hash de decisión de autoridad).
 */
export function applyProposal(input: {
  state: KnowledgeState;
  proposal: KnowledgeProposal;
  approvalRef: string;
  approvedBy: string;
  now: Date;
}): ValidationResult<{ state: KnowledgeState; revision: KnowledgeRevision }> {
  if (!input.approvalRef.trim() || !input.approvedBy.trim()) {
    return { ok: false, code: 'missing_approval', message: 'No se aplica ningún cambio sin una aprobación registrada.' };
  }
  if (input.proposal.baseRevision !== input.state.revision) {
    return {
      ok: false,
      code: 'stale_base',
      message: 'El conocimiento cambió desde que se leyó la confirmación; hay que proponer el cambio de nuevo.',
    };
  }
  if (Date.parse(input.proposal.expiresAt) < input.now.getTime()) {
    return { ok: false, code: 'stale_base', message: 'La propuesta caducó; hay que proponer el cambio de nuevo.' };
  }
  const checked = validateChanges(input.proposal.changes);
  if (!checked.ok) return checked;

  const revisionNumber = input.state.revision + 1;
  const next = reduceChanges(input.state, checked.value, revisionNumber);
  if (!next.ok) return next;

  return {
    ok: true,
    value: {
      state: next.value,
      revision: {
        revision: revisionNumber,
        parentRevision: input.state.revision,
        at: input.now.toISOString(),
        changes: checked.value,
        proposalId: input.proposal.id,
        approvalRef: input.approvalRef.trim(),
        approvedBy: input.approvedBy.trim(),
        stateChecksum: stateChecksum(next.value),
        parentStateChecksum: stateChecksum(input.state),
      },
    },
  };
}

/** Reconstruye el estado desde las revisiones y comprueba la cadena de checksums. */
export function replayRevisions(revisions: readonly KnowledgeRevision[]): ValidationResult<KnowledgeState> {
  let state = emptyState();
  for (const revision of [...revisions].sort((a, b) => a.revision - b.revision)) {
    if (revision.parentRevision !== state.revision || revision.parentStateChecksum !== stateChecksum(state)) {
      return { ok: false, code: 'stale_base', message: `La cadena de revisiones se rompe en la ${revision.revision}.` };
    }
    const next = reduceChanges(state, revision.changes, revision.revision);
    if (!next.ok) return next;
    if (stateChecksum(next.value) !== revision.stateChecksum) {
      return { ok: false, code: 'stale_base', message: `El checksum de la revisión ${revision.revision} no coincide.` };
    }
    state = next.value;
  }
  return { ok: true, value: state };
}
