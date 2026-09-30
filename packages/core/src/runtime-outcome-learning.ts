import type { DecisionBlueprint } from './decision-blueprint.js';
import type { DecisionReceipt } from './decision-receipt.js';
import type { JanusEvent, RunSnapshot } from './events.js';
import {
  detectOutcomeDrift,
  proposeImprovement,
  summarizeCalibration,
  type DriftSignal,
  type ImprovementProposal,
  type LearningObservation,
  type OutcomeLabel,
} from './outcome-learning.js';

export interface RuntimeOutcomeAssessment {
  outcome: OutcomeLabel;
  outcomeScore: number;
  learningEligible: boolean;
  evidenceRefs: string[];
  reasons: string[];
  metrics: Record<string, number>;
}

export interface RuntimeLearningReport {
  calibration: ReturnType<typeof summarizeCalibration>;
  drift: DriftSignal;
}

export interface RuntimeExecutionPrediction {
  confidence: number;
  basis: 'neutral-prior' | 'verified-outcomes';
  sampleCount: number;
  meanOutcome: number;
  shrinkagePrior: number;
  minimumSamples: number;
}

export function deriveRuntimeExecutionPrediction(
  observations: readonly LearningObservation[],
  options: {
    minimumSamples?: number;
    priorMean?: number;
    priorStrength?: number;
    minConfidence?: number;
    maxConfidence?: number;
  } = {},
): RuntimeExecutionPrediction {
  const minimumSamples = Math.max(1, Math.floor(options.minimumSamples ?? 12));
  const priorMean = clamp(options.priorMean ?? 0.5, 0, 1);
  const priorStrength = Math.max(0, options.priorStrength ?? 4);
  const minConfidence = clamp(options.minConfidence ?? 0.1, 0, 1);
  const maxConfidence = clamp(options.maxConfidence ?? 0.9, minConfidence, 1);

  if (observations.length < minimumSamples) {
    return {
      confidence: priorMean,
      basis: 'neutral-prior',
      sampleCount: observations.length,
      meanOutcome: observations.length === 0
        ? priorMean
        : meanOutcome(observations),
      shrinkagePrior: priorMean,
      minimumSamples,
    };
  }

  for (const observation of observations) {
    if (
      !Number.isFinite(observation.outcomeScore)
      || observation.outcomeScore < 0
      || observation.outcomeScore > 1
    ) {
      throw new Error('Runtime execution prediction requires outcomeScore in [0,1]');
    }
  }

  const empiricalMean = meanOutcome(observations);
  const posterior =
    (observations.reduce((sum, observation) => sum + observation.outcomeScore, 0)
      + priorMean * priorStrength)
    / (observations.length + priorStrength);

  return {
    confidence: clamp(posterior, minConfidence, maxConfidence),
    basis: 'verified-outcomes',
    sampleCount: observations.length,
    meanOutcome: empiricalMean,
    shrinkagePrior: priorMean,
    minimumSamples,
  };
}

export function assessVerifiedRunOutcome(
  snapshot: RunSnapshot,
  events: readonly JanusEvent[],
  options: { hasExecutionPrediction: boolean },
): RuntimeOutcomeAssessment {
  const qualityPassed = events.filter((event) => event.type === 'quality.passed');
  const qualityFailed = events.filter((event) => event.type === 'quality.failed');
  const toolCompleted = events.filter((event) => event.type === 'tool.completed');
  const terminalEvents = events.filter((event) =>
    event.type === 'run.completed'
    || event.type === 'run.failed'
    || event.type === 'run.blocked'
    || event.type === 'run.cancelled'
  );

  const metrics = {
    qualityPassedCount: qualityPassed.length,
    qualityFailedCount: qualityFailed.length,
    toolCompletedCount: toolCompleted.length,
  };
  const evidenceRefs = [
    ...terminalEvents.map((event) => 'event:' + event.id),
    ...qualityPassed.map((event) => 'event:' + event.id),
    ...qualityFailed.map((event) => 'event:' + event.id),
  ];

  if (!options.hasExecutionPrediction) {
    return {
      outcome: 'unknown',
      outcomeScore: 0.5,
      learningEligible: false,
      evidenceRefs,
      reasons: ['No validated executable-plan prediction exists for this run.'],
      metrics,
    };
  }

  if (qualityFailed.length > 0 || snapshot.status === 'failed') {
    return {
      outcome: 'failure',
      outcomeScore: 0,
      learningEligible: true,
      evidenceRefs,
      reasons: qualityFailed.length > 0
        ? ['A verified Delivery Gate failure or runtime failure was observed.']
        : ['The TaskRunner reached failed status after executable planning.'],
      metrics,
    };
  }

  if (snapshot.status === 'completed' && qualityPassed.length > 0) {
    return {
      outcome: 'success',
      outcomeScore: 1,
      learningEligible: true,
      evidenceRefs,
      reasons: ['The TaskRunner completed and at least one artifact passed the Delivery Gate.'],
      metrics,
    };
  }

  if (snapshot.status === 'blocked') {
    return {
      outcome: 'unknown',
      outcomeScore: 0.5,
      learningEligible: false,
      evidenceRefs,
      reasons: ['The run was blocked; dependency, authority or approval blockers are not task-quality evidence.'],
      metrics,
    };
  }

  if (snapshot.status === 'cancelled') {
    return {
      outcome: 'unknown',
      outcomeScore: 0.5,
      learningEligible: false,
      evidenceRefs,
      reasons: ['The run was cancelled before a calibratable task outcome was observed.'],
      metrics,
    };
  }

  return {
    outcome: 'unknown',
    outcomeScore: 0.5,
    learningEligible: false,
    evidenceRefs,
    reasons: ['No verified calibratable terminal outcome was observed.'],
    metrics,
  };
}

