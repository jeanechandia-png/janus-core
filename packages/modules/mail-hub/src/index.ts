/**
 * mail-hub — correo unificado de varias cuentas (pieza LEGO, sin red y sin guardar contraseñas).
 * Varias cuentas por proveedor (p. ej. 3 Gmail + 2 iCloud). El anfitrión hace la conexión (IMAP/API)
 * con credenciales que viven fuera del código (variables de entorno / llavero), nunca en SQLite ni en el repo.
 * Ajustes verificados el 2026-10-22:
 *  - iCloud: https://support.apple.com/en-ie/HT202304 (IMAP imap.mail.me.com:993 SSL, contraseña específica de app)
 *  - Yahoo:  https://help.yahoo.com/kb/SLN4075.html (IMAP imap.mail.yahoo.com:993 SSL, contraseña de app)
 *  - Gmail:  se usa la API de Google con OAuth (adaptador Google Workspace de Janus), no contraseñas.
 */
export type Provider = 'icloud' | 'gmail' | 'yahoo' | 'outlook' | 'imap';
export type Scope = 'personal' | 'family' | 'business';

export interface ProviderPreset {
  id: Provider; name: string; icon: string;
  auth: 'app-password' | 'oauth' | 'password';
  imap?: { host: string; port: number; tls: true };
  smtp?: { host: string; port: number; security: 'starttls' | 'ssl' };
  username: 'local-part' | 'full-address';
  howTo: string; verified: string | 'por-confirmar';
}
export const PROVIDERS: Record<Provider, ProviderPreset> = {
  icloud: { id: 'icloud', name: 'iCloud Mail', icon: '', auth: 'app-password', imap: { host: 'imap.mail.me.com', port: 993, tls: true }, smtp: { host: 'smtp.mail.me.com', port: 587, security: 'starttls' }, username: 'local-part', howTo: 'appleid.apple.com → Inicio de sesión y seguridad → Contraseñas de apps → generar una para «Janus».', verified: 'support.apple.com/en-ie/HT202304 · 2026-10-22' },
  gmail: { id: 'gmail', name: 'Gmail', icon: 'G', auth: 'oauth', username: 'full-address', howTo: 'Conectar con Google (OAuth) desde Janus; cada cuenta se autoriza por separado.', verified: 'Adaptador Google Workspace de Janus' },
  yahoo: { id: 'yahoo', name: 'Yahoo Mail', icon: 'Y', auth: 'app-password', imap: { host: 'imap.mail.yahoo.com', port: 993, tls: true }, smtp: { host: 'smtp.mail.yahoo.com', port: 465, security: 'ssl' }, username: 'full-address', howTo: 'Seguridad de la cuenta Yahoo → Generar contraseña de app.', verified: 'help.yahoo.com/kb/SLN4075.html · 2026-10-22' },
  outlook: { id: 'outlook', name: 'Outlook / Hotmail', icon: 'O', auth: 'oauth', username: 'full-address', howTo: 'OAuth de Microsoft (por confirmar).', verified: 'por-confirmar' },
  imap: { id: 'imap', name: 'Otro (IMAP)', icon: '@', auth: 'password', username: 'full-address', howTo: 'Servidor, puerto y contraseña que indique el proveedor.', verified: 'por-confirmar' }
};

export interface MailAccount {
  id: string; provider: Provider; address: string; label: string; scope: Scope; color?: string;
  /** Nombre de la variable de entorno/llavero con la contraseña de app (nunca el valor). */
  secretRef?: string;
  imap?: { host: string; port: number; tls: boolean };
  status: 'pendiente' | 'conectada' | 'error'; addedAt: string;
}
export interface MailMessage { accountId: string; id: string; from: string; subject: string; date: string; unread: boolean; snippet?: string; hasAttachments?: boolean }

const norm = (s: string): string => s.trim().toLowerCase();
const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
export const accountId = (provider: Provider, address: string): string => provider + ':' + norm(address);
export const secretRefFor = (provider: Provider, address: string): string => 'MAIL_' + (provider + '_' + norm(address)).replace(/[^a-z0-9]/g, '_').toUpperCase() + '_APP_PASSWORD';

