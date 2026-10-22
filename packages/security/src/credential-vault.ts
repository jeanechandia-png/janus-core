import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Credential vault — almacén local y cifrado de credenciales de servicios externos (tokens de acceso y de renovación).
 *
 * - AES-256-GCM con la llave que aporta el anfitrión (variable de entorno / almacén de secretos del sistema): nunca en el código,
 *   nunca en SQLite, nunca en el repositorio.
 * - Escritura atómica (archivo temporal + rename) con permisos 0600.
 * - Lecturas y escrituras serializadas: dos renovaciones simultáneas no se pisan.
 * - El contenido en claro no sale de aquí hacia registros, indicaciones ni respuestas HTTP: `describe()` devuelve solo metadatos.
 */
export type VaultCredentialKind = 'oauth-google' | 'long-lived-token';

export interface VaultCredential {
  service: string;
  kind: VaultCredentialKind;
  accessToken?: string;
  refreshToken?: string;
  /** Caducidad del token de acceso (ISO). Sin valor: se desconoce. */
  expiresAt?: string;
  requestedScopes?: string[];
  grantedScopes?: string[];
  /** Cuenta que concedió el permiso, comprobada al conectar. */
  accountEmail?: string;
  /** La renovación falló de forma definitiva (permiso revocado o caducado): hace falta un nuevo consentimiento. */
  needsReconsent?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Error de renovación o de consentimiento. `retryable` distingue un fallo transitorio (red, 5xx) de la pérdida definitiva del permiso. */
export class CredentialRefreshError extends Error {
  constructor(readonly code: string, message: string, readonly retryable = false) {
    super(message);
    this.name = 'CredentialRefreshError';
  }
}

type VaultPatchable = Omit<VaultCredential, 'service' | 'createdAt' | 'updatedAt'>;
export type VaultPatch = { [K in keyof VaultPatchable]?: VaultPatchable[K] | undefined };

export interface VaultCredentialDescription {
  service: string;
  kind: VaultCredentialKind;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  expiresAt?: string;
  grantedScopes: string[];
  missingScopes: string[];
  accountEmail?: string;
  needsReconsent: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VaultAuditEntry {
  at: string;
  event: 'stored' | 'refreshed' | 'refresh_failed' | 'reconsent_required' | 'removed';
  service: string;
}

interface VaultState {
  version: 1;
  credentials: Record<string, VaultCredential>;
  audit: VaultAuditEntry[];
}

/** Puerto de persistencia: el anfitrión decide dónde vive el bloque cifrado. */
export interface VaultStorage {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export class MemoryVaultStorage implements VaultStorage {
  private blob: Uint8Array | null = null;
  async load(): Promise<Uint8Array | null> { return this.blob ? new Uint8Array(this.blob) : null; }
  async save(bytes: Uint8Array): Promise<void> { this.blob = new Uint8Array(bytes); }
}

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

/** Acepta una llave de 32 bytes en base64 (normal o URL-safe) o en hexadecimal. */
export function parseCredentialVaultKey(value: string | undefined): Uint8Array {
  const text = value?.trim();
  if (!text) throw new Error('Credential vault key is required');
  const candidates: Uint8Array[] = [];
  if (/^[0-9a-fA-F]{64}$/.test(text)) candidates.push(new Uint8Array(Buffer.from(text, 'hex')));
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(text)) candidates.push(new Uint8Array(Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64')));
  const key = candidates.find((candidate) => candidate.byteLength === 32);
  if (!key) throw new Error('Credential vault key must be exactly 32 bytes (base64 or hex)');
  return key;
}

const AAD = Buffer.from('janus:credential-vault:v1');
const MAX_AUDIT = 500;

function emptyState(): VaultState {
  return { version: 1, credentials: {}, audit: [] };
}

export class CredentialVault {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly storage: VaultStorage,
    private readonly key: Uint8Array,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (key.byteLength !== 32) throw new Error('Credential vault key must be 32 bytes');
  }

  private async readState(): Promise<VaultState> {
    const blob = await this.storage.load();
    if (!blob) return emptyState();
    try {
      const envelope = JSON.parse(Buffer.from(blob).toString('utf8')) as { v?: number; iv?: string; tag?: string; ct?: string };
      if (envelope.v !== 1 || !envelope.iv || !envelope.tag || !envelope.ct) throw new Error('bad envelope');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(AAD);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(envelope.ct, 'base64')), decipher.final()]);
      const state = JSON.parse(plain.toString('utf8')) as VaultState;
      if (state.version !== 1 || typeof state.credentials !== 'object' || !Array.isArray(state.audit)) throw new Error('bad state');
      return state;
    } catch {
      // Mensaje deliberadamente genérico: no distingue llave equivocada de archivo manipulado ni revela contenido.
      throw new Error('Credential vault cannot be decrypted (wrong key or tampered file)');
    }
  }

