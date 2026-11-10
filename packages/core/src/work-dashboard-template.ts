import type { AuthorityPrincipal } from './authority.js';
import type { CoordinationBrief, CoordinationOperatorProfile } from './operator-coordination.js';
import type { ProjectWorkspace } from './project-context.js';

/**
 * Pure, reusable data contract for a collaborator dashboard. UI skins reuse
 * the existing Founder design tokens; this module never creates another app
 * or grants additional authority. All inputs must be server-side scoped.
 */
export type WorkDashboardLocale = 'es' | 'nl' | 'en';
export interface ReusableWorkDashboard {
  templateId: 'janus-work-v1';
  skinSource: 'founder-dashboard';
  principalId: string;
  locale: WorkDashboardLocale;
  labels: { title: string; projects: string; assignments: string; blockers: string };
  capabilities: {
    text: true;
    voice: false;
    approvePayments: false;
    changePermissions: false;
    productionDeploy: false;
  };
  assignments: CoordinationBrief['assignments'];
  projects: Array<Pick<ProjectWorkspace, 'id' | 'name' | 'status' | 'description'>>;
}

/**
 * The UI is the same template for any operator. Locale is data on their
 * authenticated profile; do not infer permissions from display names.
 */
export function buildReusableWorkDashboard(input: {
  principal: AuthorityPrincipal;
  profile: CoordinationOperatorProfile;
  coordination: CoordinationBrief;
  projects: readonly ProjectWorkspace[];
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
  // Caller must pass only projects already authorized by canAccessProject.
  // Only the assignee's own tasks appear, even if a shared scope includes
  // assignments owned by another collaborator.
  return {
    templateId: 'janus-work-v1',
    skinSource: 'founder-dashboard',
    principalId: input.principal.id,
    locale,
    labels: texts[locale],
    capabilities: {
      text: true,
      voice: false,
      approvePayments: false,
      changePermissions: false,
      productionDeploy: false,
    },
    assignments: input.coordination.assignments
      .filter(({ assignment }) => assignment.assigneePrincipalId === input.principal.id)
      .map((item) => structuredClone(item)),
    projects: input.projects.map(({ id, name, status, description }) => ({
      id, name, status, ...(description ? { description } : {}),
    })),
  };
}
