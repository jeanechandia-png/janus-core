import type {
  FounderReferenceLibraryDocument,
  FounderReferenceSeed,
} from './founder-reference-library.js';

export type FounderSocialPlatform = 'facebook' | 'instagram';

export type FounderSocialBindingState =
  | 'canonical_target_unresolved'
  | 'graph_entity_unbound';

export interface FounderSocialSource {
  referenceId: string;
  subject: string;
  platform: FounderSocialPlatform;
  label: string;
  sourceUrl: string;
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

function socialSource(seed: FounderReferenceSeed): FounderSocialSource | null {
  const url = new URL(seed.value);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const tags = seed.tags ?? [];

  if (host === 'instagram.com') {
    const publicHandle = url.pathname.split('/').filter(Boolean)[0];
    if (!publicHandle) return null;
    return {
      referenceId: seed.id,
      subject: seed.subject,
      platform: 'instagram',
      label: seed.label,
      sourceUrl: seed.value,
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