  private async writeState(state: VaultState): Promise<void> {
    state.audit = state.audit.slice(-MAX_AUDIT);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(AAD);
    const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(state), 'utf8')), cipher.final()]);
    const envelope = { v: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ct: ct.toString('base64') };
    await this.storage.save(new Uint8Array(Buffer.from(JSON.stringify(envelope), 'utf8')));
  }

  /** Lectura-modificación-escritura serializada. */
  private mutate<T>(mutator: (state: VaultState) => T): Promise<T> {
    const run = async (): Promise<T> => {
      const state = await this.readState();
      const result = mutator(state);
      await this.writeState(state);
      return result;
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  async get(service: string): Promise<VaultCredential | null> {
    const state = await this.readState();
    const entry = state.credentials[service];
    return entry ? { ...entry } : null;
  }

  async put(credential: Omit<VaultCredential, 'createdAt' | 'updatedAt'> & { createdAt?: string }, event: VaultAuditEntry['event'] = 'stored'): Promise<void> {
    const at = this.now().toISOString();
    await this.mutate((state) => {
      const previous = state.credentials[credential.service];
      state.credentials[credential.service] = {
        ...credential,
        createdAt: credential.createdAt ?? previous?.createdAt ?? at,
        updatedAt: at,
      };
      state.audit.push({ at, event, service: credential.service });
    });
  }

  /** Actualiza campos de una credencial que ya existe; no la crea. Devuelve false si no existía. */
  async patch(service: string, changes: VaultPatch, event: VaultAuditEntry['event']): Promise<boolean> {
    const at = this.now().toISOString();
    return this.mutate((state) => {
      const current = state.credentials[service];
      if (!current) return false;
      const next: VaultCredential = { ...current, updatedAt: at };
      for (const [name, value] of Object.entries(changes)) {
        if (value === undefined) delete (next as unknown as Record<string, unknown>)[name];
        else (next as unknown as Record<string, unknown>)[name] = value;
      }
      state.credentials[service] = next;
      state.audit.push({ at, event, service });
      return true;
    });
  }

  async remove(service: string): Promise<boolean> {
    const at = this.now().toISOString();
    return this.mutate((state) => {
      if (!state.credentials[service]) return false;
      delete state.credentials[service];
      state.audit.push({ at, event: 'removed', service });
      return true;
    });
  }

  /** Solo metadatos: nunca devuelve un token. */
  async describe(service: string): Promise<VaultCredentialDescription | null> {
    const entry = await this.get(service);
    if (!entry) return null;
    const granted = new Set(entry.grantedScopes ?? []);
    return {
      service: entry.service,
      kind: entry.kind,
      hasAccessToken: Boolean(entry.accessToken),
      hasRefreshToken: Boolean(entry.refreshToken),
      ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
      grantedScopes: [...granted],
      missingScopes: (entry.requestedScopes ?? []).filter((scope) => !granted.has(scope)),
      ...(entry.accountEmail ? { accountEmail: entry.accountEmail } : {}),
      needsReconsent: entry.needsReconsent === true,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  /** Metadatos de todas las credenciales (sin secretos). */
  async describeAll(): Promise<VaultCredentialDescription[]> {
    const state = await this.readState();
    const result: VaultCredentialDescription[] = [];
    for (const service of Object.keys(state.credentials).sort()) {
      const description = await this.describe(service);
      if (description) result.push(description);
    }
    return result;
  }

  async auditTrail(): Promise<VaultAuditEntry[]> {
    return (await this.readState()).audit.map((entry) => ({ ...entry }));
  }
}