export function createRuntimeLearningObservation(input: {
  snapshot: RunSnapshot;
  blueprint: DecisionBlueprint;
  prediction: DecisionReceipt;
  assessment: RuntimeOutcomeAssessment;
}): LearningObservation {
  if (input.prediction.decisionKind !== 'execution_prediction') {
    throw new Error('Runtime learning requires an execution_prediction receipt');
  }
  if (!input.assessment.learningEligible) {
    throw new Error('Runtime outcome is not eligible for calibration');
  }
  if (
    input.prediction.blueprintId !== input.blueprint.id
    || input.prediction.blueprintRevision !== input.blueprint.revision
  ) {
    throw new Error('Prediction receipt does not belong to the active Blueprint revision');
  }

  return {
    id: 'learning:' + input.snapshot.runId,
    receiptHash: input.prediction.hash,
    blueprintId: input.blueprint.id,
    blueprintRevision: input.blueprint.revision,
    predictedConfidence: input.prediction.confidence,
    outcomeScore: input.assessment.outcomeScore,
    outcome: input.assessment.outcome,
    at: input.snapshot.updatedAt,
    metrics: { ...input.assessment.metrics },
    notes: input.assessment.reasons.join(' '),
  };
}

export function runtimeLearningReport(
  observations: readonly LearningObservation[],
): RuntimeLearningReport {
  return {
    calibration: summarizeCalibration(observations),
    drift: detectOutcomeDrift(observations),
  };
}

export function maybeProposeRuntimeImprovement(input: {
  blueprint: DecisionBlueprint;
  observations: readonly LearningObservation[];
  existingProposals: readonly ImprovementProposal[];
  createdAt?: string;
}): ImprovementProposal | null {
  const report = runtimeLearningReport(input.observations);
  if (!report.drift.detected || report.drift.delta >= 0) return null;

  const alreadyOpen = input.existingProposals.some(
    (proposal) =>
      proposal.blueprintId === input.blueprint.id
      && proposal.fromRevision === input.blueprint.revision
      && (proposal.status === 'proposed' || proposal.status === 'approved'),
  );
  if (alreadyOpen) return null;

  const recent = [...input.observations]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-10);
  if (recent.length === 0) return null;

  const latest = recent.at(-1)!;
  const evidenceRefs = recent.flatMap((observation) => [
    'learning:' + observation.id,
    'receipt:' + observation.receiptHash,
  ]);

  return proposeImprovement({
    id:
      'runtime-drift:'
      + input.blueprint.id
      + ':r'
      + input.blueprint.revision
      + ':'
      + latest.id.replace(/[^a-zA-Z0-9._:-]/g, '_'),
    blueprintId: input.blueprint.id,
    fromRevision: input.blueprint.revision,
    rationale:
      'Verified runtime outcomes degraded by '
      + Math.abs(report.drift.delta).toFixed(3)
      + ' versus the baseline window.',
    evidenceRefs,
    suggestedChanges: [
      'Review recent Decision Receipts and failed Delivery Gate evidence before changing policy.',
      'Compare model/tool routing, capability readiness and failure causes across baseline and recent outcomes.',
      'Create a new Blueprint revision only after explicit human approval and regression verification.',
    ],
    createdAt: input.createdAt,
  });
}


function meanOutcome(observations: readonly LearningObservation[]): number {
  if (observations.length === 0) return 0;
  return observations.reduce((sum, observation) => sum + observation.outcomeScore, 0)
    / observations.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
