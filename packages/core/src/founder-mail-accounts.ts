import type { FounderReferenceLibraryDocument } from './founder-reference-library.js';

/**
 * Founder mail accounts — buzones del Founder que Janus puede leer y preparar BAJO SU SUPERVISIÓN.
 *
 * Los buzones son datos personales: viven en la capa LOCAL de la biblioteca de referencias
 * (`config/founder-reference-library.local.json`, ignorada por git), nunca en el repositorio público.
 * Un buzón es un registro `kind: "reference"` con la etiqueta `mail`, `value` = dirección y, opcionalmente,
 * `scope:personal | scope:business | scope:family` y `minor`.
 *
 * Este módulo solo describe y planifica: no llama a nadie ni guarda credenciales.
 */
export type MailScope = 'personal' | 'business' | 'family' | 'unknown';
export type MailProvider = 'google' | 'unknown';

export interface FounderMailAccount {
  accountId: string;
  referenceId: string;
  label: string;
  address: string;
  domain: string;
  scope: MailScope;
  /** El ámbito lo dedujo Janus (etiqueta `scope-inferred`) y espera confirmación del Founder. */
  scopeInferred: boolean;
  /** Cuenta de un menor de edad: lectura mínima y solo para el Founder. */
  minor: boolean;
  /**
   * `google` solo cuando el dominio es de Gmail. Cualquier otro dominio (p. ej. un dominio propio) puede ser Google Workspace
   * o no: no se adivina, queda `unknown` hasta que el Founder lo confirme.
   */
  provider: MailProvider;
  /** Nombre del servicio en el CredentialBroker (una credencial por cuenta). */
  credentialService: string;
  permittedReadActions: string[];
  permittedDraftActions: string[];
}

export interface FounderMailPolicy {
  supervision: 'founder';
  readAllowed: true;
  /** Borradores: se crean, nunca se envían; cada uno exige aprobación (política de acciones sensibles). */
  draftsRequireFounderApproval: true;
  sendAllowed: false;
  deleteAllowed: false;
  archiveOrLabelAllowed: false;
  forwardAllowed: false;
  autoReplyAllowed: false;
  /** El contenido de un ámbito no se mezcla con otro; solo el Founder los ve juntos. */
  crossScopeSharing: 'founder-only';
  /** Las cuentas de menores: solo lectura y sin borradores. */
  minorAccounts: 'read-only-no-drafts';
  credentialPersistence: 'secure-provider-only';
}

export interface FounderMailAccountRegistry {
  schemaVersion: 1;
  ownerPrincipalId: string;
  sourceUpdatedAt: string;
  policy: FounderMailPolicy;
  accounts: FounderMailAccount[];
}

const ADDRESS = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const ACCOUNT_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const READ_ACTIONS = ['gmail.messages.search', 'calendar.events.list', 'drive.files.search'];
const DRAFT_ACTIONS = ['gmail.draft.create'];

export function buildFounderMailAccountRegistry(document: FounderReferenceLibraryDocument): FounderMailAccountRegistry {
  const seen = new Set<string>();
  const accounts: FounderMailAccount[] = [];
  for (const seed of document.records) {
    const tags = seed.tags ?? [];
    if (seed.kind !== 'reference' || !tags.includes('mail')) continue;
    const address = seed.value.trim().toLowerCase();
    if (!ADDRESS.test(address)) throw new Error(`Invalid mail address in Founder reference ${seed.id}`);
    if (!ACCOUNT_ID.test(seed.id)) throw new Error(`Mail account id must be a lowercase slug: ${seed.id}`);
    // Un mismo buzón dado dos veces (o con otra capitalización) es un solo buzón.
    if (seen.has(address)) continue;
    seen.add(address);
    const domain = address.slice(address.indexOf('@') + 1);
    const minor = tags.includes('minor');
    const provider: MailProvider = GMAIL_DOMAINS.has(domain) ? 'google' : 'unknown';
    accounts.push({
      accountId: seed.id,
      referenceId: seed.id,
      label: seed.label,
      address,
      domain,
      scope: tags.includes('scope:family') ? 'family' : tags.includes('scope:business') ? 'business' : tags.includes('scope:personal') ? 'personal' : 'unknown',
      scopeInferred: tags.includes('scope-inferred'),
      minor,
      provider,
      credentialService: `google-workspace:${seed.id}`,
      permittedReadActions: [...READ_ACTIONS],
      permittedDraftActions: minor ? [] : [...DRAFT_ACTIONS],
    });
  }
  return {
    schemaVersion: 1,
    ownerPrincipalId: document.ownerPrincipalId,
    sourceUpdatedAt: document.updatedAt,
    policy: {
      supervision: 'founder',
      readAllowed: true,
      draftsRequireFounderApproval: true,
      sendAllowed: false,
      deleteAllowed: false,
      archiveOrLabelAllowed: false,
      forwardAllowed: false,
      autoReplyAllowed: false,
      crossScopeSharing: 'founder-only',
      minorAccounts: 'read-only-no-drafts',
      credentialPersistence: 'secure-provider-only',
    },
    accounts,
  };
}

export type MailReadiness = 'ready' | 'needs_auth' | 'needs_provider_confirmation' | 'adapter_missing';

export interface MailAccessPlanItem {
  accountId: string;
  address: string;
  scope: MailScope;
  minor: boolean;
  readiness: MailReadiness;
  nextStep: string;
}

export interface MailAccessEnvironment {
  /** Adaptadores registrados en el Tool Gateway. */
  adapters: ReadonlySet<string>;
  /** ¿Hay credencial configurada para esta cuenta? (presencia, no validez). */
  hasCredential(accountId: string): boolean;
  /** Dominios propios que el Founder confirmó como Google Workspace. */
  confirmedGoogleDomains?: ReadonlySet<string>;
}

export function planMailAccess(accounts: readonly FounderMailAccount[], env: MailAccessEnvironment): MailAccessPlanItem[] {
  return accounts.map((account) => {
    const base = { accountId: account.accountId, address: account.address, scope: account.scope, minor: account.minor };
    const googleConfirmed = account.provider === 'google' || env.confirmedGoogleDomains?.has(account.domain) === true;
    if (!googleConfirmed) {
      return { ...base, readiness: 'needs_provider_confirmation', nextStep: `Confirma si ${account.address} es Google Workspace (se conecta con la API de Gmail) u otro proveedor (correo por IMAP, aún no implementado). Janus no lo da por hecho.` } satisfies MailAccessPlanItem;
    }
    if (!env.adapters.has('google-workspace')) {
      return { ...base, readiness: 'adapter_missing', nextStep: 'Falta registrar el adaptador google-workspace en el runtime.' } satisfies MailAccessPlanItem;
    }
    if (!env.hasCredential(account.accountId)) {
      return {
        ...base,
        readiness: 'needs_auth',
        nextStep: account.minor
          ? 'Autoriza esta cuenta con tu supervisión (consentimiento OAuth de solo lectura, sin borradores). Janus no la lee sin esa autorización.'
          : 'Autoriza esta cuenta con consentimiento OAuth de mínimo privilegio (lectura; borradores aparte, siempre con tu aprobación).',
      } satisfies MailAccessPlanItem;
    }
    return { ...base, readiness: 'ready', nextStep: 'Lista para leer bajo supervisión.' } satisfies MailAccessPlanItem;
  });
}
