export type OperationalBlockerKind =
  | 'provider'
  | 'authentication'
  | 'capability'
  | 'approval'
  | 'dependency'
  | 'data'
  | 'external_service'
  | 'unknown';

export type OperationalDisposition =
  | 'continue'
  | 'park_and_continue'
  | 'block';

export interface OperationalAlternative {
  id: string;
  title: string;
  description: string;
  preservesGoal: boolean;
  availableNow: boolean;
  risk: 'low' | 'medium' | 'high';
  evidence?: string[];
  nextAction: string;
}

export interface OperationalBlockerResolution {
  problem: string;
  risk: string;
  cause: string;
  kind: OperationalBlockerKind;
  alternatives: OperationalAlternative[];
  recommendation: string;
  nextAction: string;
  disposition: OperationalDisposition;
  parkedIssue?: string;
}

export function buildOperationalBlockerResolution(input: {
  problem: string;
  risk: string;
  cause: string;
  kind?: OperationalBlockerKind;
  alternatives: readonly OperationalAlternative[];
  mandatoryStop?: boolean;
  parkedIssue?: string;
}): OperationalBlockerResolution {
  const problem = required(input.problem, 'problem');
  const risk = required(input.risk, 'risk');
  const cause = required(input.cause, 'cause');
  const alternatives = dedupeAlternatives(input.alternatives);
  if (alternatives.length < 2 || alternatives.length > 4) {
    throw new Error('operational blocker resolution requires 2-4 real alternatives');
  }

  const safeNow = alternatives.filter(
    (alternative) => alternative.availableNow
      && alternative.preservesGoal
      && alternative.risk !== 'high',
  );
  const best = safeNow[0] ?? alternatives.find((alternative) => alternative.availableNow);
  const mandatoryStop = input.mandatoryStop === true;

  if (mandatoryStop) {
    return {
      problem,
      risk,
      cause,
      kind: input.kind ?? 'unknown',
      alternatives,
      recommendation: best
        ? `Prepare ${best.title} but do not bypass the mandatory stop.`
        : 'Preserve state and wait for the mandatory dependency or approval.',
      nextAction: best?.nextAction ?? 'Record the blocker and preserve the exact resume point.',
      disposition: 'block',
      ...(input.parkedIssue?.trim() ? { parkedIssue: input.parkedIssue.trim() } : {}),
    };
  }

  if (best) {
    return {
      problem,
      risk,
      cause,
      kind: input.kind ?? 'unknown',
      alternatives,
      recommendation: `Use ${best.title} and keep the blocked path as a tracked pending item.`,
      nextAction: best.nextAction,
      disposition: input.parkedIssue?.trim() ? 'park_and_continue' : 'continue',
      ...(input.parkedIssue?.trim() ? { parkedIssue: input.parkedIssue.trim() } : {}),
    };
  }

  return {
    problem,
    risk,
    cause,
    kind: input.kind ?? 'unknown',
    alternatives,
    recommendation: 'Do not improvise an unsafe bypass; preserve state and escalate with the listed alternatives.',
    nextAction: alternatives[0]!.nextAction,
    disposition: 'block',
    ...(input.parkedIssue?.trim() ? { parkedIssue: input.parkedIssue.trim() } : {}),
  };
}

export function defaultProviderAlternatives(input: {
  providerName: string;
  task: string;
  localAvailable?: boolean;
  otherModelAvailable?: boolean;
}): OperationalAlternative[] {
  const provider = input.providerName.trim() || 'configured provider';
  const task = input.task.trim() || 'current task';
  return [
    {
      id: 'use-other-model',
      title: 'another registered model',
      description: `Route ${task} through another registered model instead of depending on ${provider}.`,
      preservesGoal: true,
      availableNow: input.otherModelAvailable === true,
      risk: 'low',
      nextAction: 'Ask Model Router for the best compatible registered alternative.',
    },
    {
      id: 'use-local-path',
      title: 'local/offline path',
      description: `Continue the parts of ${task} that can be completed with local models, deterministic tools or existing project assets.`,
      preservesGoal: true,
      availableNow: input.localAvailable === true,
      risk: 'low',
      nextAction: 'Continue locally and leave provider-dependent work as a tracked pending item.',
    },
    {
      id: 'park-provider-step',
      title: 'park only the blocked provider step',
      description: 'Keep the unresolved provider-specific step pending while continuing independent work in the same project.',
      preservesGoal: true,
      availableNow: true,
      risk: 'low',
      nextAction: 'Record the blocked step, continue independent tasks and revalidate the dependency later.',
    },
    {
      id: 'manual-compatible-tool',
      title: 'compatible non-provider tool',
      description: 'Use another registered tool or deterministic workflow when the task does not actually require generative reasoning.',
      preservesGoal: true,
      availableNow: true,
      risk: 'medium',
      nextAction: 'Check the Capability Registry for a tool-based path before stopping the project.',
    },
  ];
}

export const CONTINUE_BY_ALTERNATIVES_POLICY = {
  id: 'continue-by-alternatives-v1',
  rule:
    'A non-mandatory obstacle must not stop the whole project when safe independent work can continue. Diagnose the blocker, present 2-4 real alternatives, recommend a viable path, park the blocked dependency when possible, and keep moving.',
  mandatoryStops: [
    'required human approval',
    'missing legal/safety authority',
    'irreversible high-risk action without confirmation',
    'required data whose absence would make the result materially false',
  ],
} as const;

function dedupeAlternatives(
  alternatives: readonly OperationalAlternative[],
): OperationalAlternative[] {
  const seen = new Set<string>();
  const result: OperationalAlternative[] = [];
  for (const alternative of alternatives) {
    const id = alternative.id.trim();
    const title = alternative.title.trim();
    const description = alternative.description.trim();
    const nextAction = alternative.nextAction.trim();
    if (!id || !title || !description || !nextAction) {
      throw new Error('operational alternative requires id, title, description and nextAction');
    }
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({
      ...alternative,
      id,
      title,
      description,
      nextAction,
      evidence: alternative.evidence?.map((item) => item.trim()).filter(Boolean),
    });
  }
  return result;
}

function required(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${name} is required`);
  return trimmed;
}
