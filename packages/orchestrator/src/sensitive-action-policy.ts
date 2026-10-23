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
  'google-workspace-write.gmail.draft.update': 'Corrige un borrador de Gmail (escritura en tu correo; no se envía).',
  'google-workspace-write.gmail.draft.send': 'ENVÍA un correo desde tu cuenta (irreversible: el destinatario lo recibe).',
  // Voz y rostro (ADR-012): registrar una voz clonada exige tu aprobación explícita cada vez.
  'likeness.founder.voice.enroll': 'Registra TU voz para clonarla: autorizas que Janus use tu grabación en su asistente privado. Los audios llevarán el aviso «generado con IA» y una voz clonada nunca te identifica.',
  'likeness.kendra.voice.enroll': 'Registra la voz de tu hija Kendra (menor): declaras ser su padre/tutor legal y que ella está de acuerdo. Solo voz, solo para el asistente privado de Janus, 6 meses, revocable.',
  // Reservadas para canales por venir. Ningún adaptador las implementa todavía, pero nacen con aprobación obligatoria:
  // el día que exista uno, ni un planificador ni un flujo podrán ejecutarlas sin la confirmación del Founder.
  'whatsapp.message.send': 'ENVÍA un mensaje de WhatsApp en tu nombre (irreversible: el destinatario lo recibe).',
  'whatsapp.template.send': 'ENVÍA una plantilla de WhatsApp en tu nombre (irreversible; puede tener coste por mensaje).',
  'sms.message.send': 'ENVÍA un SMS en tu nombre (irreversible; puede tener coste).',
  'phone.call.place': 'REALIZA una llamada telefónica en tu nombre (coste y efecto inmediato sobre un tercero).',
  'phone.call.answer.profile.activate': 'Activa un perfil para que Janus conteste llamadas en tu nombre (se identifica como asistente de IA).',
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
