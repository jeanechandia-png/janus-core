import type { AuthorityPrincipal } from './authority.js';
import type {
  CoordinationBrief,
  CoordinationHandoff,
  CoordinationOperatorProfile,
} from './operator-coordination.js';
import type {
  ProjectContextCheckpoint,
  ProjectResourceRef,
  ProjectThread,
  ProjectWorkspace,
} from './project-context.js';
import type { WorkSessionSummary } from './work-session.js';
import { agendaForOwner, type WorkAgendaItem } from './work-agenda.js';
import type { WorkMessage } from './work-message.js';

/**
 * Pure, reusable data contract for a collaborator dashboard. UI skins reuse
 * the existing Founder design tokens; this module never creates another app
 * or grants additional authority. All inputs must be server-side scoped.
 *
 * 10-nov-2026 (decisión del CEO): la piel visual de la plantilla laboral es la
 * dashboard de IBA («command center»). `skinSource` describe de dónde sale la
 * piel; los datos y permisos siguen siendo exclusivamente de JANUS Core.
 */
export type WorkDashboardLocale = 'es' | 'nl' | 'en';

export const WORK_PROFILE_INSTRUCTIONS_MAX = 12000;
export const WORK_PROFILE_FUNCTIONS_MAX = 12;

/** Tipos que el visor interno puede mostrar sin descargar. */
export const WORK_VIEWABLE_MIME: readonly string[] = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
];

/** Acciones reservadas al CEO; la plantilla las muestra como no disponibles. */
export const WORK_RESERVED_TO_CEO = [
  'purchases',
  'payments',
  'contracts',
  'permissions',
  'critical_deploys',
  'project_instructions',
  'file_download',
  'external_sharing',
] as const;

export interface WorkDashboardProject {
  id: string;
  name: string;
  status: ProjectWorkspace['status'];
  description?: string;
  /** Instrucciones permanentes del proyecto (las fija el Founder). */
  instructions?: string;
  canWrite: boolean;
  /** El proyecto lo abrió esta persona. */
  ownedByMe: boolean;
  /** «Solo modelo propio»: su contenido no se envía a proveedores externos. */
  localOnly: boolean;
  nextActions: string[];
  resumeFrom?: { subject: string; content: string; at: string };
  decisions: Array<{ subject: string; content: string; at: string }>;
  unresolvedErrors: Array<{ subject: string; content: string; at: string }>;
  checkpointAt?: string;
  threads: Array<Pick<ProjectThread, 'id' | 'title' | 'status' | 'updatedAt'>>;
  /** Solo metadatos: una referencia no implica que el binario se haya procesado. */
  resources: Array<Pick<ProjectResourceRef, 'id' | 'name' | 'source' | 'createdAt' | 'addedBy' | 'mimeType' | 'threadId'> & { viewable: boolean }>;
}

export interface WorkDashboardProjectInput {
  project: ProjectWorkspace;
  canWrite: boolean;
  threads?: readonly ProjectThread[];
  resources?: readonly ProjectResourceRef[];
  latestCheckpoint?: ProjectContextCheckpoint | null;
}

export interface ReusableWorkDashboard {
  templateId: 'janus-work-v1';
  skinSource: 'founder-dashboard' | 'iba-command-center';
  principalId: string;
  locale: WorkDashboardLocale;
  labels: { title: string; projects: string; assignments: string; blockers: string };
  profile: {
    displayName: string;
    roleTitle?: string;
    functions: string[];
    /** Instrucciones permanentes individuales (solo lectura para la persona). */
    instructions?: string;
  };
  capabilities: {
    text: true;
    voice: false;
    approvePayments: false;
    changePermissions: false;
    productionDeploy: false;
    editProjectInstructions: false;
    downloadFiles: false;
    shareOutside: false;
    uploadAttachments: boolean;
  };
  reservedToCeo: readonly string[];
  assignments: CoordinationBrief['assignments'];
  projects: WorkDashboardProject[];
  /** Entregas y avances registrados por la persona (handoffs propios). */
  deliveries: CoordinationHandoff[];
  sessions: {
    open: WorkSessionSummary | null;
    recent: WorkSessionSummary[];
    todayActiveSeconds: number;
    /** El tiempo es declarado por la persona; no prueba productividad por sí solo. */
    selfReported: true;
  };
  /** Destinatarios internos admitidos y mensajes propios (los rechazados incluidos, con su motivo). */
  messaging: { recipients: Array<{ id: string; label: string }>; sent: WorkMessage[] };
  /** Agenda propia (incluye lo privado: este contrato solo se entrega a su dueño). */
  agenda: WorkAgendaItem[];
  /** Consultas a JANUS hoy frente al límite diario fijado por el CEO (`limit` 0 = sin límite). */
  usage: { used: number; limit: number; remaining: number | null };
  generatedAt: string;
}

