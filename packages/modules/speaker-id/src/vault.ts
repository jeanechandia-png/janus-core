import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { VaultState } from './types.js';

/** Persistence port: the host decides where the encrypted blob lives. */
export interface VaultStorage {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export class MemoryVaultStorage implements VaultStorage {
  private blob: Uint8Array | null = null;
  async load(): Promise<Uint8Array | null> { return this.blob ? new Uint8Array(this.blob) : null; }
  async save(bytes: Uint8Array): Promise<void> { this.blob = new Uint8Array(bytes); }
}

/** Atomic write (temp file + rename) with owner-only permissions. */
export class FileVaultStorage implements VaultStorage {
  constructor(private readonly path: string) {}

  async load(): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await readFile(this.path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(bytes: Uint8Array): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = `${this.path}.${process.pid}.tmp`;
    await writeFile(temp, bytes, { mode: 0o600 });
    await chmod(temp, 0o600);
    await rename(temp, this.path);
  }
}

/** Accepts a 32-byte key as base64 or hex. The key must come from the host's secret store, never from code. */
export function parseVaultKey(value: string | undefined): Uint8Array {
  const text = value?.trim();
  if (!text) throw new Error('Voiceprint vault key is required');
  const candidates: Uint8Array[] = [];
  if (/^[0-9a-fA-F]{64}$/.test(text)) candidates.push(new Uint8Array(Buffer.from(text, 'hex')));
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) candidates.push(new Uint8Array(Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
  const key = candidates.find((candidate) => candidate.byteLength === 32);
  if (!key) throw new Error('Voiceprint vault key must be exactly 32 bytes (base64 or hex)');
  return key;
}

const AAD = Buffer.from('speaker-id:vault:v1');

function emptyState(): VaultState {
  return { version: 1, subjects: {}, audit: [] };
}

/**
 * AES-256-GCM encrypted state. Voiceprints are biometric data: they are only ever at rest inside this envelope,
 * and the plaintext never reaches logs, prompts or a relational database.
 */
export class EncryptedVault {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly storage: VaultStorage, private readonly key: Uint8Array) {
    if (key.byteLength !== 32) throw new Error('Voiceprint vault key must be 32 bytes');
  }

  async read(): Promise<VaultState> {
    const blob = await this.storage.load();
    if (!blob) return emptyState();
    let envelope: { v?: number; iv?: string; tag?: string; ct?: string };
    try {
      envelope = JSON.parse(Buffer.from(blob).toString('utf8')) as typeof envelope;
      if (envelope.v !== 1 || !envelope.iv || !envelope.tag || !envelope.ct) throw new Error('bad envelope');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]);
      const state = JSON.parse(plain.toString('utf8')) as VaultState;
      if (state.version !== 1 || typeof state.subjects !== 'object') throw new Error('bad state');
      return state;
    } catch {
      throw new Error('Voiceprint vault cannot be decrypted (wrong key or tampered file)');
    }
  }

  /** Serialised read-modify-write so concurrent callers cannot lose updates. */
  update(mutator: (state: VaultState) => void): Promise<VaultState> {
    const run = async (): Promise<VaultState> => {
      const state = await this.read();
      mutator(state);
      state.audit = state.audit.slice(-500);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', this.key, iv);
      cipher.setAAD(AAD);
      const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(state), 'utf8')), cipher.final()]);
      const envelope = { v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
      await this.storage.save(new Uint8Array(Buffer.from(JSON.stringify(envelope), 'utf8')));
      return state;
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }
}
