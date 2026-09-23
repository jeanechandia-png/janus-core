export type OutcomeLabel = 'success' | 'partial' | 'failure' | 'unknown';

export interface LearningObservation {
  id: string;
  receiptHash: string;
  blueprintId: string;
  blueprintRevision: number;
  predictedConfidence: number;
  outcomeScore: number;
  outcome: OutcomeLabel;
  at: string;
  metrics?: Record<string, number>;
  notes?: string;
}

export interface CalibrationSummary {
  count: number;
  meanConfidence: number;
  meanOutcome: number;
  meanAbsoluteCalibrationError: number;
  brierScore: number;
}

export type DriftSeverity = 'none' | 'low' | 'medium' | 'high';

export interface DriftSignal {
  detected: boolean;
  severity: DriftSeverity;
  baselineMean: number;
  recentMean: number;
  delta: number;
  reasons: string[];
}

export interface ImprovementProposal {
  id: string;
  blueprintId: string;
  fromRevision: number;
  rationale: string;
  evidenceRefs: string[];
  suggestedChanges: string[];
  requiresHumanApproval: true;
  status: 'proposed' | 'approved' | 'rejected' | 'applied';
  createdAt: string;
}

export function summarizeCalibration(
  observations: readonly LearningObservation[],
): CalibrationSummary {
  if (observations.length === 0) {
    return {
      count: 0,
      meanConfidence: 0,
      meanOutcome: 0,
      meanAbsoluteCalibrationError: 0,
      brierScore: 0,
    };
  }

  for (const observation of observations) validateObservation(observation);
  const count = observations.length;
  const meanConfidence =
    observations.reduce((sum, item) => sum + item.predictedConfidence, 0) / count;
  const meanOutcome = observations.reduce((sum, item) => sum + item.outcomeScore, 0) / count;
  const meanAbsoluteCalibrationError =
    observations.reduce(
      (sum, item) => sum + Math.abs(item.predictedConfidence - item.outcomeScore),
      0,
    ) / count;
  const brierScore =
    observations.reduce(
      (sum, item) => sum + (item.predictedConfidence - item.outcomeScore) ** 2,
      0,
    ) / count;

  return {
    count,
    meanConfidence,
    meanOutcome,
    meanAbsoluteCalibrationError,
    brierScore,
  };
}

export function detectOutcomeDrift(
  observations: readonly LearningObservation[],
  options: {
    recentWindow?: number;
    baselineWindow?: number;
    minimumSamples?: number;
    threshold?: number;
  } = {},
): DriftSignal {
  const recentWindow = options.recentWindow ?? 10;
  const baselineWindow = options.baselineWindow ?? 20;
  const minimumSamples = options.minimumSamples ?? 12;
  const threshold = options.threshold ?? 0.15;

  if (observations.length < minimumSamples) {
    return {
      detected: false,
      severity: 'none',
      baselineMean: 0,
      recentMean: 0,
      delta: 0,
      reasons: ['insufficient outcome history'],
    };
  }

  for (const observation of observations) validateObservation(observation);
  const ordered = [...observations].sort((a, b) => a.at.localeCompare(b.at));
  const recent = ordered.slice(-recentWindow);
  const baselineStart = Math.max(0, ordered.length - recentWindow - baselineWindow);
  const baseline = ordered.slice(baselineStart, ordered.length - recent.length);

  if (baseline.length === 0 || recent.length === 0) {
    return {
      detected: false,
      severity: 'none',
      baselineMean: 0,
      recentMean: 0,
      delta: 0,
      reasons: ['insufficient baseline/recent split'],
    };
  }

  const baselineMean = mean(baseline.map((item) => item.outcomeScore));
  const recentMean = mean(recent.map((item) => item.outcomeScore));
  const delta = recentMean - baselineMean;
  const magnitude = Math.abs(delta);

  let severity: DriftSeverity = 'none';
  if (magnitude >= threshold * 2) severity = 'high';
  else if (magnitude >= threshold * 1.5) severity = 'medium';
  else if (magnitude >= threshold) severity = 'low';

  return {
    detected: severity !== 'none',
    severity,
    baselineMean,
    recentMean,
    delta,
    reasons:
      severity === 'none'
        ? ['recent outcomes remain within configured drift threshold']
        : [
            `outcome mean changed by ${delta.toFixed(3)}`,
            delta < 0 ? 'recent performance degraded' : 'recent performance improved',
          ],
  };
}

export function proposeImprovement(input: {
  id: string;
  blueprintId: string;
  fromRevision: number;
  rationale: string;
  evidenceRefs: string[];
  suggestedChanges: string[];
  createdAt?: string;
}): ImprovementProposal {
  if (!input.id.trim()) throw new Error('Improvement proposal id is required');
  if (!input.blueprintId.trim()) throw new Error('Improvement proposal blueprintId is required');
  if (!Number.isInteger(input.fromRevision) || input.fromRevision < 1) {
    throw new Error('Improvement proposal fromRevision must be a positive integer');
  }
  if (!input.rationale.trim()) throw new Error('Improvement proposal rationale is required');
  if (input.evidenceRefs.length === 0) throw new Error('Improvement proposal requires evidence');
  if (input.suggestedChanges.length === 0) throw new Error('Improvement proposal requires changes');

  return {
    id: input.id,
    blueprintId: input.blueprintId,
    fromRevision: input.fromRevision,
    rationale: input.rationale,
    evidenceRefs: [...input.evidenceRefs],
    suggestedChanges: [...input.suggestedChanges],
    requiresHumanApproval: true,
    status: 'proposed',
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

function validateObservation(observation: LearningObservation): void {
  if (!Number.isFinite(observation.predictedConfidence) || observation.predictedConfidence < 0 || observation.predictedConfidence > 1) {
    throw new Error('predictedConfidence must be between 0 and 1');
  }
  if (!Number.isFinite(observation.outcomeScore) || observation.outcomeScore < 0 || observation.outcomeScore > 1) {
    throw new Error('outcomeScore must be between 0 and 1');
  }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
