/**
 * Mandatory closure protocol (Requisito 5).
 * Every run that reaches a terminal state yields a structured report with
 * exactly three sections, in this order:
 *   1) RESUMEN EJECUTIVO (logros)
 *   2) CONCLUSIONES TÉCNICAS Y OPERATIVAS
 *   3) PRÓXIMOS PASOS (hoja de ruta para el siguiente agente u operario)
 *
 * Pure and deterministic: it only reads what is passed in, invents nothing,
 * and stores no new database structure.
 */
import { createHash } from 'node:crypto';
import type { JanusEvent, RunSnapshot } from './events.js';

export interface ClosureReportInput {
  snapshot: RunSnapshot;
  events: readonly JanusEvent[];
  decisionSummaries?: readonly string[];
  /** Next action proposed by the blocker resolver, if the run ended blocked. */
  blockerNextAction?: string;
  /** Extra next steps declared by an assignment/project. */
  declaredNextActions?: readonly string[];
  generatedAt?: string;
}

export interface ClosureReport {
  runId: string;
  goal: string;
  status: RunSnapshot['status'];
  generatedAt: string;
  executiveSummary: { outcome: string; achievements: string[] };
  technicalConclusions: string[];
  nextSteps: string[];
  evidenceRefs: string[];
  checksum: string;
}

export function buildClosureReport(input: ClosureReportInput): ClosureReport {
  const { snapshot } = input;
  const events = [...input.events].sort((a, b) => a.seq - b.seq);

  const achievements = unique(
    events.filter((event) => event.type === 'run.step.completed').map((event) => event.summary),
  );
  const artifact = [...events]
    .reverse()
    .find((event) => event.type === 'artifact.updated' && typeof event.payload.preview === 'string');
  const artifactPreview = artifact ? String(artifact.payload.preview).trim().slice(0, 400) : '';
  const blockers = unique(
    events.filter((event) => event.type === 'run.blocked' || event.type === 'run.failed').map((event) => event.summary),
  );
  const approvalsRequired = events.filter((event) => event.type === 'approval.required').length;
  const qualityFailed = events.filter((event) => event.type === 'quality.failed').map((event) => event.summary);
  const qualityPassed = events.filter((event) => event.type === 'quality.passed').length;

  const outcome = ({
    completed: 'Objetivo completado.',
    failed: 'La ejecución terminó con fallo; ver conclusiones.',
    blocked: 'La ejecución quedó bloqueada; ver próximos pasos.',
    cancelled: 'La ejecución fue cancelada.',
    paused: 'La ejecución está en pausa.',
    waiting_approval: 'La ejecución espera aprobación del Founder.',
    running: 'La ejecución sigue en curso.',
    heard: 'Solicitud recibida sin ejecutar.',
  } satisfies Record<RunSnapshot['status'], string>)[snapshot.status];

  const technicalConclusions = unique([
    `Estado final: ${snapshot.status}; ${achievements.length} paso(s) completado(s); ${approvalsRequired} aprobación(es) requerida(s).`,
    ...(qualityPassed > 0 ? [`Puertas de calidad superadas: ${qualityPassed}.`] : []),
    ...qualityFailed.map((summary) => `Puerta de calidad fallida: ${summary}`),
    ...blockers.map((summary) => `Bloqueo/fallo: ${summary}`),
    ...(input.decisionSummaries ?? []).slice(-6).map((summary) => `Decisión: ${summary}`),
    ...(artifactPreview ? [`Resultado principal: ${artifactPreview}`] : []),
  ]);

  const nextSteps = unique([
    ...(input.blockerNextAction ? [input.blockerNextAction] : []),
    ...(snapshot.status === 'waiting_approval' || approvalsRequired > 0 && snapshot.status !== 'completed'
      ? ['Revisar la cola de Aprobaciones del Founder y resolver lo pendiente.']
      : []),
    ...(input.declaredNextActions ?? []),
    ...(snapshot.status === 'failed' || snapshot.status === 'blocked'
      ? ['Retomar desde el último paso completado; no repetir lo ya hecho (ver evidencia).']
      : []),
    ...(snapshot.status === 'completed' && !input.declaredNextActions?.length && !input.blockerNextAction
      ? ['Sin pendientes registrados por esta ejecución; el siguiente agente confirma contra docs/STATE.md.']
      : []),
  ]);

  const evidenceRefs = events.slice(-20).map((event) => `event:${event.id}`);
  const generatedAt = input.generatedAt ?? snapshot.updatedAt;
  const body = {
    runId: snapshot.runId,
    goal: snapshot.goal,
    status: snapshot.status,
    generatedAt,
    executiveSummary: {
      outcome,
      achievements: achievements.length > 0 ? achievements : ['Ningún paso completado.'],
    },
    technicalConclusions,
    nextSteps,
    evidenceRefs,
  };
  const checksum = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return { ...body, checksum };
}

export function renderClosureReportMarkdown(report: ClosureReport): string {
  const bullets = (items: readonly string[]) => items.map((item) => `- ${item}`).join('\n');
  return [
    `# Cierre de ejecución — ${report.runId}`,
    `Objetivo: ${report.goal}`,
    '',
    '## RESUMEN EJECUTIVO',
    report.executiveSummary.outcome,
    bullets(report.executiveSummary.achievements),
    '',
    '## CONCLUSIONES TÉCNICAS Y OPERATIVAS',
    bullets(report.technicalConclusions),
    '',
    '## PRÓXIMOS PASOS',
    bullets(report.nextSteps),
    '',
    `Sello: ${report.checksum.slice(0, 16)} · ${report.generatedAt}`,
  ].join('\n');
}

function unique(items: readonly string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