/** Añade una cuenta. Se permiten varias por proveedor; la misma dirección no se duplica. */
export function addAccount(list: MailAccount[], input: { provider: Provider; address: string; label?: string; scope?: Scope; imap?: MailAccount['imap'] }, now = new Date()): MailAccount {
  const address = norm(input.address);
  if (!isEmail(address)) throw new Error('Dirección de correo no válida');
  const id = accountId(input.provider, address);
  if (list.some((a) => a.id === id)) throw new Error('Esa cuenta ya está añadida');
  const preset = PROVIDERS[input.provider];
  if (input.provider === 'imap' && !input.imap) throw new Error('Falta el servidor IMAP');
  const same = list.filter((a) => a.provider === input.provider).length;
  const acc: MailAccount = {
    id, provider: input.provider, address, label: input.label?.trim() || preset.name + (same ? ' ' + (same + 1) : ''), scope: input.scope ?? 'personal',
    secretRef: preset.auth === 'oauth' ? undefined : secretRefFor(input.provider, address),
    imap: input.imap ?? (preset.imap ? { ...preset.imap } : undefined), status: 'pendiente', addedAt: now.toISOString()
  };
  list.push(acc);
  return acc;
}
export function removeAccount(list: MailAccount[], id: string): boolean { const i = list.findIndex((a) => a.id === id); if (i < 0) return false; list.splice(i, 1); return true; }

/** Configuración de conexión para el anfitrión. La contraseña se lee de su almacén seguro por referencia. */
export function connectionConfig(acc: MailAccount, readSecret: (ref: string) => string | undefined): { host: string; port: number; tls: boolean; user: string; pass: string } | { oauth: true; provider: Provider; address: string } | { missing: string } {
  const preset = PROVIDERS[acc.provider];
  if (preset.auth === 'oauth') return { oauth: true, provider: acc.provider, address: acc.address };
  const pass = acc.secretRef ? readSecret(acc.secretRef) : undefined;
  if (!pass) return { missing: acc.secretRef ?? 'secreto' };
  if (!acc.imap) return { missing: 'imap' };
  const user = preset.username === 'local-part' ? acc.address.split('@')[0] ?? acc.address : acc.address;
  return { host: acc.imap.host, port: acc.imap.port, tls: acc.imap.tls, user, pass };
}

/** Agrupación para el selector del dashboard: icono de correo → proveedores → cuentas (+ «Añadir cuenta»). */
export function pickerGroups(list: MailAccount[], unread: Record<string, number> = {}): Array<{ provider: Provider; name: string; accounts: Array<MailAccount & { unread: number }>; canAdd: true }> {
  const order: Provider[] = ['icloud', 'gmail', 'yahoo', 'outlook', 'imap'];
  return order.map((p) => ({ provider: p, name: PROVIDERS[p].name, accounts: list.filter((a) => a.provider === p).map((a) => ({ ...a, unread: unread[a.id] ?? 0 })), canAdd: true as const }))
    .filter((g) => g.accounts.length || g.provider === 'icloud' || g.provider === 'gmail');
}

/** Bandeja unificada ordenada por fecha, con filtro opcional por cuenta o proveedor. */
export function unifiedInbox(list: MailAccount[], messages: MailMessage[], filter: { accountId?: string; provider?: Provider } = {}): MailMessage[] {
  const ids = new Set(list.filter((a) => (!filter.accountId || a.id === filter.accountId) && (!filter.provider || a.provider === filter.provider)).map((a) => a.id));
  return messages.filter((m) => ids.has(m.accountId)).sort((a, b) => b.date.localeCompare(a.date));
}

const URGENT = /(urgente|urgent|factura|invoice|firma|sign|contrato|contract|vence|deadline|pago|payment|aanmaning|herinnering)/i;
/** Prioridad simple y explicable: remitentes importantes y palabras de urgencia. */
export function priorityOf(m: MailMessage, vip: string[] = []): { level: 1 | 2 | 3; why: string[] } {
  const why: string[] = [];
  if (vip.some((v) => norm(m.from).includes(norm(v)))) why.push('remitente importante');
  if (URGENT.test(m.subject)) why.push('palabra de urgencia');
  if (m.hasAttachments) why.push('adjunto');
  return { level: why.length >= 2 ? 3 : why.length === 1 ? 2 : 1, why };
}
