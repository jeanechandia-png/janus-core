import { getDashboardProfile, type DashboardRole } from "./dashboard-profiles.js";
import { isKendraLocale, type KendraLocale } from "./kendra-locale.js";

/** The two exact owner-provided images are assets, NOT prompts to regenerate icons. */
export const approvedLanguageButtonAssets = {
  es: "E5D218D4-2159-4706-BB99-F16A90773A91.jpeg",
  nl: "EDFDAF8B-B090-483D-872D-03AD19AC71C9.jpeg",
} as const;
export const dashboardLanguageButtons = [
  { locale: "nl", label: "Nederlands", image: approvedLanguageButtonAssets.nl },
  { locale: "es", label: "Español", image: approvedLanguageButtonAssets.es },
] as const;
export const dashboardLocaleStorageKey = (role: DashboardRole) => `janus.${getDashboardProfile(role).id}.locale.v1`;
export function resolveDashboardLocale(role: DashboardRole, value: unknown): KendraLocale {
  const profile = getDashboardProfile(role);
  return isKendraLocale(value) && profile.supportedLocales?.includes(value) ? value : (profile.defaultLocale ?? "es");
}
export function dashboardSpeechLanguage(role: DashboardRole, value: unknown): "nl-NL" | "es-ES" {
  return resolveDashboardLocale(role, value) === "nl" ? "nl-NL" : "es-ES";
}
/** Rendering must use original owner-provided files and retain the approved cinematic 3D look. */
export const dashboardVisualLock = Object.freeze({
  originalAssetsOnly: true,
  allowRegeneration: false,
  preserveHyperrealistic3D: true,
  preserveReflections: true,
  preserveCinematicLighting: true,
});
