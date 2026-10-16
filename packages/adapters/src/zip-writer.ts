/**
 * Minimal, dependency-free ZIP writer (STORE method, no compression, no ZIP64).
 * Used to build a static-site archive from a { path: content } map. Paths are validated
 * (no absolute paths, no "..", no backslashes, no control characters, no secrets-like names).
 */
export interface ZipEntry {
  path: string;
  content: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const SECRET_NAME = /(^|\/)(\.env(\..*)?|\.git(\/|$)|\.ssh(\/|$)|id_rsa|id_ed25519|\.npmrc|\.htpasswd)$|(^|\/)\.git\//i;

export function validateArchivePath(path: string): string | null {
  if (!path || path.length > 240) return 'ruta vacía o demasiado larga';
  if (path.startsWith('/') || path.includes('\\') || /[\u0000-\u001f]/.test(path)) return 'ruta absoluta, con barra invertida o con caracteres de control';
  if (path.split('/').some((part) => part === '..' || part === '.' || part === '')) return 'ruta con segmentos vacíos, "." o ".."';
  if (SECRET_NAME.test(path)) return 'nombre de archivo secreto o de control de versiones (.env, .git, claves)';
  return null;
}

export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const dosTime = 0x0000; // 00:00:00
  const dosDate = (46 << 9) | (1 << 5) | 1; // 2026-01-01
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.from(entry.content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, data);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(dosTime, 12);
    header.writeUInt16LE(dosDate, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += 30 + name.length + data.length;
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...chunks, ...central, end]));
}
