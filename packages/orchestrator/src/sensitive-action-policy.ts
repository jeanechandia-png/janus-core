import type { JanusPlan, PlannedToolStep } from './plan.js';

/**
 * Deterministic guard applied AFTER planning and BEFORE execution: actions that
 * spend money/credits or write to an external system always require explicit
 * approval, regardless of what a model planner proposed. A planner can never
 * downgrade them. Extend the list when a new external write is added.
 */
export const SENSITIVE_TOOL_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
  'asana.task.create': 'Crea una tarea en Asana (escritura externa).',
  'runway.image.create': 'Genera una imagen en Runway (gasta créditos).',
  'runway.video.create': 'Genera un vídeo en Runway (gasta créditos).',
  'github.file.publish': 'Publica un archivo en GitHub (escritura externa).',
});

export interface SensitiveActionReport {
  stepId: string;
  operation: string;
  reason: string;
  plannerRisk: string;
  plannerRequiredApproval: boolean;
}

export function enforceSensitiveActionPolicy(plan: JanusPlan): { plan: JanusPlan; enforced: SensitiveActionReport[] } {
  const enforced: SensitiveActionReport[] = [];
  const steps = plan.steps.map((step): PlannedToolStep => {
    const operation = `${step.tool}.${step.action}`;
    const reason = SENSITIVE_TOOL_ACTIONS[operation];
    if (!reason) return step;
    enforced.push({ stepId: step.id, operation, reason, plannerRisk: step.risk, plannerRequiredApproval: step.requiresApproval });
    return { ...step, risk: 'high', reversible: false, requiresApproval: true };
  });
  return { plan: { ...plan, steps }, enforced };
}
