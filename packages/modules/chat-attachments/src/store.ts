import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ATTACHMENT_PROFILES,
  MAX_INLINE_TEXT_CHARS,
  bytesMatchDeclaredType,
  checkFile,
  imageDimensions,
  type AttachmentProfileId,
  type AttachmentRef,
  type AttachmentSource,
} from './core.js';

/**
 * Almacén de adjuntos en disco (lado servidor). Local-first: bytes direccionados por SHA-256 en `<dir>/blobs/`
 * y metadatos por adjunto en `<dir>/meta/`. No guarda secretos ni usa red. Los metadatos que cuentan son los del
 * servidor (nombre saneado, tipo verificado por bytes), nunca los que afirma el cliente.
 */

export interface StoredAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  sha256: string;
  source: AttachmentSource;
  profile: AttachmentProfileId;
  principalId: string;
  createdAt: string;
  width?: number;
  height?: number;
}

export type StoreResult =
  | { ok: true; attachment: StoredAttachment; deduplicated: boolean }
  | { ok: false; status: 400 | 413 | 415 | 507; code: string; message: string };

export interface FileAttachmentStoreOptions {
  dir: string;
  /** Tope total de bytes en disco (la tablet tiene espacio limitado). Por defecto 500 MB. */
  maxTotalBytes?: number;
  now?: () => Date;
}

const ID_PATTERN = /^att_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TEXT_TYPES = new Set(['text/plain', 'text/csv', 'text/markdown', 'application/json']);

export function isAttachmentId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export class FileAttachmentStore {
  private readonly blobs: string;
  private readonly metas: string;
  private readonly maxTotalBytes: number;
  private readonly now: () => Date;

  constructor(options: FileAttachmentStoreOptions) {
    this.blobs = join(options.dir, 'blobs');
    this.metas = join(options.dir, 'meta');
    this.maxTotalBytes = options.maxTotalBytes ?? 500 * 1024 * 1024;
    this.now = options.now ?? (() => new Date());
    mkdirSync(this.blobs, { recursive: true, mode: 0o700 });
    mkdirSync(this.metas, { recursive: true, mode: 0o700 });
  }

  totalBytes(): number {
    let total = 0;
    for (const name of readdirSync(this.blobs)) {
      try { total += statSync(join(this.blobs, name)).size; } catch { /* retirado en paralelo */ }
    }
    return total;
  }

  put(input: {
    bytes: Uint8Array;
    claimedName: string;
    claimedType: string;
    source: AttachmentSource;
    profile: AttachmentProfileId;
    principalId: string;
    alreadyAttached?: number;
  }): StoreResult {
    const profile = ATTACHMENT_PROFILES[input.profile];
    if (!profile) return { ok: false, status: 400, code: 'profile_unknown', message: 'Perfil de adjuntos desconocido.' };
    const check = checkFile(
      { name: input.claimedName, type: input.claimedType, size: input.bytes.byteLength },
      profile,
      { alreadyAttached: input.alreadyAttached ?? 0, source: input.source },
    );
    if (!check.ok) {
      const status = check.code === 'too_big' ? 413 : check.code === 'type_not_allowed' || check.code === 'dangerous_extension' ? 415 : 400;
      return { ok: false, status, code: check.code, message: check.message };
    }
    if (!bytesMatchDeclaredType(input.bytes, check.type)) {
      return { ok: false, status: 415, code: 'content_mismatch', message: `El contenido de «${check.name}» no coincide con el tipo que declara; se rechaza por seguridad.` };
    }

    const sha256 = createHash('sha256').update(input.bytes).digest('hex');
    const blobPath = join(this.blobs, sha256);
    const deduplicated = existsSync(blobPath);
    if (!deduplicated) {
      if (this.totalBytes() + input.bytes.byteLength > this.maxTotalBytes) {
        return { ok: false, status: 507, code: 'storage_full', message: 'El almacén de adjuntos de Janus está lleno. Libera espacio antes de subir más.' };
      }
      const temp = `${blobPath}.${randomUUID()}.tmp`;
      writeFileSync(temp, input.bytes, { mode: 0o600 });
      renameSync(temp, blobPath);
    }

    const dimensions = check.type.startsWith('image/') ? imageDimensions(input.bytes) : null;
    const attachment: StoredAttachment = {
      id: `att_${randomUUID()}`,
      name: check.name,
      type: check.type,
      size: input.bytes.byteLength,
      sha256,
      source: input.source,
      profile: input.profile,
      principalId: input.principalId,
      createdAt: this.now().toISOString(),
      ...(dimensions ?? {}),
    };
    writeFileSync(join(this.metas, `${attachment.id}.json`), JSON.stringify(attachment), { mode: 0o600 });
    return { ok: true, attachment, deduplicated };
  }

  /** Metadatos de un adjunto, solo si pertenece a ese principal. */
  get(id: string, principalId: string): StoredAttachment | undefined {
    if (!isAttachmentId(id)) return undefined;
    const path = join(this.metas, `${id}.json`);
    if (!existsSync(path)) return undefined;
    try {
      const meta = JSON.parse(readFileSync(path, 'utf8')) as StoredAttachment;
      return meta.principalId === principalId ? meta : undefined;
    } catch {
      return undefined;
    }
  }

  readBytes(attachment: StoredAttachment): Uint8Array | undefined {
    if (!/^[0-9a-f]{64}$/.test(attachment.sha256)) return undefined;
    const path = join(this.blobs, attachment.sha256);
    if (!existsSync(path)) return undefined;
    const bytes = new Uint8Array(readFileSync(path));
    // Defensa en profundidad: el contenido en disco debe seguir coincidiendo con su huella.
    return createHash('sha256').update(bytes).digest('hex') === attachment.sha256 ? bytes : undefined;
  }

  /** Referencias para el mensaje, construidas SOLO con datos del servidor (el texto de archivos de texto, acotado). */
  refsFor(ids: readonly string[], principalId: string): { refs: AttachmentRef[]; missing: string[] } {
    const refs: AttachmentRef[] = [];
    const missing: string[] = [];
    for (const id of ids) {
      const meta = this.get(id, principalId);
      if (!meta) { missing.push(id); continue; }
      let textPreview: string | undefined;
      if (TEXT_TYPES.has(meta.type) && meta.size <= MAX_INLINE_TEXT_CHARS * 4) {
        const bytes = this.readBytes(meta);
        if (bytes) textPreview = new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, MAX_INLINE_TEXT_CHARS);
      }
      refs.push({ id: meta.id, name: meta.name, type: meta.type, size: meta.size, source: meta.source, sha256: meta.sha256, ...(textPreview ? { textPreview } : {}) });
    }
    return { refs, missing };
  }
}
