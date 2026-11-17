import { getDashboardProfile, type DashboardRole } from "./dashboard-profiles.js";

/** Presentation filtering only. The backend MUST independently enforce authorization. */
export type DashboardPrincipal = Readonly<{ subjectId: string; role: DashboardRole; authenticated: boolean }>;
export type DashboardAccess = Readonly<{ allowed: boolean; reason: "ok" | "unauthenticated" | "wrong-role" | "unknown-module" }>;

export function authorizeDashboardModule(
  principal: DashboardPrincipal | null | undefined,
  requestedRole: DashboardRole,
  moduleId: string,
): DashboardAccess {
  if (!principal?.authenticated || !principal.subjectId.trim()) return { allowed: false, reason: "unauthenticated" };
  if (principal.role !== requestedRole) return { allowed: false, reason: "wrong-role" };
  if (!getDashboardProfile(requestedRole).modules.includes(moduleId)) return { allowed: false, reason: "unknown-module" };
  return { allowed: true, reason: "ok" };
}

/** Prevent cross-role module leakage even if a client sends a forged module list. */
export function visibleDashboardModules(principal: DashboardPrincipal | null | undefined, role: DashboardRole): readonly string[] {
  if (!principal?.authenticated || !principal.subjectId.trim() || principal.role !== role) return [];
  return getDashboardProfile(role).modules.filter(id => authorizeDashboardModule(principal, role, id).allowed);
}
