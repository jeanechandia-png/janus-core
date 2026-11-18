import { createHash } from 'node:crypto';

/**
 * JANUS 3D Forge: local, provider-neutral intake and reproducible provenance.
 * Pure module: no network, GPU access, uploads, publication or model training.
 * Existing PWA JanusCreatureSlot remains the final visual/rig quality gate.
 */
export const FORGE_SLOTS = [
  'lumi', 'bombo', 'musgo', 'nimbo', 'nexo-masculino', 'nexo-femenino',
] as const;
export type ForgeSlot = typeof FORGE_SLOTS[number];
export type ForgeOrigin = 'hyper3d-rodin' | 'janus-trellis2-local' | 'manual-local';
export const FORGE_GLB_MAX_BYTES = 15 * 1024 * 1024;
export const FORGE_MAX_TRIANGLES = 300_000;
export const FORGE_RECOMMENDED_TRIANGLES = 80_000;
export const FORGE_REQUIRED_BONES = [
  'root', 'hips', 'spine', 'chest', 'neck', 'head', 'jaw',
  'eye_L', 'eye_R', 'hand_L', 'hand_R', 'foot_L', 'foot_R',
] as const;
export const FORGE_REQUIRED_MORPHS = [
  'alegre', 'contento', 'triste', 'enojado', 'sorprendido',
  'blink_L', 'blink_R', 'mouth_open',
] as const;
export const FORGE_REQUIRED_CLIPS = ['idle', 'saluda', 'celebra', 'piensa', 'camina', 'habla'] as const;
export const FORGE_REQUIRED_SOCKETS = [
  'sock_head', 'sock_face', 'sock_ears', 'sock_neck', 'sock_back',
  'sock_torso', 'sock_hand_L', 'sock_hand_R', 'sock_foot_L', 'sock_foot_R',
] as const;

interface GltfAccessor { count?: unknown }
interface GltfPrimitive { attributes?: { POSITION?: unknown }; indices?: unknown; mode?: unknown; targets?: Array<Record<string, unknown>>; extensions?: Record<string, unknown> }
interface GltfMesh { primitives?: GltfPrimitive[]; extras?: { targetNames?: string[] } }
interface GltfNode { name?: string; mesh?: number; skin?: number; children?: number[] }
interface GltfDocument {
  asset?: { version?: string };
  meshes?: GltfMesh[];
  nodes?: GltfNode[];
  accessors?: GltfAccessor[];
  skins?: Array<{ joints?: number[] }>;
  animations?: Array<{ name?: string }>;
  textures?: unknown[];
  images?: unknown[];
  extensionsRequired?: string[];
}

export interface ForgeInspection {
  valid: boolean;
  blocked: string[];
  warnings: string[];
  bytes: number;
  triangles: number;
  meshes: number;
  skinned: boolean;
  sourceSha256: string;
  missing: { bones: string[]; morphs: string[]; clips: string[]; sockets: string[] };
}
export interface ForgeIntake {
  slot: ForgeSlot;
  origin: ForgeOrigin;
  sourceSha256: string;
  referenceSha256?: string;
  rightsStatus: 'pending_review' | 'reviewed';
  rightsEvidence?: string;
  /** Temporary project decision, not hardcoded into the reusable generator. */
  pilotUseUntil?: string;
}
export interface ForgeReceipt {
  schemaVersion: 1;
  slot: ForgeSlot;
  origin: ForgeOrigin;
  sourceSha256: string;
  referenceSha256?: string;
  createdAt: string;
  pilotUseUntil?: string;
  rightsStatus: ForgeIntake['rightsStatus'];
  rightsEvidence?: string;
  status: 'rejected' | 'preview_only';
  blocked: string[];
  warnings: string[];
  triangles: number;
  bytes: number;
  trainingAllowedFromThisAsset: false;
  nextGate: 'fix_and_reinspect' | 'pwa_contract_and_human_visual_review';
}
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function safeArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function nameSet(items: ReadonlyArray<{ name?: string }>): Set<string> {
  return new Set(items.map((n) => n.name).filter((n): n is string => typeof n === 'string'));
}
function missing(required: readonly string[], present: ReadonlySet<string>): string[] {
  return required.filter((name) => !present.has(name));
}
function readGltf(bytes: Uint8Array): GltfDocument {
  if (bytes.byteLength < 20) throw new Error('GLB truncated');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a binary glTF/GLB');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB version must be 2');
  if (view.getUint32(8, true) !== bytes.byteLength) throw new Error('GLB declared length mismatch');
  const chunkLength = view.getUint32(12, true);
  if (chunkLength < 4 || chunkLength % 4 !== 0 || chunkLength > bytes.byteLength - 20) {
    throw new Error('Invalid JSON chunk length');
  }
  if (view.getUint32(16, true) !== 0x4e4f534a) throw new Error('First GLB chunk is not JSON');
  const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + chunkLength)).trim();
  const doc: unknown = JSON.parse(json);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('GLB JSON must be an object');
  return doc as GltfDocument;
}

