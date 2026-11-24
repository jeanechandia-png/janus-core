import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * JANUS character-library: biblioteca central de modelos 3D de los seis personajes.
 * Sin red. El anfitrión decide la carpeta privada, la autenticación y las rutas HTTP.
 * La aprobación visual es SIEMPRE del Founder; una subida nueva nunca nace aprobada.
 */
export const CHARACTER_SLOTS = [
  'lumi', 'bombo', 'musgo', 'nimbo', 'nexo-masculino', 'nexo-femenino',
] as const;
export type CharacterSlot = typeof CHARACTER_SLOTS[number];
export const CHARACTER_ORIGINS = ['hyper3d-rodin', 'janus-trellis2-local', 'manual-local'] as const;
export type CharacterOrigin = typeof CHARACTER_ORIGINS[number];
/** Mismo tope que el hueco 3D de la PWA (15 MB); una prueba del repositorio comprueba que no se desincronice de 3D Forge. */
export const CHARACTER_UPLOAD_LIMIT = 15 * 1024 * 1024;

/** Lo mínimo que la biblioteca necesita de un inspector de GLB. El anfitrión inyecta el inspector de 3D Forge. */
export interface ModelInspection {
  valid: boolean;
  blocked: string[];
  warnings: string[];
  bytes: number;
  triangles: number;
  skinned: boolean;
  sourceSha256: string;
  missing: { bones: string[]; clips: string[] };
}
export interface ModelInspector {
  inspect(bytes: Uint8Array): ModelInspection;
  receipt(bytes: Uint8Array, input: {
    slot: CharacterSlot; origin: CharacterOrigin; sourceSha256: string;
    rightsStatus: 'pending_review' | 'reviewed'; rightsEvidence?: string; pilotUseUntil?: string;
  }, at: Date): unknown;
}

export type CharacterTier = 'full' | 'partial';
export type CharacterReview = 'pending_visual_review' | 'approved' | 'rejected';

export interface CharacterEntry {
  slot: CharacterSlot;
  sha256: string;
  bytes: number;
  triangles: number;
  /** full = esqueleto + animaciones del contrato; partial = malla válida sin rig completo. */
  tier: CharacterTier;
  review: CharacterReview;
  origin: CharacterOrigin;
  uploadedAt: string;
  reviewedAt?: string;
  warnings: string[];
}
export interface CharacterOverview {
  slot: CharacterSlot;
  /** Versión que ve el Founder (la última subida, o la que él active). */
  active?: CharacterEntry;
  /** Versión aprobada que se sirve a superficies de menores. */
  servable?: CharacterEntry;
  versions: number;
}
export interface KidCharacter {
  slot: CharacterSlot;
  sha256: string;
  bytes: number;
  tier: CharacterTier;
}
export interface AdmitInput {
  slot: string;
  bytes: Uint8Array;
  origin?: string;
  rightsEvidence?: string;
  pilotUseUntil?: string;
}
export type AdmitResult =
  | { ok: true; entry: CharacterEntry; duplicate: boolean }
  | { ok: false; code: 'unknown_slot' | 'unknown_origin' | 'too_large' | 'invalid_model' | 'invalid_request'; message: string; blocked: string[] };

interface SlotState { active?: string; entries: CharacterEntry[] }
interface IndexFile { schemaVersion: 1; slots: Partial<Record<CharacterSlot, SlotState>> }

const SHA = /^[a-f0-9]{64}$/;
const INDEX_FILE = 'library-index.json';
const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export function isCharacterSlot(value: unknown): value is CharacterSlot {
  return typeof value === 'string' && (CHARACTER_SLOTS as readonly string[]).includes(value);
}
export function isCharacterOrigin(value: unknown): value is CharacterOrigin {
  return typeof value === 'string' && (CHARACTER_ORIGINS as readonly string[]).includes(value);
}
const copy = (entry: CharacterEntry): CharacterEntry => ({ ...entry, warnings: [...entry.warnings] });
const fail = (
  code: Extract<AdmitResult, { ok: false }>['code'], message: string, blocked: string[] = [],
): AdmitResult => ({ ok: false, code, message, blocked });

export class CharacterLibrary {
  private readonly root: string;
  private readonly now: () => Date;
  private readonly inspector: ModelInspector;
  private state: IndexFile;

  constructor(root: string, options: { inspector: ModelInspector; repositoryRoot?: string; now?: () => Date }) {
    const resolved = resolve(root);
    if (options.repositoryRoot) {
      const repo = resolve(options.repositoryRoot);
      if (resolved === repo || resolved.startsWith(repo + sep)) {
        throw new Error('Refusing to store private 3D assets inside the public JANUS repository');
      }
    }
    this.root = resolved;
    this.inspector = options.inspector;
    this.now = options.now ?? (() => new Date());
    mkdirSync(this.root, { recursive: true, mode: 0o700 });
    this.state = this.load();
  }

