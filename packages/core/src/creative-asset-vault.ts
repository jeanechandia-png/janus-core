import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * InfinitySeed Group / JANUS — proveedor reemplazable, activo propio.
 * Importa bytes YA EXPORTADOS por el generador; nunca solicita créditos, ni
 * necesita Runway/ElevenLabs/Kling/Canva para reproducir contenido archivado.
 * No incluye clonación biométrica ni promete titularidad legal automáticamente.
 */
export type CreativeKind = 'video' | 'audio' | 'image' | 'model-3d';
export type CreativeReview = 'pending' | 'approved';
export interface AssetRights {
  commercialUse: boolean;
  offlineUseAfterCancellation: boolean;
  permissionToModify: boolean;
  evidenceUrl?: string;
  reviewBy?: string;
}
export interface CreativeAssetManifest {
  schemaVersion: 1;
  id: string;
  workspace: string;
  kind: CreativeKind;
  mime: string;
  provider: string;
  model?: string;
  providerTaskId?: string;
  sha256: string;
  bytes: number;
  filename: string;
  createdAt: string;
  state: CreativeReview;
  rights: AssetRights;
  /** Provider URLs are provenance only; local asset playback never reads them. */
  sourceUrl?: string;
}
export type CreativeImport = Pick<CreativeAssetManifest, 'workspace' | 'kind' | 'mime' | 'provider'> &
  Partial<Pick<CreativeAssetManifest, 'model' | 'providerTaskId' | 'sourceUrl' | 'rights'>> & {
    filename?: string;
  };

