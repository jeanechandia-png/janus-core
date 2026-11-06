/**
 * JANUS family health domain: no device access, secrets, or medical diagnosis.
 * Native iOS HealthKit adapter and authenticated server storage are separate tasks.
 */
export type HealthProfileRole = 'founder' | 'child';
export type HealthMetric = 'heart_rate' | 'resting_heart_rate' | 'steps' | 'sleep_minutes' | 'blood_pressure_systolic' | 'blood_pressure_diastolic';
export type HealthUnit = 'bpm' | 'count' | 'min' | 'mmHg';
export interface HealthProfile { id: string; role: HealthProfileRole; displayName: string; }
export interface HealthSample {
  profileId: string;
  metric: HealthMetric;
  value: number;
  unit: HealthUnit;
  recordedAt: string;
  source: string;
}
export interface HealthGrant {
  subjectProfileId: string;
  viewerProfileId: string;
  metrics: readonly HealthMetric[];
  grantedAt: string;
  revokedAt?: string;
}
export interface HealthViewContext {
  viewerProfileId: string;
  profiles: readonly HealthProfile[];
  grants: readonly HealthGrant[];
}
const units: Record<HealthMetric, HealthUnit> = {
  heart_rate: 'bpm', resting_heart_rate: 'bpm', steps: 'count', sleep_minutes: 'min',
  blood_pressure_systolic: 'mmHg', blood_pressure_diastolic: 'mmHg',
};
export function canReadHealthMetric(ctx: HealthViewContext, profileId: string, metric: HealthMetric): boolean {
  if (!ctx.profiles.some(p => p.id === ctx.viewerProfileId) || !ctx.profiles.some(p => p.id === profileId)) return false;
  if (profileId === ctx.viewerProfileId) return true;
  return ctx.grants.some(g => g.viewerProfileId === ctx.viewerProfileId && g.subjectProfileId === profileId &&
    !g.revokedAt && g.metrics.includes(metric));
}
export function filterHealthSamples(ctx: HealthViewContext, samples: readonly HealthSample[]): HealthSample[] {
  return samples.filter(sample => canReadHealthMetric(ctx, sample.profileId, sample.metric));
}
export function validateHealthSample(sample: HealthSample): void {
  if (!sample.profileId.trim() || !sample.source.trim()) throw new Error('Missing health sample provenance');
  if (!(sample.metric in units) || sample.unit !== units[sample.metric]) throw new Error('Metric/unit mismatch');
  if (!Number.isFinite(sample.value) || sample.value < 0) throw new Error('Invalid measurement');
  if (sample.metric === 'steps' && !Number.isInteger(sample.value)) throw new Error('Steps must be an integer');
  if (!sample.recordedAt || Number.isNaN(Date.parse(sample.recordedAt))) throw new Error('Invalid timestamp');
}
export interface HealthDisplayState {
  status: 'no_connection' | 'no_measurement' | 'available';
  latest?: HealthSample;
}
export function getHealthDisplayState(ctx: HealthViewContext, profileId: string, metric: HealthMetric, samples: readonly HealthSample[], connected: boolean): HealthDisplayState {
  if (!canReadHealthMetric(ctx, profileId, metric)) throw new Error('Health metric access denied');
  if (!connected) return { status: 'no_connection' };
  const matching = samples.filter(s => s.profileId === profileId && s.metric === metric);
  matching.forEach(validateHealthSample);
  matching.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return matching.length ? { status: 'available', latest: matching[0] } : { status: 'no_measurement' };
}
/** No generic adult thresholds are applied to a child; clinical alerts require validated, age-appropriate rules. */
export function healthAlertReadiness(profile: HealthProfile): 'clinical_rules_required' {
  void profile;
  return 'clinical_rules_required';
}