  admit(input: AdmitInput): AdmitResult {
    if (!isCharacterSlot(input.slot)) return fail('unknown_slot', 'Personaje no autorizado: ' + String(input.slot).slice(0, 40));
    const slot = input.slot;
    const origin = input.origin ?? 'manual-local';
    if (!isCharacterOrigin(origin)) return fail('unknown_origin', 'Origen de generación no reconocido.');
    const bytes = input.bytes;
    if (bytes.byteLength > CHARACTER_UPLOAD_LIMIT) return fail('too_large', 'El modelo supera 15 MB.');
    const inspection = this.inspector.inspect(bytes);
    if (!inspection.valid) return fail('invalid_model', 'Modelo rechazado: ' + inspection.blocked.join('; '), inspection.blocked);
    const sha = inspection.sourceSha256;
    const state = this.slotState(slot);
    const existing = state.entries.find((entry) => entry.sha256 === sha);
    if (existing) return { ok: true, entry: copy(existing), duplicate: true };

    const at = this.now();
    let receipt;
    try {
      receipt = this.inspector.receipt(bytes, {
        slot, origin, sourceSha256: sha,
        rightsStatus: input.rightsEvidence?.trim() ? 'reviewed' : 'pending_review',
        ...(input.rightsEvidence?.trim() ? { rightsEvidence: input.rightsEvidence } : {}),
        ...(input.pilotUseUntil ? { pilotUseUntil: input.pilotUseUntil } : {}),
      }, at);
    } catch (error) {
      return fail('invalid_request', error instanceof Error ? error.message : 'Solicitud no válida.');
    }
    const folder = join(this.root, slot);
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    this.writeOnce(join(folder, sha + '.glb'), bytes, sha);
    this.writeOnce(join(folder, sha + '.receipt.json'), Buffer.from(JSON.stringify(receipt, null, 2) + '\n'));

    const entry: CharacterEntry = {
      slot, sha256: sha, bytes: inspection.bytes, triangles: inspection.triangles,
      tier: tierOf(inspection), review: 'pending_visual_review', origin,
      uploadedAt: at.toISOString(), warnings: inspection.warnings,
    };
    state.entries.push(entry);
    state.active = sha;
    this.save();
    return { ok: true, entry: copy(entry), duplicate: false };
  }

  /** Incorpora los GLB que dejó `npm run forge:prepare` en la misma carpeta privada. */
  adoptStaged(): number {
    let adopted = 0;
    for (const slot of CHARACTER_SLOTS) {
      const folder = join(this.root, slot);
      if (!existsSync(folder)) continue;
      for (const name of readdirSync(folder)) {
        const match = /^([a-f0-9]{64})\.glb$/.exec(name);
        if (!match) continue;
        const sha = match[1]!;
        const state = this.slotState(slot);
        if (state.entries.some((entry) => entry.sha256 === sha)) continue;
        const bytes = readFileSync(join(folder, name));
        if (sha256Of(bytes) !== sha) continue;
        const inspection = this.inspector.inspect(bytes);
        if (!inspection.valid) continue;
        let origin: CharacterOrigin = 'manual-local';
        let uploadedAt = this.now().toISOString();
        try {
          const receipt = JSON.parse(readFileSync(join(folder, sha + '.receipt.json'), 'utf8')) as { origin?: unknown; createdAt?: unknown };
          if (isCharacterOrigin(receipt.origin)) origin = receipt.origin;
          if (typeof receipt.createdAt === 'string') uploadedAt = receipt.createdAt;
        } catch { /* sin recibo: se trata como local y pendiente */ }
        state.entries.push({
          slot, sha256: sha, bytes: inspection.bytes, triangles: inspection.triangles,
          tier: tierOf(inspection), review: 'pending_visual_review', origin, uploadedAt, warnings: inspection.warnings,
        });
        state.active ??= sha;
        adopted++;
      }
    }
    if (adopted) this.save();
    return adopted;
  }

  overview(): CharacterOverview[] {
    return CHARACTER_SLOTS.map((slot) => {
      const active = this.activeEntry(slot);
      const servable = this.servableEntry(slot);
      return {
        slot,
        ...(active ? { active: copy(active) } : {}),
        ...(servable ? { servable: copy(servable) } : {}),
        versions: this.state.slots[slot]?.entries.length ?? 0,
      };
    });
  }

  /** Para superficies de menores: solo modelos aprobados por el Founder. */
  kidOverview(): KidCharacter[] {
    const out: KidCharacter[] = [];
    for (const slot of CHARACTER_SLOTS) {
      const entry = this.servableEntry(slot);
      if (entry) out.push({ slot, sha256: entry.sha256, bytes: entry.bytes, tier: entry.tier });
    }
    return out;
  }

