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

export interface ExecutionConfidenceEstimate {
  confidence: number;
  mode: 'neutral_prior' | 'calibrated_history' | 'drift_adjusted_recent';
  sampleCount: number;
  evidenceCount: number;
  minimumSamples: number;
  empiricalMean: number;
  brierScore: number;
  drift: DriftSignal;
  bounds: {
    min: number;
    max: number;
  };
}

export function estimateExecutionConfidence(
  observations: readonly LearningObservation[],
  options: {
    minimumSamples?: number;
    priorAlpha?: number;
    priorBeta?: number;
    minConfidence?: number;
    maxConfidence?: number;
    driftRecentWindow?: number;
  } = {},
): ExecutionConfidenceEstimate {
  const minimumSamples = positiveInteger(options.minimumSamples, 20);
  const priorAlpha = positiveNumber(options.priorAlpha, 2);
  const priorBeta = positiveNumber(options.priorBeta, 2);
  const minConfidence = boundedProbability(options.minConfidence, 0.1);
  const maxConfidence = boundedProbability(options.maxConfidence, 0.9);
  const driftRecentWindow = positiveInteger(options.driftRecentWindow, 10);
  if (minConfidence >= maxConfidence) {
    throw new Error('execution confidence min bound must be lower than max bound');
  }

  const ordered = [...observations].sort((a, b) => a.at.localeCompare(b.at));
  const calibration = summarizeCalibration(ordered);
  const drift = detectOutcomeDrift(ordered, {
    recentWindow: driftRecentWindow,
  });

  if (ordered.length < minimumSamples) {
    return {
      confidence: 0.5,
      mode: 'neutral_prior',
      sampleCount: ordered.length,
      evidenceCount: ordered.length,
      minimumSamples,
      empiricalMean: calibration.meanOutcome,
      brierScore: calibration.brierScore,
      drift,
      bounds: { min: minConfidence, max: maxConfidence },
    };
  }

  const evidence = drift.detected
    ? ordered.slice(-Math.min(driftRecentWindow, ordered.length))
    : ordered;
  const outcomeSum = evidence.reduce(
    (sum, observation) => sum + observation.outcomeScore,
    0,
  );
  const posteriorMean =
    (priorAlpha + outcomeSum)
    / (priorAlpha + priorBeta + evidence.length);
  const confidence = Math.min(
    maxConfidence,
    Math.max(minConfidence, posteriorMean),
  );

  return {
    confidence,
    mode: drift.detected ? 'drift_adjusted_recent' : 'calibrated_history',
    sampleCount: ordered.length,
    evidenceCount: evidence.length,
    minimumSamples,
    empiricalMean:
      evidence.reduce((sum, observation) => sum + observation.outcomeScore, 0)
      / evidence.length,
    brierScore: calibration.brierScore,
    drift,
    bounds: { min: minConfidence, max: maxConfidence },
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


function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('expected a positive integer');
  }
  return value;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('expected a positive number');
  }
  return value;
}

function boundedProbability(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('expected probability between 0 and 1');
  }
  return value;
}
