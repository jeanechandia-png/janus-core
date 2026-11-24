/** Family health longitudinal observation, without diagnosis or automatic emergency dispatch. */
export type ObservationKind = 'heart_rate' | 'sleep' | 'respiratory_rate' | 'snoring' | 'blood_oxygen' | 'ecg' | 'symptom' | 'note';
export type ObservationUnit = 'bpm' | 'minutes' | 'breaths_per_minute' | 'percent' | 'events' | 'text' | 'file_reference';
export interface Observation {
  id: string;
  profileId: string;
  kind: ObservationKind;
  recordedAt: string;
  source: string;
  value?: number;
  unit: ObservationUnit;
  text?: string;
  referenceId?: string;
}
export interface MonitoringPlan {
  profileId: string;
  mode: 'off' | 'manual' | 'seasonal';
  enabledKinds: readonly ObservationKind[];
  startedAt: string;
  endsAt?: string;
  consentRecordedAt: string;
}
export interface Episode {
  id: string;
  profileId: string;
  startedAt: string;
  endedAt?: string;
  trigger: 'self_reported' | 'device_observation';
  symptoms: readonly string[];
  activityContext?: string;
  reliefActions?: readonly string[];
  notes?: string;
}
export function validateObservation(o: Observation): void {
  if (!o.id || !o.profileId || !o.source || !Number.isFinite(Date.parse(o.recordedAt))) throw new Error('Missing observation provenance');
  const units: Record<ObservationKind, readonly ObservationUnit[]> = {
    heart_rate: ['bpm'], sleep: ['minutes'], respiratory_rate: ['breaths_per_minute'],
    snoring: ['events', 'minutes'], blood_oxygen: ['percent'], ecg: ['file_reference'],
    symptom: ['text'], note: ['text'],
  };
  if (!units[o.kind]?.includes(o.unit)) throw new Error('Invalid observation unit');
  if (o.unit === 'text' && !o.text?.trim()) throw new Error('Missing observation text');
  if (o.unit === 'file_reference' && !o.referenceId?.trim()) throw new Error('Missing private file reference');
  if (o.unit !== 'text' && o.unit !== 'file_reference' && (!Number.isFinite(o.value) || o.value! < 0)) throw new Error('Invalid numeric observation');
  if (o.unit === 'percent' && o.value! > 100) throw new Error('Invalid percentage');
}
export function canCollectObservation(plan: MonitoringPlan, kind: ObservationKind, at: string): boolean {
  if (plan.mode === 'off' || !plan.enabledKinds.includes(kind)) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && t >= Date.parse(plan.startedAt) &&
    (!plan.endsAt || t <= Date.parse(plan.endsAt));
}
export interface ClinicalSummary {
  profileId: string;
  periodStart: string;
  periodEnd: string;
  episodes: Array<{ startedAt: string; durationMinutes: number | null; trigger: Episode['trigger']; symptoms: string[]; activityContext?: string; reliefActions?: string[]; notes?: string }>;
  observations: Array<{ kind: ObservationKind; recordedAt: string; value?: number; unit: ObservationUnit; source: string; text?: string; referenceId?: string }>;
  limitations: string[];
}
/** Caller must authorize profile access BEFORE calling; never return another profile's data. */
export function buildClinicalSummary(profileId: string, periodStart: string, periodEnd: string, episodes: readonly Episode[], observations: readonly Observation[]): ClinicalSummary {
  const from = Date.parse(periodStart), to = Date.parse(periodEnd);
  if (!profileId || !Number.isFinite(from) || !Number.isFinite(to) || from > to) throw new Error('Invalid report scope');
  const inRange = (time: string) => { const t = Date.parse(time); return Number.isFinite(t) && t >= from && t <= to; };
  const selected = observations.filter(o => o.profileId === profileId && inRange(o.recordedAt));
  selected.forEach(validateObservation);
  return {
    profileId, periodStart, periodEnd,
    episodes: episodes.filter(e => e.profileId === profileId && inRange(e.startedAt)).map(e => ({
      startedAt: e.startedAt,
      durationMinutes: e.endedAt && Number.isFinite(Date.parse(e.endedAt)) && Date.parse(e.endedAt) >= Date.parse(e.startedAt)
        ? Math.round((Date.parse(e.endedAt) - Date.parse(e.startedAt)) / 60000) : null,
      trigger: e.trigger, symptoms: [...e.symptoms], activityContext: e.activityContext,
      reliefActions: e.reliefActions ? [...e.reliefActions] : undefined, notes: e.notes,
    })),
    observations: selected.map(o => ({ kind: o.kind, recordedAt: o.recordedAt, value: o.value, unit: o.unit, source: o.source, text: o.text, referenceId: o.referenceId })),
    limitations: [
      'Registros de sensores y declaraciones del usuario; no constituyen diagnóstico.',
      'Las ausencias de datos no demuestran ausencia de síntomas.',
      'Las mediciones y funciones disponibles dependen del dispositivo, permisos y compatibilidad.',
      'La detección de ronquidos y la respiración nocturna no diagnostican apnea del sueño.',
    ],
  };
}
