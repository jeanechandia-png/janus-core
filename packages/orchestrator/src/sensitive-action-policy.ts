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
  'netlify-release.deploy.restore': 'Cambia la versión publicada de un sitio en Netlify (producción).',
  'kling.video.create': 'Genera un vídeo en Kling AI (gasta créditos).',
  'supabase-write.migration.apply': 'Aplica una migración en una base de datos de Supabase (cambia el esquema).',
  'supabase-write.sql.execute': 'Ejecuta SQL en una base de datos de Supabase (escritura; no devuelve datos de clientes).',
  'vercel-release.deployment.redeploy': 'Redespliega un proyecto en Vercel (puede cambiar producción).',
  'hostinger-release.site.deploy': 'Publica o reemplaza el contenido de una web en Hostinger (cambia un sitio en vivo).',
  'n8n.workflow.trigger': 'Dispara un flujo de n8n (acción externa).',
  'http.request.send': 'Envía datos a un sistema externo por HTTP (POST/PUT/PATCH/DELETE; escritura externa).',
  'google-workspace-write.gmail.draft.create': 'Crea un borrador en Gmail (escritura en tu correo; no se envía).',
  'google-workspace-write.calendar.event.create': 'Crea un evento en Google Calendar (escritura en tu agenda).',
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