export function inspectForgeGlb(bytes: Uint8Array): ForgeInspection {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const result: ForgeInspection = {
    valid: false, blocked, warnings, bytes: bytes.byteLength,
    triangles: 0, meshes: 0, skinned: false, sourceSha256: sha256(bytes),
    missing: { bones: [], morphs: [], clips: [], sockets: [] },
  };
  if (bytes.byteLength > FORGE_GLB_MAX_BYTES) blocked.push('GLB exceeds existing PWA 15 MB limit');
  let doc: GltfDocument;
  try { doc = readGltf(bytes); }
  catch (error) {
    blocked.push(error instanceof Error ? error.message : 'Invalid GLB');
    return result;
  }
  if (doc.asset?.version !== '2.0') blocked.push('Only glTF 2.0 assets are accepted');
  const prohibited = ['KHR_draco_mesh_compression', 'KHR_texture_basisu'];
  for (const extension of safeArray(doc.extensionsRequired)) {
    if (typeof extension === 'string' && prohibited.includes(extension)) {
      blocked.push('Unsupported by PWA GLTF loader: ' + extension);
    }
  }
  const accessorCount = (idx: unknown): number => {
    if (!Number.isInteger(idx) || typeof idx !== 'number') return 0;
    const count = safeArray(doc.accessors)[idx] as GltfAccessor | undefined;
    return Number.isSafeInteger(count?.count) && (count?.count as number) >= 0 ? count!.count as number : 0;
  };
  const meshes = safeArray(doc.meshes) as GltfMesh[];
  const morphs = new Set<string>();
  for (const mesh of meshes) {
    for (const name of safeArray(mesh.extras?.targetNames)) {
      if (typeof name === 'string') morphs.add(name);
    }
    for (const primitive of safeArray(mesh.primitives) as GltfPrimitive[]) {
      if (primitive.extensions?.KHR_draco_mesh_compression) blocked.push('Draco-compressed mesh unsupported');
      if (!primitive.attributes || !Number.isInteger(primitive.attributes.POSITION)) {
        blocked.push('Mesh primitive lacks POSITION accessor');
        continue;
      }
      result.meshes++;
      const count = primitive.indices === undefined
        ? accessorCount(primitive.attributes.POSITION)
        : accessorCount(primitive.indices);
      const mode = primitive.mode === undefined ? 4 : primitive.mode;
      if (mode === 4) result.triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) result.triangles += Math.max(0, count - 2);
      else warnings.push('Non-triangle primitive may not render correctly');
      if (primitive.targets?.length && morphs.size === 0) warnings.push('Morph targets lack named semantics');
    }
  }
  if (result.meshes === 0) blocked.push('No usable 3D mesh');
  if (result.triangles > FORGE_MAX_TRIANGLES) blocked.push('GLB exceeds PWA triangle hard limit');
  else if (result.triangles > FORGE_RECOMMENDED_TRIANGLES) warnings.push('Triangle count exceeds iPhone recommended budget');
  const nodes = safeArray(doc.nodes) as GltfNode[];
  const nodesByName = nameSet(nodes);
  const skinJoints = new Set<number>();
  for (const skin of safeArray(doc.skins) as Array<{ joints?: number[] }>) {
    for (const index of safeArray(skin.joints)) if (Number.isInteger(index)) skinJoints.add(index as number);
  }
  const skinNames = new Set([...skinJoints].map((i) => nodes[i]?.name).filter((s): s is string => !!s));
  result.skinned = skinJoints.size > 0 && nodes.some((node) => Number.isInteger(node.skin));
  result.missing = {
    bones: missing(FORGE_REQUIRED_BONES, skinNames),
    morphs: missing(FORGE_REQUIRED_MORPHS, morphs),
    clips: missing(FORGE_REQUIRED_CLIPS, nameSet(safeArray(doc.animations) as Array<{ name?: string }>)),
    sockets: missing(FORGE_REQUIRED_SOCKETS, nodesByName),
  };
  if (!result.skinned) warnings.push('No animated skinned skeleton; static preview only');
  for (const [kind, names] of Object.entries(result.missing)) {
    if (names.length) warnings.push(kind + ': ' + names.join(', '));
  }
  if (skinJoints.size > 80) warnings.push('More than 80 rig bones');
  if (safeArray(doc.textures).length > 16) warnings.push('More than 16 textures');
  result.valid = blocked.length === 0;
  return result;
}