function isProjectInput(value: ProjectWorkspace | WorkDashboardProjectInput): value is WorkDashboardProjectInput {
  return typeof (value as WorkDashboardProjectInput).project === 'object'
    && (value as WorkDashboardProjectInput).project !== null;
}

/**
 * The UI is the same template for any operator. Locale is data on their
 * authenticated profile; do not infer permissions from display names.
 */
export function buildReusableWorkDashboard(input: {
  principal: AuthorityPrincipal;
  profile: CoordinationOperatorProfile;
  coordination: CoordinationBrief;
  /** Proyectos YA autorizados por canAccessProject (forma simple o detallada). */
  projects: readonly (ProjectWorkspace | WorkDashboardProjectInput)[];
  handoffs?: readonly CoordinationHandoff[];
  sessions?: readonly WorkSessionSummary[];
  uploadAttachments?: boolean;
  skinSource?: ReusableWorkDashboard['skinSource'];
  usage?: { used: number; limit: number; remaining: number | null };
  agenda?: readonly WorkAgendaItem[];
  recipients?: readonly { id: string; label: string }[];
  messages?: readonly WorkMessage[];
  now?: string;
}): ReusableWorkDashboard {
  if (!input.principal.active || input.principal.role !== 'operator') {
    throw new Error('operator dashboard access denied');
  }
  if (input.profile.principalId !== input.principal.id || input.profile.status !== 'active') {
    throw new Error('operator dashboard profile mismatch');
  }
  if (input.coordination.principalId !== input.principal.id) {
    throw new Error('operator dashboard coordination mismatch');
  }
  const locale: WorkDashboardLocale = input.profile.locale === 'nl' || input.profile.locale === 'en'
    ? input.profile.locale : 'es';
  const texts = {
    es: { title: 'Centro de trabajo', projects: 'Proyectos', assignments: 'Mis tareas', blockers: 'Bloqueos' },
    nl: { title: 'Werkdashboard', projects: 'Projecten', assignments: 'Mijn taken', blockers: 'Blokkades' },
    en: { title: 'Work dashboard', projects: 'Projects', assignments: 'My tasks', blockers: 'Blockers' },
  };
  const now = input.now ?? new Date().toISOString();
  // Caller must pass only projects already authorized by canAccessProject.
  // Only the assignee's own tasks appear, even if a shared scope includes
  // assignments owned by another collaborator.
  const assignments = input.coordination.assignments
    .filter(({ assignment }) => assignment.assigneePrincipalId === input.principal.id)
    .map((item) => structuredClone(item));
  const ownAssignmentIds = new Set(assignments.map((item) => item.assignment.id));
  const deliveries = (input.handoffs ?? [])
    .filter((handoff) => handoff.fromPrincipalId === input.principal.id && ownAssignmentIds.has(handoff.assignmentId))
    .map((handoff) => structuredClone(handoff))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, 30);
  const ownSessions = (input.sessions ?? [])
    .filter((session) => session.principalId === input.principal.id)
    .map((session) => structuredClone(session));
  const open = ownSessions.filter((session) => session.state !== 'ended').at(-1) ?? null;
  const today = now.slice(0, 10);
  const todayActiveSeconds = ownSessions
    .filter((session) => session.startedAt.slice(0, 10) === today)
    .reduce((total, session) => total + session.activeSeconds, 0);

  const projects: WorkDashboardProject[] = input.projects.map((entry) => {
    const detail: WorkDashboardProjectInput = isProjectInput(entry)
      ? entry : { project: entry, canWrite: false };
    const { id, name, status, description, instructions } = detail.project;
    const checkpoint = detail.latestCheckpoint ?? null;
    return {
      id, name, status,
      ...(description ? { description } : {}),
      ...(instructions ? { instructions } : {}),
      canWrite: detail.canWrite === true,
      ownedByMe: detail.project.createdBy === input.principal.id,
      localOnly: detail.project.modelPolicy === 'local_only',
      nextActions: checkpoint ? [...checkpoint.nextActions].slice(0, 12) : [],
      ...(checkpoint?.resumeFrom ? { resumeFrom: { ...checkpoint.resumeFrom } } : {}),
      decisions: checkpoint ? checkpoint.decisions.slice(-8).map((item) => ({ ...item })) : [],
      unresolvedErrors: checkpoint ? checkpoint.unresolvedErrors.slice(-8).map((item) => ({ ...item })) : [],
      ...(checkpoint ? { checkpointAt: checkpoint.createdAt } : {}),
      threads: (detail.threads ?? []).slice(-12).map(({ id: threadId, title, status: threadStatus, updatedAt }) => ({
        id: threadId, title, status: threadStatus, updatedAt,
      })),
      resources: (detail.resources ?? []).slice(-60).map((resource) => ({
        id: resource.id,
        name: resource.name,
        source: resource.source,
        createdAt: resource.createdAt,
        addedBy: resource.addedBy,
        // Se abre DENTRO del panel (sin descarga). Solo archivos subidos a JANUS y de tipo que el visor muestra.
        viewable: resource.source === 'upload' && WORK_VIEWABLE_MIME.includes(resource.mimeType ?? ''),
        ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
        ...(resource.threadId ? { threadId: resource.threadId } : {}),
      })),
    };
  });

  const functions = (input.profile.functions ?? [])
    .map((item) => String(item).trim()).filter(Boolean).slice(0, WORK_PROFILE_FUNCTIONS_MAX);
  return {
    templateId: 'janus-work-v1',
    skinSource: input.skinSource ?? 'founder-dashboard',
    principalId: input.principal.id,
    locale,
    labels: texts[locale],
    profile: {
      displayName: input.profile.displayName?.trim() || input.principal.id,
      ...(input.profile.roleTitle?.trim() ? { roleTitle: input.profile.roleTitle.trim() } : {}),
      functions,
      ...(input.profile.instructions?.trim() ? { instructions: input.profile.instructions.trim() } : {}),
    },
    capabilities: {
      text: true,
      voice: false,
      approvePayments: false,
      changePermissions: false,
      productionDeploy: false,
      editProjectInstructions: false,
      downloadFiles: false,
      shareOutside: false,
      uploadAttachments: input.uploadAttachments === true,
    },
    reservedToCeo: WORK_RESERVED_TO_CEO,
    assignments,
    projects,
    deliveries,
    sessions: {
      open,
      recent: ownSessions.slice(-10).reverse(),
      todayActiveSeconds,
      selfReported: true,
    },
    messaging: {
      recipients: (input.recipients ?? []).map((entry) => ({ ...entry })),
      sent: (input.messages ?? []).filter((message) => message.fromPrincipalId === input.principal.id).slice(0, 20).map((message) => ({ ...message })),
    },
    agenda: agendaForOwner(input.agenda ?? [], input.principal.id, now.slice(0, 10)).slice(0, 80),
    usage: input.usage ? { ...input.usage } : { used: 0, limit: 0, remaining: null },
    generatedAt: now,
  };
}

