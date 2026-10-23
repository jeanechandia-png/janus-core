/**
 * Autonomous execution policy (Requisito 2).
 *
 * Principle: Janus never ends a run with only a diagnosis. The pipeline is
 *   Diagnóstico -> Conclusiones -> Plan de acción inmediato -> Ejecución directa.
 *
 * Founder interruption is reserved for exactly three structural triggers:
 *   1. radical architecture / database change,
 *   2. definitive removal of a main module,
 *   3. direct change of corporate image / brand identity.
 *
 * ADDITIVE GUARANTEE: the existing sensitive-action policy (external writes and
 * credit spending -> Founder approval queue) is NOT relaxed. Those steps are
 * PARKED in the approval queue and the loop keeps advancing independent steps,
 * so approval never blocks the whole run ("park and continue").
 */

export type ChangeTouch =
  | 'db_schema'
  | 'architecture'
  | 'module_removal'
  | 'brand_identity'
  | 'external_write'
  | 'spend';

export type InterruptionTrigger =
  | 'structural_architecture_or_database'
  | 'definitive_module_removal'
  | 'brand_identity_change';

export type AutonomyDecision =
  | { action: 'proceed' }
  | { action: 'queue_approval'; reason: string }
  | { action: 'interrupt_founder'; triggers: InterruptionTrigger[]; reason: string };

export interface ProposedChange {
  id: string;
  summary: string;
  touches: readonly ChangeTouch[];
}

const TRIGGER_BY_TOUCH: Partial<Record<ChangeTouch, InterruptionTrigger>> = {
  db_schema: 'structural_architecture_or_database',
  architecture: 'structural_architecture_or_database',
  module_removal: 'definitive_module_removal',
  brand_identity: 'brand_identity_change',
};

export function evaluateAutonomy(change: ProposedChange): AutonomyDecision {
  const triggers = [
    ...new Set(
      change.touches
        .map((touch) => TRIGGER_BY_TOUCH[touch])
        .filter((trigger): trigger is InterruptionTrigger => Boolean(trigger)),
    ),
  ];
  if (triggers.length > 0) {
    return {
      action: 'interrupt_founder',
      triggers,
      reason: `Requiere aprobación del Founder (${triggers.join(', ')}): ${change.summary}`,
    };
  }
  if (change.touches.includes('external_write') || change.touches.includes('spend')) {
    return {
      action: 'queue_approval',
      reason: `Acción externa sensible: va a la cola de aprobaciones y la ejecución continúa con lo independiente: ${change.summary}`,
    };
  }
  return { action: 'proceed' };
}

/**
 * INFERENCIA (heurística): detects touches from free text. It can only ADD
 * gates; callers that know the real touches must declare them explicitly.
 */
export function inferChangeTouches(text: string): ChangeTouch[] {
  const value = text.toLowerCase();
  const touches = new Set<ChangeTouch>();
  if (/(drop\s+table|alter\s+table|migraci[oó]n|migration|esquema de (la )?base|database schema|schema change|user_version)/.test(value)) touches.add('db_schema');
  if (/(reescribir la arquitectura|rewrite the architecture|rearquitectura|cambio estructural|restructure the core)/.test(value)) touches.add('architecture');
  if (/(eliminar|borrar|remove|delete)\s+(definitivamente\s+)?(el\s+|the\s+)?m[oó]dulo|module removal|delete the module/.test(value)) touches.add('module_removal');
  if (/(logo|identidad (de marca|corporativa)|imagen corporativa|brand identity|paleta de marca|brand palette)/.test(value)
    && /(cambiar|modificar|reemplazar|replace|change|rebrand|redise)/.test(value)) touches.add('brand_identity');
  return [...touches];
}

export type AutonomousStepStatus =
  | 'completed'
  | 'failed'
  | 'parked_for_approval'
  | 'waiting_dependency'
  | 'rejected';

export interface AutonomousStep {
  id: string;
  title: string;
  change?: ProposedChange;
  dependsOn?: readonly string[];
  run: () => Promise<string | void>;
}

