/**
 * Reusable family-health isolation layer for JANUS and future client deployments.
 * No PHI storage, clinical decision-making or device connectivity in this module.
 */
import { buildClinicalSummary, type Episode, type Observation, type ClinicalSummary } from './longitudinal-monitoring.js';
export type HealthRole = 'owner' | 'guardian' | 'subject';
export interface HealthPrincipal {
  tenantId: string;
  userId: string;
}
export interface HealthSubject {
  tenantId: string;
  subjectId: string;
  userId?: string;
  isMinor: boolean;
}
export interface HealthAccessGrant {
  tenantId: string;
  subjectId: string;
  granteeUserId: string;
  allowedActions: readonly ('read' | 'export')[];
  consentRecordedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}
export interface TenantObservation extends Observation { tenantId: string; }
export interface TenantEpisode extends Episode { tenantId: string; }
export function requireHealthAccess(
  principal: HealthPrincipal, subject: HealthSubject,
  action: 'read' | 'export', grants: readonly HealthAccessGrant[], at: string,
): void {
  const now = Date.parse(at);
  if (!principal.tenantId || !principal.userId || !Number.isFinite(now) || principal.tenantId !== subject.tenantId) {
    throw new Error('Health access denied');
  }
  if (subject.userId === principal.userId) return;
  const authorized = grants.some(g =>
    g.tenantId === principal.tenantId && g.subjectId === subject.subjectId &&
    g.granteeUserId === principal.userId && g.allowedActions.includes(action) &&
    Number.isFinite(Date.parse(g.consentRecordedAt)) && Date.parse(g.consentRecordedAt) <= now &&
    !g.revokedAt && (!g.expiresAt || Date.parse(g.expiresAt) >= now)
  );
  if (!authorized) throw new Error('Health access denied');
}
/** Do not load or pass cross-tenant records. Backend must also enforce tenant RLS. */
export function buildAuthorizedHealthReport(
  principal: HealthPrincipal, subject: HealthSubject, grants: readonly HealthAccessGrant[],
  start: string, end: string, at: string,
  episodes: readonly TenantEpisode[], observations: readonly TenantObservation[],
): ClinicalSummary {
  requireHealthAccess(principal, subject, 'export', grants, at);
  const scopedEpisodes = episodes.filter(e => e.tenantId === subject.tenantId && e.profileId === subject.subjectId);
  const scopedObservations = observations.filter(o => o.tenantId === subject.tenantId && o.profileId === subject.subjectId);
  return buildClinicalSummary(subject.subjectId, start, end, scopedEpisodes, scopedObservations);
}
export interface LiveReadingStatus {
  status: 'not_connected' | 'no_reading' | 'fresh' | 'stale';
  recordedAt?: string;
  ageSeconds?: number;
  value?: number;
  unit?: Observation['unit'];
  source?: string;
}
/** Freshness is presentation metadata, never proof of continuous medical monitoring. */
export function describeReadingFreshness(
  reading: TenantObservation | undefined, connected: boolean, nowIso: string, maxAgeSeconds: number,
): LiveReadingStatus {
  if (!connected) return { status: 'not_connected' };
  if (!reading) return { status: 'no_reading' };
  const now = Date.parse(nowIso), recorded = Date.parse(reading.recordedAt);
  if (!Number.isFinite(now) || !Number.isFinite(recorded) || !Number.isFinite(maxAgeSeconds) || maxAgeSeconds < 0) throw new Error('Invalid freshness configuration');
  const ageSeconds = Math.max(0, Math.floor((now - recorded) / 1000));
  return { status: recorded > now || ageSeconds > maxAgeSeconds ? 'stale' : 'fresh',
    recordedAt: reading.recordedAt, ageSeconds, value: reading.value, unit: reading.unit, source: reading.source };
}
