import type {
  FounderReferenceLibraryDocument,
  FounderReferenceSeed,
} from './founder-reference-library.js';

export type FounderSocialPlatform = 'facebook' | 'instagram' | 'threads';

/** Ámbito (personal/familiar vs laboral): se declara con las etiquetas `scope:personal` / `scope:business`; sin etiqueta queda `unknown`. */
export type FounderSocialScope = 'personal' | 'business' | 'unknown';

export type FounderSocialBindingState =
  | 'canonical_target_unresolved'
  | 'graph_entity_unbound';

export interface FounderSocialSource {
  referenceId: string;
  subject: string;
  platform: FounderSocialPlatform;
  label: string;
  sourceUrl: string;
  /** Misma URL sin parámetros de seguimiento (mibextid, igshid, stkn, psln, utm_*…). Solo para mostrar y comparar; `sourceUrl` se conserva exacta. */
  cleanUrl: string;
  scope: FounderSocialScope;
  classification: FounderReferenceSeed['classification'];
  retention: FounderReferenceSeed['retention'];
  tags: string[];
  publicHandle?: string;
  shareToken?: string;
  canonicalTarget: string | null;
  graphEntityId: string | null;
  bindingState: FounderSocialBindingState;
  permittedReadActions: string[];
}

export interface FounderSocialSourceRegistry {
  schemaVersion: 1;
  ownerPrincipalId: string;
  sourceUpdatedAt: string;
  policy: {
    mode: 'read_only';
    publishingAllowed: false;
    directMessagingAllowed: false;
    campaignManagementAllowed: false;
    spendAllowed: false;
    credentialPersistence: 'secure-provider-only';
  };
  sources: FounderSocialSource[];
}

export function buildFounderSocialSourceRegistry(
  document: FounderReferenceLibraryDocument,
): FounderSocialSourceRegistry {
  const sources = document.records.flatMap((seed) => {
    if (seed.kind !== 'reference' || !(seed.tags ?? []).includes('social')) return [];
    const source = socialSource(seed);
    return source ? [source] : [];
  });

  return {
    schemaVersion: 1,
    ownerPrincipalId: document.ownerPrincipalId,
    sourceUpdatedAt: document.updatedAt,
    policy: {
      mode: 'read_only',
      publishingAllowed: false,
      directMessagingAllowed: false,
      campaignManagementAllowed: false,
      spendAllowed: false,
      credentialPersistence: 'secure-provider-only',
    },
    sources,
  };
}

const TRACKING_PARAMS = /^(mibextid|igshid|igsh|stkn|psln|obrf|fbclid|ref|ref_src|utm_[a-z]+)$/i;

export function cleanSocialUrl(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

function scopeOf(tags: readonly string[]): FounderSocialScope {
  if (tags.includes('scope:personal')) return 'personal';
  if (tags.includes('scope:business')) return 'business';
  return 'unknown';
}

function socialSource(seed: FounderReferenceSeed): FounderSocialSource | null {
  const url = new URL(seed.value);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const tags = seed.tags ?? [];
  const common = { cleanUrl: cleanSocialUrl(seed.value), scope: scopeOf(tags) };

  if (host === 'instagram.com') {
    const publicHandle = url.pathname.split('/').filter(Boolean)[0];
    if (!publicHandle) return null;
    return {
      referenceId: seed.id,
      subject: seed.subject,
      platform: 'instagram',
      label: seed.label,
      sourceUrl: seed.value,
      ...common,
      classification: seed.classification,
      retention: seed.retention,
      tags,
      publicHandle,
      canonicalTarget: null,
      graphEntityId: null,
      bindingState: 'graph_entity_unbound',
      permittedReadActions: ['instagram.account.insights'],
    };
  }

  if (host === 'threads.com' || host === 'threads.net') {
    const handleSegment = url.pathname.split('/').filter(Boolean)[0];
    if (!handleSegment?.startsWith('@') || handleSegment.length < 2) return null;
    return {
      referenceId: seed.id,
      subject: seed.subject,
      platform: 'threads',
      label: seed.label,
      sourceUrl: seed.value,
      ...common,
      classification: seed.classification,
      retention: seed.retention,
      tags,
      publicHandle: handleSegment.slice(1),
      canonicalTarget: null,
      graphEntityId: null,
      bindingState: 'graph_entity_unbound',
      permittedReadActions: ['threads.account.profile', 'threads.account.insights'],
    };
  }

  if (host === 'facebook.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const shareIndex = parts.indexOf('share');
    const shareToken = shareIndex >= 0 ? parts[shareIndex + 1] : undefined;
    return {
      referenceId: seed.id,
      subject: seed.subject,
      platform: 'facebook',
      label: seed.label,
      sourceUrl: seed.value,
      ...common,
      classification: seed.classification,
      retention: seed.retention,
      tags,
      ...(shareToken ? { shareToken } : {}),
      canonicalTarget: null,
      graphEntityId: null,
      bindingState: 'canonical_target_unresolved',
      permittedReadActions: ['facebook.page.insights'],
    };
  }

  return null;
}
