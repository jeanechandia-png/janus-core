import { createHash } from 'node:crypto';
import { inspectForgeGlb, makeForgeReceipt } from '../../packages/modules/janus-3d-forge/src/index.js';

export type Document = Record<string, unknown>;
/** GLB sintético de PRUEBA (no es arte aprobado): malla real mínima con bytes BIN válidos. */
export function glb(doc: Document): Uint8Array {
  const copy = JSON.parse(JSON.stringify(doc)) as Document;
  const accessors = (copy.accessors ?? []) as Array<{ count?: number; bufferView?: number; componentType?: number; type?: string }>;
  let byteCount = 0;
  const views: Array<{ buffer: number; byteOffset: number; byteLength: number }> = [];
  for (let i = 0; i < accessors.length; i++) {
    const acc = accessors[i]!;
    acc.bufferView = i;
    acc.componentType = i === 0 ? 5126 : 5125;
    acc.type = i === 0 ? 'VEC3' : 'SCALAR';
    const length = (acc.count ?? 0) * (i === 0 ? 12 : 4);
    views.push({ buffer: 0, byteOffset: byteCount, byteLength: length });
    byteCount += length;
  }
  byteCount = Math.max(12, Math.ceil(byteCount / 4) * 4);
  copy.bufferViews = views;
  copy.buffers = [{ byteLength: byteCount }];
  const json = Buffer.from(JSON.stringify(copy), 'utf8');
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const out = Buffer.alloc(28 + jsonLength + byteCount, 0);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonLength, 12); out.writeUInt32LE(0x4e4f534a, 16);
  out.fill(0x20, 20, 20 + jsonLength); json.copy(out, 20);
  out.writeUInt32LE(byteCount, 20 + jsonLength); out.writeUInt32LE(0x004e4942, 24 + jsonLength);
  return out;
}
export const doc = (tag: string, count = 300): Document => ({
  asset: { version: '2.0', generator: tag },
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] }],
  accessors: [{ count }, { count }],
  nodes: [{ name: 'mesh', mesh: 0 }],
  scenes: [{ nodes: [0] }], scene: 0,
});
export const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
/** Inspector real de 3D Forge, tal y como lo inyecta el servidor. */
export const inspector = { inspect: inspectForgeGlb, receipt: makeForgeReceipt };
