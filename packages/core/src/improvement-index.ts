export type ImprovementDimension =
  | 'knowledge'
  | 'execution'
  | 'consistency'
  | 'communication'
  | 'tooling'
  | 'autonomy';

export interface ImprovementSignal {
  id: string;
  dimension: ImprovementDimension;
  observedAt: string;
  source: 'run' | 'lesson' | 'verification' | 'user';
  metric: string;
  value: number;
  evidenceRef?: string;
}

export interface ImprovementIndexEntry {
  dimension: ImprovementDimension;
  score: number;
  previousScore?: number;
  updatedAt: string;
  supportingSignalIds: string[];
}

export interface ImprovementIndex {
  entries: ImprovementIndexEntry[];
  generatedAt: string;
}

export interface ImprovementUpdate {
  dimension: ImprovementDimension;
  delta: number;
  message: string;
  evidenceRefs: string[];
}

export function buildImprovementIndex(
  signals: readonly ImprovementSignal[],
  generatedAt: string,
): ImprovementIndex {
  const grouped = new Map<ImprovementDimension, ImprovementSignal[]>();
  for (const signal of signals) {
    const list = grouped.get(signal.dimension) ?? [];
    list.push(signal);
    grouped.set(signal.dimension, list);
  }

  const entries = [...grouped.entries()].map(([dimension, dimensionSignals]) => {
    const ordered = [...dimensionSignals].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const score = clampScore(weightedAverage(ordered));
    return {
      dimension,
      score,
      updatedAt: ordered.at(-1)?.observedAt ?? generatedAt,
      supportingSignalIds: ordered.map((signal) => signal.id),
    };
  });

  return { entries, generatedAt };
}

export function improvementUpdates(
  previous: ImprovementIndex,
  current: ImprovementIndex,
  minimumDelta = 5,
): ImprovementUpdate[] {
  const previousByDimension = new Map(previous.entries.map((entry) => [entry.dimension, entry]));
  const updates: ImprovementUpdate[] = [];

  for (const entry of current.entries) {
    const old = previousByDimension.get(entry.dimension);
    if (!old) continue;
    const delta = entry.score - old.score;
    if (Math.abs(delta) < minimumDelta) continue;
    updates.push({
      dimension: entry.dimension,
      delta,
      message: delta > 0
        ? `${entry.dimension} mejoró ${delta.toFixed(1)} puntos con evidencia nueva.`
        : `${entry.dimension} bajó ${Math.abs(delta).toFixed(1)} puntos y requiere revisión.`,
      evidenceRefs: entry.supportingSignalIds,
    });
  }

  return updates;
}

function weightedAverage(signals: readonly ImprovementSignal[]): number {
  if (signals.length === 0) return 0;
  let weighted = 0;
  let totalWeight = 0;
  signals.forEach((signal, index) => {
    const weight = index + 1;
    weighted += signal.value * weight;
    totalWeight += weight;
  });
  return weighted / totalWeight;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}
