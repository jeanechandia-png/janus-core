/** Reusable, provider-neutral dashboard presentation policy. No private user data. */
export type DashboardRole = "founder" | "child";
export type AvatarEmotion = "idle" | "listening" | "thinking" | "speaking" | "happy" | "surprised" | "angry";
export type VoicePresentation = "masculine" | "feminine";
export interface DashboardProfile {
  readonly id: "dashboard-1" | "dashboard-2";
  readonly role: DashboardRole;
  readonly modules: readonly string[];
  readonly defaultVoice: VoicePresentation;
  readonly supportedLocales?: readonly ("nl" | "es")[];
  readonly defaultLocale?: "nl" | "es";
  readonly avatarAssetStatus: "approved-reference-required";
  readonly avatarEmotions: readonly AvatarEmotion[];
}
const emotions: readonly AvatarEmotion[] = ["idle", "listening", "thinking", "speaking", "happy", "surprised", "angry"];
export const dashboardProfiles: Readonly<Record<DashboardRole, DashboardProfile>> = {
  founder: {
    id: "dashboard-1",
    role: "founder",
    modules: ["activity", "tasks", "agents", "voice", "approvals", "automation"],
    defaultVoice: "masculine",
    supportedLocales: ["nl", "es"],
    defaultLocale: "es",
    avatarAssetStatus: "approved-reference-required",
    avatarEmotions: emotions,
  },
  child: {
    id: "dashboard-2",
    role: "child",
    modules: ["companion", "learning", "voice"],
    defaultVoice: "feminine",
    supportedLocales: ["nl", "es"],
    defaultLocale: "nl",
    avatarAssetStatus: "approved-reference-required",
    avatarEmotions: emotions,
  },
};
export function getDashboardProfile(role: DashboardRole): DashboardProfile {
  return dashboardProfiles[role];
}
export function isModuleVisible(role: DashboardRole, moduleId: string): boolean {
  return dashboardProfiles[role].modules.includes(moduleId);
}
