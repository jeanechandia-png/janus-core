/** Kendra's explicit language choice. Local-first, no provider dependency. */
export type KendraLocale = "nl" | "es";
export const KENDRA_LOCALES = ["nl", "es"] as const;
export const KENDRA_LOCALE_STORAGE_KEY = "janus.dashboard-2.locale.v1";
export const KENDRA_DEFAULT_LOCALE: KendraLocale = "nl";
export const kendraLanguageButtons = [
  { locale: "nl", label: "Nederlands", nativeLabel: "Nederlands", flag: "🇳🇱" },
  { locale: "es", label: "Español", nativeLabel: "Español", flag: "🇪🇸" },
] as const;
export type KendraMessageKey = "welcome" | "chooseAdventure" | "learn" | "create" | "voice" | "language" | "mission" | "privacy";
const messages: Record<KendraLocale, Record<KendraMessageKey, string>> = {
  nl: {
    welcome: "Hoi, Kendra!", chooseAdventure: "Welk avontuur kies je vandaag?",
    learn: "Leren", create: "Maken", voice: "Mijn spraakassistent",
    language: "Taal", mission: "Mijn kleine missie", privacy: "Mijn veilige plek",
  },
  es: {
    welcome: "¡Hola, Kendra!", chooseAdventure: "¿Qué aventura quieres vivir hoy?",
    learn: "Aprender", create: "Crear", voice: "Mi asistente de voz",
    language: "Idioma", mission: "Mi pequeña misión", privacy: "Mi espacio seguro",
  },
};
export function isKendraLocale(value: unknown): value is KendraLocale {
  return value === "nl" || value === "es";
}
export function resolveKendraLocale(value: unknown): KendraLocale {
  return isKendraLocale(value) ? value : KENDRA_DEFAULT_LOCALE;
}
export function translateKendra(locale: KendraLocale, key: KendraMessageKey): string {
  return messages[locale][key];
}
/** Use this code for both text UI and speech language routing; never infer from the selected voice gender. */
export function kendraSpeechLanguage(locale: KendraLocale): "nl-NL" | "es-ES" {
  return locale === "nl" ? "nl-NL" : "es-ES";
}
