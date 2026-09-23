export type ConnectivityState = 'online' | 'offline' | 'unknown';

export type OfflineCapability =
  | 'reason'
  | 'plan'
  | 'code'
  | 'build'
  | 'test'
  | 'debug'
  | 'document'
  | 'commit_local'
  | 'external_sync'
  | 'external_deploy';

export interface OfflineCapabilityDecision {
  capability: OfflineCapability;
  allowed: boolean;
  queueForReconnect: boolean;
  reason: string;
}

const LOCAL_CAPABILITIES = new Set<OfflineCapability>([
  'reason',
  'plan',
  'code',
  'build',
  'test',
  'debug',
  'document',
  'commit_local',
]);

export function offlineCapabilityDecision(
  capability: OfflineCapability,
  connectivity: ConnectivityState,
): OfflineCapabilityDecision {
  if (LOCAL_CAPABILITIES.has(capability)) {
    return {
      capability,
      allowed: true,
      queueForReconnect: false,
      reason: 'Core project work is required to remain locally executable.',
    };
  }

  if (connectivity === 'online') {
    return {
      capability,
      allowed: true,
      queueForReconnect: false,
      reason: 'External capability is available while online.',
    };
  }

  return {
    capability,
    allowed: false,
    queueForReconnect: true,
    reason: 'External action requires connectivity and must be revalidated before execution after reconnect.',
  };
}

export function offlineProjectContinuityReady(
  available: ReadonlySet<OfflineCapability>,
): { ready: boolean; missing: OfflineCapability[] } {
  const required = [...LOCAL_CAPABILITIES];
  const missing = required.filter((capability) => !available.has(capability));
  return { ready: missing.length === 0, missing };
}