export interface AutonomousStepResult {
  stepId: string;
  title: string;
  status: AutonomousStepStatus;
  attempts: number;
  detail?: string;
  decision?: AutonomyDecision;
}

export type ApprovalOutcomeKind = 'approved' | 'rejected' | 'pending';

export interface AutonomousPipelineInput {
  goal: string;
  diagnose: () => Promise<{ findings: string[] }>;
  conclude: (diagnosis: { findings: string[] }) => Promise<string[]>;
  plan: (diagnosis: { findings: string[] }, conclusions: string[]) => Promise<AutonomousStep[]>;
  /** Enqueue the request in the Founder approval queue. Never awaited indefinitely by the loop. */
  requestApproval?: (step: AutonomousStep, decision: AutonomyDecision) => Promise<ApprovalOutcomeKind>;
  maxAttempts?: number;
}

export interface AutonomousPipelineReport {
  goal: string;
  diagnosis: string[];
  conclusions: string[];
  steps: AutonomousStepResult[];
  /** True when the diagnosis found issues but produced no action plan (forbidden passive answer). */
  passiveDiagnosisViolation: boolean;
  status: 'completed' | 'completed_with_parked' | 'failed';
  parked: string[];
}

export async function runAutonomousPipeline(input: AutonomousPipelineInput): Promise<AutonomousPipelineReport> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? 2);
  const diagnosis = await input.diagnose();
  const conclusions = await input.conclude(diagnosis);
  const plan = await input.plan(diagnosis, conclusions);

  const report: AutonomousPipelineReport = {
    goal: input.goal,
    diagnosis: diagnosis.findings,
    conclusions,
    steps: [],
    passiveDiagnosisViolation: diagnosis.findings.length > 0 && plan.length === 0,
    status: 'completed',
    parked: [],
  };
  if (report.passiveDiagnosisViolation) {
    report.status = 'failed';
    return report;
  }

  const outcome = new Map<string, AutonomousStepStatus>();
  for (const step of plan) {
    const blockedBy = (step.dependsOn ?? []).find((dependency) => outcome.get(dependency) !== 'completed');
    if (blockedBy) {
      outcome.set(step.id, 'waiting_dependency');
      report.steps.push({
        stepId: step.id,
        title: step.title,
        status: 'waiting_dependency',
        attempts: 0,
        detail: `Espera a "${blockedBy}" (${outcome.get(blockedBy) ?? 'no ejecutado'}).`,
      });
      continue;
    }

    const decision = step.change ? evaluateAutonomy(step.change) : ({ action: 'proceed' } as AutonomyDecision);
    if (decision.action !== 'proceed') {
      const approval = input.requestApproval
        ? await input.requestApproval(step, decision)
        : 'pending';
      if (approval === 'rejected') {
        outcome.set(step.id, 'rejected');
        report.steps.push({ stepId: step.id, title: step.title, status: 'rejected', attempts: 0, decision });
        continue;
      }
      if (approval === 'pending') {
        outcome.set(step.id, 'parked_for_approval');
        report.parked.push(step.id);
        report.steps.push({
          stepId: step.id,
          title: step.title,
          status: 'parked_for_approval',
          attempts: 0,
          detail: decision.reason,
          decision,
        });
        continue;
      }
    }

    let attempts = 0;
    let lastError = '';
    let done = false;
    let detail: string | undefined;
    while (attempts < maxAttempts && !done) {
      attempts += 1;
      try {
        const result = await step.run();
        if (typeof result === 'string') detail = result;
        done = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    outcome.set(step.id, done ? 'completed' : 'failed');
    report.steps.push({
      stepId: step.id,
      title: step.title,
      status: done ? 'completed' : 'failed',
      attempts,
      ...(done ? (detail ? { detail } : {}) : { detail: lastError }),
      ...(decision.action !== 'proceed' ? { decision } : {}),
    });
  }

  const anyFailed = report.steps.some((step) => step.status === 'failed' || step.status === 'rejected');
  report.status = anyFailed
    ? 'failed'
    : report.parked.length > 0 || report.steps.some((step) => step.status === 'waiting_dependency')
      ? 'completed_with_parked'
      : 'completed';
  return report;
}