  /** Devuelve los bytes verificando la huella; `undefined` si no existe o está alterado. */
  bytes(slot: string, sha256: string): Buffer | undefined {
    if (!isCharacterSlot(slot) || !SHA.test(sha256)) return undefined;
    if (!this.state.slots[slot]?.entries.some((entry) => entry.sha256 === sha256)) return undefined;
    try {
      const data = readFileSync(join(this.root, slot, sha256 + '.glb'));
      return sha256Of(data) === sha256 ? data : undefined;
    } catch { return undefined; }
  }

  servable(slot: string): CharacterEntry | undefined {
    if (!isCharacterSlot(slot)) return undefined;
    const entry = this.servableEntry(slot);
    return entry ? copy(entry) : undefined;
  }

  review(slot: string, sha256: string, decision: 'approved' | 'rejected'): CharacterEntry | undefined {
    if (!isCharacterSlot(slot) || !SHA.test(sha256)) return undefined;
    if (decision !== 'approved' && decision !== 'rejected') return undefined;
    const state = this.state.slots[slot];
    const entry = state?.entries.find((item) => item.sha256 === sha256);
    if (!state || !entry) return undefined;
    entry.review = decision;
    entry.reviewedAt = this.now().toISOString();
    if (decision === 'rejected' && state.active === sha256) {
      const fallback = [...state.entries]
        .filter((item) => item.review !== 'rejected')
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
      if (fallback) state.active = fallback.sha256; else delete state.active;
    }
    this.save();
    return copy(entry);
  }

  activate(slot: string, sha256: string): CharacterEntry | undefined {
    if (!isCharacterSlot(slot) || !SHA.test(sha256)) return undefined;
    const state = this.state.slots[slot];
    const entry = state?.entries.find((item) => item.sha256 === sha256);
    if (!state || !entry || entry.review === 'rejected') return undefined;
    state.active = sha256;
    this.save();
    return copy(entry);
  }

  // ── interno ───────────────────────────────────────────────────────────────
  private slotState(slot: CharacterSlot): SlotState {
    return (this.state.slots[slot] ??= { entries: [] });
  }
  private activeEntry(slot: CharacterSlot): CharacterEntry | undefined {
    const state = this.state.slots[slot];
    return state?.entries.find((entry) => entry.sha256 === state.active);
  }
  private servableEntry(slot: CharacterSlot): CharacterEntry | undefined {
    const active = this.activeEntry(slot);
    if (active?.review === 'approved') return active;
    return [...(this.state.slots[slot]?.entries ?? [])]
      .filter((entry) => entry.review === 'approved')
      .sort((a, b) => (b.reviewedAt ?? '').localeCompare(a.reviewedAt ?? ''))[0];
  }
  private writeOnce(path: string, data: Uint8Array, expectedSha?: string): void {
    try {
      writeFileSync(path, data, { flag: 'wx', mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (expectedSha && sha256Of(readFileSync(path)) !== expectedSha) {
        throw new Error('Existing staged asset has an unexpected checksum');
      }
      // Recibo existente: inmutable, nunca se reescribe.
    }
  }
  private load(): IndexFile {
    const path = join(this.root, INDEX_FILE);
    if (!existsSync(path)) return this.rebuilt();
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as IndexFile;
      if (parsed?.schemaVersion !== 1 || typeof parsed.slots !== 'object' || parsed.slots === null) throw new Error('schema');
      const clean: IndexFile = { schemaVersion: 1, slots: {} };
      for (const slot of CHARACTER_SLOTS) {
        const raw = parsed.slots[slot];
        if (!raw || !Array.isArray(raw.entries)) continue;
        const entries = raw.entries.filter((entry) => entry && entry.slot === slot && SHA.test(entry.sha256)
          && existsSync(join(this.root, slot, entry.sha256 + '.glb')));
        const active = entries.some((entry) => entry.sha256 === raw.active) ? raw.active : entries.at(-1)?.sha256;
        clean.slots[slot] = { entries, ...(active ? { active } : {}) };
      }
      return clean;
    } catch {
      // Índice dañado: se aparta (no se borra) y se reconstruye desde los GLB; la revisión vuelve a «pendiente».
      try { renameSync(path, path + '.corrupt-' + Date.now()); } catch { /* sin permisos: se ignora */ }
      return this.rebuilt();
    }
  }
  private rebuilt(): IndexFile {
    this.state = { schemaVersion: 1, slots: {} };
    this.adoptStaged();
    return this.state;
  }
  private save(): void {
    const path = join(this.root, INDEX_FILE);
    const tmp = path + '.tmp-' + process.pid;
    writeFileSync(tmp, JSON.stringify(this.state, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, path);
  }
}

function tierOf(inspection: ModelInspection): CharacterTier {
  return inspection.skinned && inspection.missing.bones.length === 0 && inspection.missing.clips.length === 0 ? 'full' : 'partial';
}