/** Valida los campos de perfil laboral que solo el Founder puede fijar. */
export function sanitizeWorkProfilePatch(body: Record<string, unknown>): {
  displayName?: string;
  roleTitle?: string;
  functions?: string[];
  instructions?: string;
  locale?: WorkDashboardLocale;
} {
  const patch: ReturnType<typeof sanitizeWorkProfilePatch> = {};
  if (typeof body.displayName === 'string') {
    const value = body.displayName.trim();
    if (!value || value.length > 80) throw new Error('displayName must have 1-80 characters');
    patch.displayName = value;
  }
  if (typeof body.roleTitle === 'string') {
    const value = body.roleTitle.trim();
    if (value.length > 80) throw new Error('roleTitle must have at most 80 characters');
    patch.roleTitle = value;
  }
  if (body.functions !== undefined) {
    if (!Array.isArray(body.functions) || body.functions.length > WORK_PROFILE_FUNCTIONS_MAX) {
      throw new Error(`functions must be a list of at most ${WORK_PROFILE_FUNCTIONS_MAX} items`);
    }
    patch.functions = body.functions.map((item) => String(item).trim()).filter(Boolean)
      .map((item) => { if (item.length > 120) throw new Error('function entry is too long'); return item; });
  }
  if (typeof body.instructions === 'string') {
    if (body.instructions.length > WORK_PROFILE_INSTRUCTIONS_MAX) {
      throw new Error(`instructions must have at most ${WORK_PROFILE_INSTRUCTIONS_MAX} characters`);
    }
    patch.instructions = body.instructions.trim();
  }
  if (body.locale !== undefined) {
    if (body.locale !== 'es' && body.locale !== 'nl' && body.locale !== 'en') throw new Error('locale must be es, nl or en');
    patch.locale = body.locale;
  }
  return patch;
}