const MEDIA: Record<CreativeKind, Record<string, string>> = {
  video: { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' },
  audio: { 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/flac': '.flac' },
  image: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' },
  'model-3d': { 'model/gltf-binary': '.glb' },
};
const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_BYTES = 100 * 1024 * 1024;

const hasSignature = (kind: CreativeKind, mime: string, data: Buffer): boolean => {
  if (data.length < 12) return false;
  if (mime === 'model/gltf-binary') {
    return data.toString('ascii', 0, 4) === 'glTF' &&
      data.readUInt32LE(4) === 2 && data.readUInt32LE(8) === data.length;
  }
  if (mime === 'image/png') return data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg') return data[0] === 0xff && data[1] === 0xd8 && data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9;
  if (mime === 'image/webp') return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'video/mp4' || mime === 'video/quicktime') return data.toString('ascii', 4, 8) === 'ftyp';
  if (mime === 'video/webm') return data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === 'audio/wav') return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE';
  if (mime === 'audio/flac') return data.toString('ascii', 0, 4) === 'fLaC';
  if (mime === 'audio/mpeg') return data.toString('ascii', 0, 3) === 'ID3' || (data[0] === 0xff && (data[1]! & 0xe0) === 0xe0);
  return false;
};
function validateRef(name: string, value: string): string {
  if (!SAFE_ID.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}
function sanitizeRights(value: AssetRights | undefined): AssetRights {
  // Never invent commercial permission for a paid provider's output.
  return {
    commercialUse: value?.commercialUse === true,
    offlineUseAfterCancellation: value?.offlineUseAfterCancellation === true,
    permissionToModify: value?.permissionToModify === true,
    ...(typeof value?.evidenceUrl === 'string' && /^https:\/\//.test(value.evidenceUrl)
      ? { evidenceUrl: value.evidenceUrl.slice(0, 2000) } : {}),
    ...(typeof value?.reviewBy === 'string' && value.reviewBy.trim().length
      ? { reviewBy: value.reviewBy.trim().slice(0, 100) } : {}),
  };
}
function safeContentPath(root: string, workspace: string, id: string): string {
  const clean = validateRef('workspace', workspace);
  validateRef('id', id);
  return path.join(root, clean, id);
}
async function writeExclusive(filename: string, data: Uint8Array): Promise<void> {
  const fd = await open(filename, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  try {
    await fd.writeFile(data);
    await fd.sync();
  } finally {
    await fd.close();
  }
}
export class CreativeAssetVault {
  constructor(private readonly root: string) {}
  /**
   * Bytes-only input. Provider URLs never become dependencies: archive a copy.
   * ID is content addressed: duplicate downloads are harmless / idempotent.
   */
  async importBuffer(input: CreativeImport, bytes: Buffer): Promise<CreativeAssetManifest> {
    const workspace = validateRef('workspace', input.workspace);
    const provider = validateRef('provider', input.provider);
    const ext = MEDIA[input.kind]?.[input.mime];
    if (!ext) throw new Error('Unsupported creative media kind or MIME type');
    if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES || !hasSignature(input.kind, input.mime, bytes))
      throw new Error('Invalid, unsupported, or oversized local media file');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const id = hash; // SHA-256 is a safe content-addressed ID.
    const dest = safeContentPath(this.root, workspace, id);
    await mkdir(path.dirname(dest), { recursive: true, mode: 0o700 });
    // Stage in the same workspace, atomically rename only after full write.
    const tmp = path.join(path.dirname(dest), `.${id}.${process.pid}.${Math.random().toString(16).slice(2)}`);
    await mkdir(tmp, { mode: 0o700 });
    const filename = 'asset' + ext;
    const rights = sanitizeRights(input.rights);
    const manifest: CreativeAssetManifest = {
      schemaVersion: 1, id, workspace, kind: input.kind, mime: input.mime, provider,
      ...(input.model ? { model: String(input.model).slice(0, 100) } : {}),
      ...(input.providerTaskId ? { providerTaskId: String(input.providerTaskId).slice(0, 180) } : {}),
      ...(input.sourceUrl && /^https:\/\//.test(input.sourceUrl) ? { sourceUrl: input.sourceUrl.slice(0, 2000) } : {}),
      sha256: hash, bytes: bytes.length, filename, createdAt: new Date().toISOString(),
      state: 'pending', rights,
    };
    try {
      await writeExclusive(path.join(tmp, filename), bytes);
      await writeExclusive(path.join(tmp, 'manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
      try {
        await rename(tmp, dest);
      } catch (error: unknown) {
        const code = (error as NodeJS.ErrnoException).code;
        // Another import won the race; never overwrite its rights or metadata.
        if (code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error;
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
    return this.verify(workspace, id);
  }
  async verify(workspace: string, id: string): Promise<CreativeAssetManifest> {
    const location = safeContentPath(this.root, workspace, id);
    const manifest = JSON.parse(await readFile(path.join(location, 'manifest.json'), 'utf8')) as CreativeAssetManifest;
    if (manifest.schemaVersion !== 1 || manifest.workspace !== workspace || manifest.id !== id ||
      !SHA.test(manifest.sha256) || manifest.sha256 !== id ||
      MEDIA[manifest.kind]?.[manifest.mime] !== path.extname(manifest.filename) ||
      manifest.filename !== 'asset' + path.extname(manifest.filename)) {
      throw new Error('Invalid local asset manifest');
    }
    const f = path.join(location, manifest.filename);
    const info = await stat(f);
    if (!info.isFile() || info.size !== manifest.bytes || info.size > MAX_BYTES) throw new Error('Media size mismatch');
    const buffer = await readFile(f);
    if (createHash('sha256').update(buffer).digest('hex') !== manifest.sha256) throw new Error('Creative asset SHA-256 mismatch');
    return manifest;
  }
  /** An explicit human review is required before any public campaign. */
  async approve(workspace: string, id: string, reviewer: string, rightsEvidenceUrl: string): Promise<CreativeAssetManifest> {
    const m = await this.verify(workspace, id);
    if (!reviewer.trim() || reviewer.length > 120 || !/^https:\/\//.test(rightsEvidenceUrl))
      throw new Error('Reviewer and official rights evidence required');
    if (!m.rights.commercialUse || !m.rights.offlineUseAfterCancellation ||
      !m.rights.permissionToModify)
      throw new Error('Commercial, modification and offline use rights not confirmed');
    if (m.kind === 'model-3d')
      throw new Error('Final 3D must additionally pass JANUS visual and GLB rig approval gate');
    const updated: CreativeAssetManifest = {
      ...m, state: 'approved',
      rights: { ...m.rights, evidenceUrl: rightsEvidenceUrl, reviewBy: reviewer },
    };
    const dir = safeContentPath(this.root, workspace, id);
    const temp = path.join(dir, '.approval-' + process.pid + '-' + Math.random().toString(16).slice(2));
    try {
      await writeExclusive(temp, Buffer.from(JSON.stringify(updated, null, 2) + '\n'));
      await rename(temp, path.join(dir, 'manifest.json'));
    } finally {
      await rm(temp, { force: true });
    }
    return this.verify(workspace, id);
  }
  /** Playback references only local bytes; no provider token, URL or subscription. */
  async localPath(workspace: string, id: string): Promise<string> {
    const m = await this.verify(workspace, id);
    return path.join(safeContentPath(this.root, workspace, id), m.filename);
  }
  async canPublish(workspace: string, id: string): Promise<boolean> {
    const m = await this.verify(workspace, id);
    return m.state === 'approved' && m.rights.commercialUse &&
      m.rights.offlineUseAfterCancellation && m.rights.permissionToModify &&
      Boolean(m.rights.evidenceUrl && m.rights.reviewBy);
  }
}