export function makeForgeReceipt(
  bytes: Uint8Array, input: ForgeIntake, at: Date = new Date(),
): ForgeReceipt {
  if (!FORGE_SLOTS.includes(input.slot)) throw new Error('Unknown approved character slot');
  if (!['hyper3d-rodin', 'janus-trellis2-local', 'manual-local'].includes(input.origin)) {
    throw new Error('Unknown generation origin');
  }
  if (!/^[a-f0-9]{64}$/i.test(input.sourceSha256)) throw new Error('Source hash must be SHA-256');
  if (input.referenceSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(input.referenceSha256)) {
    throw new Error('Reference hash must be SHA-256');
  }
  if (!['pending_review', 'reviewed'].includes(input.rightsStatus)) throw new Error('Invalid rights status');
  if (input.rightsStatus === 'reviewed' && !input.rightsEvidence?.trim()) {
    throw new Error('Rights review requires traceable evidence');
  }
  if (input.pilotUseUntil !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.pilotUseUntil)) {
    throw new Error('pilotUseUntil must be YYYY-MM-DD');
  }
  const inspection = inspectForgeGlb(bytes);
  if (input.sourceSha256.toLowerCase() !== inspection.sourceSha256) throw new Error('GLB SHA-256 does not match expected content');
  return {
    schemaVersion: 1, slot: input.slot, origin: input.origin,
    sourceSha256: inspection.sourceSha256,
    ...(input.referenceSha256 ? { referenceSha256: input.referenceSha256.toLowerCase() } : {}),
    createdAt: at.toISOString(),
    ...(input.pilotUseUntil ? { pilotUseUntil: input.pilotUseUntil } : {}),
    rightsStatus: input.rightsStatus,
    ...(input.rightsEvidence ? { rightsEvidence: input.rightsEvidence.trim().slice(0, 500) } : {}),
    status: inspection.valid ? 'preview_only' : 'rejected',
    blocked: inspection.blocked,
    warnings: inspection.warnings,
    triangles: inspection.triangles,
    bytes: inspection.bytes,
    // Never train on a vendor output or an asset of unverified provenance.
    trainingAllowedFromThisAsset: false,
    nextGate: inspection.valid ? 'pwa_contract_and_human_visual_review' : 'fix_and_reinspect',
  };
}
