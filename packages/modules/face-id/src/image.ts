export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export type ImageKind = 'jpeg' | 'png' | 'webp';

/** Detects the container from magic bytes (never trusts a filename or header). */
export function detectImageKind(bytes: Uint8Array): ImageKind | undefined {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return undefined;
}

export function assertImage(bytes: Uint8Array, maxBytes = MAX_IMAGE_BYTES): ImageKind {
  if (bytes.byteLength === 0) throw new Error('Image is empty');
  if (bytes.byteLength > maxBytes) throw new Error(`Image is larger than ${maxBytes} bytes`);
  const kind = detectImageKind(bytes);
  if (!kind) throw new Error('Unsupported image format (use JPEG, PNG or WebP)');
  return kind;
}

export const MIME_BY_KIND: Record<ImageKind, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
